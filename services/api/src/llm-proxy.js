import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";

import {
  loadAgentRunCapture,
  loadAgentRunRecord,
  writeAgentRunRecord,
  writeLlmCallRecord,
} from "./storage.js";

const DEFAULT_OPENAI_UPSTREAM_BASE_URL = "https://api.openai.com/v1";
const STREAM_USAGE_TIMEOUT_MS = 5 * 60 * 1000;

export async function handleOpenAiCompatibleProxyRoute(request, config, route) {
  const run = await loadAgentRunRecord({
    serviceStorageRoot: config.serviceStorageRoot,
    runId: route.runId,
  });
  if (!run) {
    return jsonResponse({ error: "Agent run not found." }, { status: 404 });
  }
  const authFailure = validateProxyAuthorization(request, config);
  if (authFailure) {
    return authFailure;
  }

  const requestUrl = new URL(request.url);
  const preparedRequest = await prepareProxyRequest({
    request,
    requestUrl,
    route,
    run,
  });
  const upstreamFailure = validateAllowedUpstream(preparedRequest.upstream_url, config);
  if (upstreamFailure) {
    return upstreamFailure;
  }
  const startedAtMs = Date.now();

  let upstreamResponse;
  try {
    upstreamResponse = await sendUpstreamRequest({
      url: preparedRequest.upstream_url,
      method: request.method,
      headers: preparedRequest.headers,
      body: preparedRequest.body,
    });
  } catch (error) {
    await persistProxyCall({
      serviceStorageRoot: config.serviceStorageRoot,
      route,
      run,
      preparedRequest,
      responseInfo: {
        status_code: 502,
        latency_ms: Math.max(0, Date.now() - startedAtMs),
        usage: createEmptyUsageSummary(),
        response_id: "",
        metadata: {
          upstream_error: error?.message || "Failed to reach upstream provider.",
        },
      },
    }).catch(() => null);

    return jsonResponse(
      {
        error: error?.message || "Failed to reach upstream provider.",
      },
      { status: 502 },
    );
  }

  const responseBuffer = upstreamResponse.body ?? Buffer.alloc(0);
  const parsedPayload = tryParseJson(responseBuffer, upstreamResponse.headers["content-type"]);
  const ssePayload = isStreamingContentType(upstreamResponse.headers["content-type"])
    ? extractUsageFromSseText(responseBuffer.toString("utf8"))
    : null;
  const usage = extractUsageSummary(parsedPayload);
  const responseInfo = {
    status_code: upstreamResponse.status_code,
    latency_ms: Math.max(0, Date.now() - startedAtMs),
    usage: ssePayload?.usage?.usage_available ? ssePayload.usage : usage,
    response_id: ssePayload?.response_id || extractResponseId(parsedPayload),
    metadata: {
      upstream_url: preparedRequest.upstream_url,
      response_content_type: upstreamResponse.headers["content-type"] ?? "",
      response_body_bytes: responseBuffer.length,
      stream: isStreamingContentType(upstreamResponse.headers["content-type"]),
    },
  };

  await persistProxyCall({
    serviceStorageRoot: config.serviceStorageRoot,
    route,
    run,
    preparedRequest,
    responseInfo,
  });

  return new Response(responseBuffer, {
    status: upstreamResponse.status_code,
    statusText: upstreamResponse.status_text,
    headers: cloneResponseHeaders(upstreamResponse.headers),
  });
}

async function prepareProxyRequest({ request, requestUrl, route, run } = {}) {
  const upstreamBaseUrl = String(
    run.upstream_base_url || resolveDefaultUpstreamBaseUrl(route.provider),
  ).trim();
  const upstreamUrl = new URL(route.upstreamPath.replace(/^\//, ""), ensureTrailingSlash(upstreamBaseUrl));
  upstreamUrl.search = requestUrl.search;

  let body = undefined;
  let bodyBuffer = Buffer.alloc(0);
  let parsedBody = null;
  if (!["GET", "HEAD"].includes(request.method)) {
    bodyBuffer = Buffer.from(await request.arrayBuffer());
    const bodyText = bodyBuffer.toString("utf8");
    parsedBody = tryParseJson(bodyBuffer, request.headers.get("content-type"));

    if (route.requestKind === "chat_completions" && parsedBody?.stream === true) {
      const nextPayload = {
        ...parsedBody,
        stream_options: {
          ...(parsedBody.stream_options ?? {}),
          include_usage: true,
        },
      };
      body = JSON.stringify(nextPayload);
      bodyBuffer = Buffer.from(body, "utf8");
      parsedBody = nextPayload;
    } else {
      body = bodyBuffer.length > 0 ? bodyBuffer : undefined;
    }

    if (bodyText.length === 0) {
      parsedBody = null;
    }
  }

  return {
    method: request.method,
    headers: sanitizeForwardHeaders(request.headers),
    upstream_url: upstreamUrl.toString(),
    body,
    request_kind: route.requestKind,
    request_hash: createHash("sha256").update(bodyBuffer).digest("hex"),
    model: String(parsedBody?.model ?? run.model ?? ""),
    metadata: {
      upstream_url: upstreamUrl.toString(),
      request_body_bytes: bodyBuffer.length,
      request_content_type: request.headers.get("content-type") ?? "",
      stream: Boolean(parsedBody?.stream),
    },
  };
}

async function persistProxyCall({
  serviceStorageRoot,
  route,
  run,
  preparedRequest,
  responseInfo,
} = {}) {
  const existingCapture = await loadAgentRunCapture({
    serviceStorageRoot,
    runId: run.run_id,
  });
  const llmCall = await writeLlmCallRecord({
    serviceStorageRoot,
    call: {
      llm_call_id: randomUUID(),
      run_id: run.run_id,
      sequence: Number(existingCapture?.llm_calls?.length ?? 0) + 1,
      provider: route.provider,
      model: preparedRequest.model || run.model,
      request_kind: route.requestKind,
      method: preparedRequest.method ?? "POST",
      path: route.upstreamPath,
      status_code: responseInfo.status_code,
      latency_ms: responseInfo.latency_ms,
      prompt_tokens: responseInfo.usage.prompt_tokens,
      completion_tokens: responseInfo.usage.completion_tokens,
      total_tokens: responseInfo.usage.total_tokens,
      reasoning_tokens: responseInfo.usage.reasoning_tokens,
      cached_input_tokens: responseInfo.usage.cached_input_tokens,
      cost_usd: calculateUsageCostUsd(responseInfo.usage, run.pricing),
      usage_available: responseInfo.usage.usage_available,
      request_hash: preparedRequest.request_hash,
      response_id: responseInfo.response_id,
      metadata: {
        ...preparedRequest.metadata,
        ...responseInfo.metadata,
      },
    },
  });
  const refreshedCapture = await loadAgentRunCapture({
    serviceStorageRoot,
    runId: run.run_id,
  });

  await writeAgentRunRecord({
    serviceStorageRoot,
    run: {
      ...run,
      provider: llmCall.provider || run.provider,
      model: llmCall.model || run.model,
      total_tokens: refreshedCapture?.summary?.total_tokens ?? run.total_tokens,
      token_cost_usd: refreshedCapture?.summary?.token_cost_usd ?? run.token_cost_usd,
      observed_usage_coverage_pct:
        refreshedCapture?.summary?.observed_usage_coverage_pct ?? run.observed_usage_coverage_pct,
      measurement: refreshedCapture?.summary ?? run.measurement,
    },
  });

  return llmCall;
}

function extractUsageFromSseText(rawText = "") {
  let lastUsage = createEmptyUsageSummary();
  let responseId = "";

  for (const eventPayload of parseSsePayloads(rawText)) {
    const usage = extractUsageSummary(eventPayload);
    if (usage.usage_available) {
      lastUsage = usage;
    }
    responseId = extractResponseId(eventPayload) || responseId;
  }

  return {
    usage: lastUsage,
    response_id: responseId,
  };
}

function parseSsePayloads(rawText = "") {
  return String(rawText)
    .split("\n\n")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, "").trim()),
    )
    .flat()
    .filter((line) => line && line !== "[DONE]")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function extractUsageSummary(payload) {
  const usage = payload?.usage ?? payload?.response?.usage ?? payload?.data?.usage ?? null;
  if (!usage || typeof usage !== "object") {
    return createEmptyUsageSummary();
  }

  const promptTokens = numberOrZero(usage.prompt_tokens ?? usage.input_tokens);
  const completionTokens = numberOrZero(usage.completion_tokens ?? usage.output_tokens);
  const totalTokens = numberOrZero(usage.total_tokens) || promptTokens + completionTokens;

  return {
    usage_available: totalTokens > 0 || promptTokens > 0 || completionTokens > 0,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    reasoning_tokens: numberOrZero(
      usage.completion_tokens_details?.reasoning_tokens ??
        usage.output_tokens_details?.reasoning_tokens,
    ),
    cached_input_tokens: numberOrZero(
      usage.prompt_tokens_details?.cached_tokens ??
        usage.input_tokens_details?.cached_tokens,
    ),
  };
}

function createEmptyUsageSummary() {
  return {
    usage_available: false,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    reasoning_tokens: 0,
    cached_input_tokens: 0,
  };
}

function extractResponseId(payload) {
  return String(payload?.id ?? payload?.response?.id ?? payload?.data?.id ?? "");
}

function calculateUsageCostUsd(usage = {}, pricing = {}) {
  const inputRate = numberOrZero(pricing?.input_cost_per_1m);
  const cachedInputRate = numberOrZero(
    pricing?.cached_input_cost_per_1m ?? pricing?.input_cost_per_1m,
  );
  const outputRate = numberOrZero(pricing?.output_cost_per_1m);
  const promptTokens = numberOrZero(usage.prompt_tokens);
  const cachedInputTokens = Math.min(promptTokens, numberOrZero(usage.cached_input_tokens));
  const uncachedInputTokens = Math.max(0, promptTokens - cachedInputTokens);
  const completionTokens = numberOrZero(usage.completion_tokens);

  if (inputRate <= 0 && cachedInputRate <= 0 && outputRate <= 0) {
    return 0;
  }

  return roundNumber(
    (uncachedInputTokens * inputRate +
      cachedInputTokens * cachedInputRate +
      completionTokens * outputRate) /
      1_000_000,
    6,
  );
}

function sanitizeForwardHeaders(headers) {
  const nextHeaders = new Headers();
  headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if ([
      "host",
      "content-length",
      "connection",
      "cookie",
      "x-be-ai-heart-proxy-token",
      "x-be-ai-heart-session",
      "x-be-ai-heart-csrf",
    ].includes(normalizedKey)) {
      return;
    }
    nextHeaders.set(key, value);
  });
  return nextHeaders;
}

function validateProxyAuthorization(request, config) {
  const expected = String(config?.llmProxy?.sharedSecret ?? "").trim();
  if (!expected) {
    return null;
  }
  const received = String(request.headers.get("x-be-ai-heart-proxy-token") ?? "").trim();
  if (received && safeEqual(received, expected)) {
    return null;
  }
  return jsonResponse({
    error: "LLM proxy authorization failed.",
    error_code: "LLM_PROXY_UNAUTHORIZED",
  }, { status: 401 });
}

function validateAllowedUpstream(upstreamUrl, config) {
  const allowedOrigins = new Set((config?.llmProxy?.allowedOrigins ?? []).map((origin) => String(origin).trim()).filter(Boolean));
  if (allowedOrigins.size === 0) {
    return null;
  }
  const origin = new URL(upstreamUrl).origin;
  if (allowedOrigins.has(origin)) {
    return null;
  }
  return jsonResponse({
    error: "LLM proxy upstream is not allowlisted.",
    error_code: "LLM_PROXY_UPSTREAM_DENIED",
  }, { status: 403 });
}

function safeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function cloneResponseHeaders(headers) {
  const nextHeaders = new Headers();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === "content-length") {
      continue;
    }
    nextHeaders.set(key, value);
  }
  return nextHeaders;
}

function isStreamingContentType(value) {
  return String(value ?? "").toLowerCase().includes("text/event-stream");
}

function resolveDefaultUpstreamBaseUrl(provider) {
  switch (provider) {
    case "openai":
    default:
      return DEFAULT_OPENAI_UPSTREAM_BASE_URL;
  }
}

function ensureTrailingSlash(value) {
  return String(value ?? "").endsWith("/") ? String(value) : `${String(value)}/`;
}

function tryParseJson(buffer, contentType) {
  const safeContentType = String(contentType ?? "").toLowerCase();
  if (!safeContentType.includes("json")) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(buffer ?? []).toString("utf8"));
  } catch {
    return null;
  }
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundNumber(value, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(numberOrZero(value) * factor) / factor;
}

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      ...(init.headers ?? {}),
    },
  });
}

async function sendUpstreamRequest({ url, method, headers, body } = {}) {
  const bodyBuffer =
    body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  const response = await fetch(url, {
    method,
    headers,
    body: bodyBuffer?.length ? bodyBuffer : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(STREAM_USAGE_TIMEOUT_MS),
  });

  return {
    status_code: Number(response.status ?? 502),
    status_text: String(response.statusText ?? ""),
    headers: Object.fromEntries(response.headers.entries()),
    body: Buffer.from(await response.arrayBuffer()),
  };
}
