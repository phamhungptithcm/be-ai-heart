import {
  createHash,
  createHmac,
} from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getModelPricing,
  getProviderDefinition,
  listProviderModels,
  redactProviderSecrets,
  resolveProviderBaseUrl,
  resolveProviderCredential,
} from "../../model-registry/src/index.js";

const DEFAULT_TIMEOUT_MS = 120_000;

export function createProviderClient({
  providerId,
  credential,
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const provider = getProviderDefinition(providerId);
  const resolvedCredential = resolveProviderCredential({
    providerId: provider.provider_id,
    credential,
    env,
  });
  const aws = resolveAwsCredentials({ credential, env, provider });
  return {
    provider,
    credential: resolvedCredential,
    aws,
    env,
    baseUrl: provider.auth_method === "aws_sigv4"
      ? resolveBedrockRuntimeBaseUrl(provider, env, aws)
      : resolveProviderBaseUrl(provider, { env }),
    fetchImpl,
    timeoutMs,
  };
}

export async function validateProviderCredential(options = {}) {
  const client = createProviderClient(options);
  if (client.provider.auth_method === "aws_sigv4") {
    return validateBedrockCredential(client);
  }
  if (client.provider.requires_api_key && !client.credential.api_key) {
    return {
      ok: false,
      provider_id: client.provider.provider_id,
      status: "missing_key",
      message: `No API key configured for ${client.provider.label}.`,
      models: [],
    };
  }

  const result = await listProviderModels({
    providerId: client.provider.provider_id,
    credential: client.credential,
    env: options.env,
    fetchImpl: client.fetchImpl,
    dynamic: true,
    includeFallbackOnError: false,
    timeoutMs: options.timeoutMs ?? 10_000,
  }).catch((error) => ({
    error: mapProviderError(error, { providerId: client.provider.provider_id }),
  }));

  if (result.error) {
    return {
      ok: false,
      provider_id: client.provider.provider_id,
      status: result.error.code,
      message: result.error.message,
      models: [],
    };
  }

  return {
    ok: true,
    provider_id: client.provider.provider_id,
    status: "ok",
    message: `${client.provider.label} key can list models.`,
    model_count: result.models.length,
    models: result.models.slice(0, 20),
  };
}

async function validateBedrockCredential(client) {
  const credentialError = await ensureAwsRuntimeCredentials(client).then(() => null).catch((error) => mapProviderError(error, {
    providerId: client.provider.provider_id,
  }));
  if (credentialError) {
    return {
      ok: false,
      provider_id: client.provider.provider_id,
      status: credentialError.code,
      message: credentialError.message,
      models: [],
    };
  }
  if (!hasSignableAwsCredentials(client.aws)) {
    return {
      ok: false,
      provider_id: client.provider.provider_id,
      status: "missing_aws_credentials",
      message: "Bedrock live validation requires signable AWS credentials. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS_PROFILE for a static or assume-role profile.",
      models: [],
    };
  }
  if (typeof client.fetchImpl !== "function") {
    return {
      ok: false,
      provider_id: client.provider.provider_id,
      status: "fetch_unavailable",
      message: "No fetch implementation is available.",
      models: [],
    };
  }

  const result = await fetchAwsJson(client, "/foundation-models", {
    method: "GET",
    baseUrl: resolveBedrockControlBaseUrl(client),
    service: "bedrock",
  }).catch((error) => ({
    error: mapProviderError(error, { providerId: client.provider.provider_id }),
  }));

  if (result.error) {
    return {
      ok: false,
      provider_id: client.provider.provider_id,
      status: result.error.code,
      message: result.error.message,
      models: [],
    };
  }

  const models = (result.modelSummaries ?? []).map((entry) => ({
    schema_version: 1,
    provider_id: client.provider.provider_id,
    model_id: String(entry.modelId ?? ""),
    label: String(entry.modelName ?? entry.modelId ?? ""),
    provider_name: String(entry.providerName ?? ""),
    response_streaming_supported: Boolean(entry.responseStreamingSupported),
    input_modalities: entry.inputModalities ?? [],
    output_modalities: entry.outputModalities ?? [],
  })).filter((entry) => entry.model_id);

  return {
    ok: true,
    provider_id: client.provider.provider_id,
    status: "ok",
    message: `${client.provider.label} SigV4 credentials can list foundation models.`,
    model_count: models.length,
    models: models.slice(0, 20),
  };
}

export async function sendModelRequest({
  providerId,
  modelId,
  model,
  messages = [],
  system,
  credential,
  env = process.env,
  fetchImpl = globalThis.fetch,
  maxOutputTokens = 2000,
  temperature,
  tools = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const client = createProviderClient({
    providerId,
    credential,
    env,
    fetchImpl,
    timeoutMs,
  });
  const selectedModel = normalizeModelId(modelId ?? model);
  if (!selectedModel) {
    throw createGatewayError("model_required", "A model is required before sending chat.");
  }
  if (client.provider.auth_method === "aws_sigv4") {
    await ensureAwsRuntimeCredentials(client);
    if (!hasSignableAwsCredentials(client.aws)) {
      throw createGatewayError(
        "missing_aws_credentials",
        `No signable AWS credentials configured for ${client.provider.label}. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS_PROFILE.`,
        { provider_id: client.provider.provider_id },
      );
    }
  }
  if (client.provider.auth_method !== "aws_sigv4" && client.provider.requires_api_key && !client.credential.api_key) {
    throw createGatewayError(
      "missing_key",
      `No API key configured for ${client.provider.label}.`,
      { provider_id: client.provider.provider_id },
    );
  }
  if (typeof fetchImpl !== "function") {
    throw createGatewayError("fetch_unavailable", "No fetch implementation is available.");
  }

  const normalizedMessages = normalizeMessages(messages);
  try {
    if (client.provider.chat_method === "responses") {
      return await sendOpenAiResponsesRequest(client, {
        model: selectedModel,
        messages: normalizedMessages,
        system,
        maxOutputTokens,
        temperature,
        tools,
      });
    }
    if (client.provider.chat_method === "messages") {
      return await sendAnthropicMessagesRequest(client, {
        model: selectedModel,
        messages: normalizedMessages,
        system,
        maxOutputTokens,
        temperature,
        tools,
      });
    }
    if (client.provider.chat_method === "generate_content") {
      return await sendGeminiGenerateContentRequest(client, {
        model: selectedModel,
        messages: normalizedMessages,
        system,
        maxOutputTokens,
        temperature,
      });
    }
    if (client.provider.chat_method === "ollama_chat") {
      return await sendOllamaChatRequest(client, {
        model: selectedModel,
        messages: normalizedMessages,
        system,
        maxOutputTokens,
        temperature,
      });
    }
    if (client.provider.chat_method === "bedrock_converse") {
      return await sendBedrockConverseRequest(client, {
        model: selectedModel,
        messages: normalizedMessages,
        system,
        maxOutputTokens,
        temperature,
        tools,
      });
    }
    return await sendOpenAiCompatibleChatRequest(client, {
      model: selectedModel,
      messages: normalizedMessages,
      system,
      maxOutputTokens,
      temperature,
      tools,
    });
  } catch (error) {
    throw mapProviderError(error, { providerId: client.provider.provider_id });
  }
}

export async function* streamModelResponse(options = {}) {
  const runId = options.runId ?? `run-${Date.now().toString(36)}`;
  yield {
    event: "run_started",
    run_id: runId,
    provider_id: options.providerId,
    model_id: options.modelId ?? options.model,
    created_at: new Date().toISOString(),
  };

  try {
    if (options.native === false) {
      yield* streamFromNonStreamingResponse(options, runId);
      return;
    }
    yield* streamNativeProviderResponse(options, runId);
  } catch (error) {
    if (options.fallbackOnStreamError === false) {
      yield {
        event: "run_failed",
        run_id: runId,
        error: mapProviderError(error, { providerId: options.providerId }),
      };
      return;
    }
    yield* streamFromNonStreamingResponse(options, runId);
  }
}

async function* streamFromNonStreamingResponse(options, runId) {
  try {
    const response = await sendModelRequest(options);
    const chunks = chunkText(response.output_text, 120);
    for (const chunk of chunks) {
      yield {
        event: "assistant_delta",
        run_id: runId,
        delta: chunk,
      };
    }
    yield {
      event: "usage",
      run_id: runId,
      usage: response.usage,
      cost: response.cost,
    };
    yield {
      event: "run_completed",
      run_id: runId,
      response,
    };
  } catch (error) {
    yield {
      event: "run_failed",
      run_id: runId,
      error: mapProviderError(error, { providerId: options.providerId }),
    };
  }
}

async function* streamNativeProviderResponse(options, runId) {
  const client = createProviderClient({
    providerId: options.providerId,
    credential: options.credential,
    env: options.env,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  const selectedModel = normalizeModelId(options.modelId ?? options.model);
  if (!selectedModel) {
    throw createGatewayError("model_required", "A model is required before sending chat.");
  }
  if (client.provider.auth_method === "aws_sigv4") {
    await ensureAwsRuntimeCredentials(client);
    if (!hasSignableAwsCredentials(client.aws)) {
      throw createGatewayError(
        "missing_aws_credentials",
        `No signable AWS credentials configured for ${client.provider.label}. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS_PROFILE.`,
        { provider_id: client.provider.provider_id },
      );
    }
  }
  if (client.provider.auth_method !== "aws_sigv4" && client.provider.requires_api_key && !client.credential.api_key) {
    throw createGatewayError(
      "missing_key",
      `No API key configured for ${client.provider.label}.`,
      { provider_id: client.provider.provider_id },
    );
  }
  if (typeof client.fetchImpl !== "function") {
    throw createGatewayError("fetch_unavailable", "No fetch implementation is available.");
  }
  if (client.provider.chat_method === "bedrock_converse") {
    yield* streamBedrockConverseResponse(client, {
      model: selectedModel,
      messages: normalizeMessages(options.messages),
      system: options.system,
      maxOutputTokens: options.maxOutputTokens ?? 2000,
      temperature: options.temperature,
      tools: options.tools ?? [],
    }, runId);
    return;
  }

  const normalizedMessages = normalizeMessages(options.messages);
  const request = createStreamingRequest(client, {
    model: selectedModel,
    messages: normalizedMessages,
    system: options.system,
    maxOutputTokens: options.maxOutputTokens ?? 2000,
    temperature: options.temperature,
    tools: options.tools ?? [],
  });
  const response = await fetchStream(client, request.path, request);
  let outputText = "";
  let usage = trackTokenUsage({});
  let rawFinal = { streamed: true };
  let usageEmitted = false;

  for await (const payload of parseProviderStream(response.body)) {
    if (payload.done) {
      continue;
    }
    const normalized = normalizeStreamPayload(client.provider.provider_id, payload);
    if (normalized.delta) {
      outputText += normalized.delta;
      yield {
        event: "assistant_delta",
        run_id: runId,
        delta: normalized.delta,
      };
    }
    if (normalized.tool_calls?.length) {
      yield {
        event: "tool_call_delta",
        run_id: runId,
        tool_calls: redactProviderSecrets(normalized.tool_calls),
      };
    }
    if (normalized.usage) {
      usage = trackTokenUsage(normalized.usage);
      usageEmitted = true;
      yield {
        event: "usage",
        run_id: runId,
        usage,
        cost: estimateProviderCost({ providerId: client.provider.provider_id, modelId: selectedModel, usage }),
      };
    }
    if (normalized.final) {
      rawFinal = normalized.final;
    }
    if (normalized.error) {
      throw createGatewayError(
        normalized.error.code ?? "provider_error",
        normalized.error.message ?? "Provider stream failed.",
        { status: normalized.error.status },
      );
    }
  }

  const responsePayload = normalizeGatewayResponse({
    providerId: client.provider.provider_id,
    modelId: selectedModel,
    outputText,
    raw: rawFinal,
    usage,
  });
  if (!usageEmitted) {
    yield {
      event: "usage",
      run_id: runId,
      usage,
      cost: responsePayload.cost,
    };
  }
  yield {
    event: "run_completed",
    run_id: runId,
    response: responsePayload,
  };
}

export function mapProviderError(error, { providerId } = {}) {
  if (error?.code && error?.message) {
    return {
      name: "BeHeartProviderError",
      code: error.code,
      provider_id: providerId ?? error.provider_id ?? "",
      message: redactMessage(error.message),
      retryable: Boolean(error.retryable),
      status: error.status ?? error.details?.status ?? null,
    };
  }

  const status = Number(error?.status ?? error?.details?.status ?? 0);
  const code =
    status === 401 || status === 403
      ? "auth_error"
      : status === 404
        ? "model_not_found"
        : status === 408 || status === 429
          ? "rate_limited"
          : status >= 500
            ? "provider_unavailable"
            : error?.name === "AbortError"
              ? "request_timeout"
              : "provider_error";

  return {
    name: "BeHeartProviderError",
    code,
    provider_id: providerId ?? "",
    message: redactMessage(error?.message ?? "Provider request failed."),
    retryable: ["rate_limited", "provider_unavailable", "request_timeout"].includes(code),
    status: status || null,
  };
}

export function estimateProviderCost({ providerId, modelId, usage, modelMetadata } = {}) {
  const pricing = modelMetadata?.pricing ?? getModelPricing({ providerId, modelId }) ?? null;
  if (!pricing || (pricing.input_per_1m == null && pricing.output_per_1m == null)) {
    return {
      currency: "USD",
      estimated_total: null,
      source: "unavailable",
    };
  }
  const inputTokens = Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0);
  const outputTokens = Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0);
  return {
    currency: pricing.currency ?? "USD",
    estimated_input: price(inputTokens, pricing.input_per_1m),
    estimated_output: price(outputTokens, pricing.output_per_1m),
    estimated_total: price(inputTokens, pricing.input_per_1m) + price(outputTokens, pricing.output_per_1m),
    source: pricing.source ?? "model_metadata",
  };
}

export function trackTokenUsage(usage = {}) {
  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.input ?? 0);
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? usage.output ?? 0);
  const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens);
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cached_input_tokens: Number(usage.cached_input_tokens ?? usage.input_token_details?.cached_tokens ?? 0),
  };
}

export { listProviderModels, redactProviderSecrets };

async function sendOpenAiResponsesRequest(client, options) {
  const body = compactObject({
    model: options.model,
    input: toOpenAiResponsesInput(options.messages, options.system),
    max_output_tokens: options.maxOutputTokens,
    temperature: options.temperature,
    tools: normalizeOpenAiTools(options.tools),
    stream: false,
    store: false,
  });
  const payload = await fetchJson(client, "/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.credential.api_key}`,
      "Content-Type": "application/json",
    },
    body,
  });
  const usage = trackTokenUsage(payload.usage ?? {});
  return normalizeGatewayResponse({
    providerId: client.provider.provider_id,
    modelId: payload.model ?? options.model,
    outputText: extractOpenAiResponseText(payload),
    raw: payload,
    usage,
  });
}

async function sendAnthropicMessagesRequest(client, options) {
  const body = compactObject({
    model: options.model,
    max_tokens: options.maxOutputTokens,
    system: options.system || undefined,
    messages: options.messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    })),
    temperature: options.temperature,
    tools: normalizeAnthropicTools(options.tools),
    stream: false,
  });
  const payload = await fetchJson(client, "/messages", {
    method: "POST",
    headers: {
      "x-api-key": client.credential.api_key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body,
  });
  const usage = trackTokenUsage(payload.usage ?? {});
  return normalizeGatewayResponse({
    providerId: client.provider.provider_id,
    modelId: payload.model ?? options.model,
    outputText: extractAnthropicText(payload),
    raw: payload,
    usage,
  });
}

async function sendGeminiGenerateContentRequest(client, options) {
  const body = compactObject({
    systemInstruction: options.system
      ? {
          parts: [{ text: options.system }],
        }
      : undefined,
    contents: options.messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    generationConfig: compactObject({
      maxOutputTokens: options.maxOutputTokens,
      temperature: options.temperature,
    }),
  });
  const path = `/models/${encodeURIComponent(options.model)}:generateContent?key=${encodeURIComponent(client.credential.api_key)}`;
  const payload = await fetchJson(client, path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
  const usage = trackTokenUsage({
    input_tokens: payload.usageMetadata?.promptTokenCount,
    output_tokens: payload.usageMetadata?.candidatesTokenCount,
    total_tokens: payload.usageMetadata?.totalTokenCount,
  });
  return normalizeGatewayResponse({
    providerId: client.provider.provider_id,
    modelId: options.model,
    outputText: extractGeminiText(payload),
    raw: payload,
    usage,
  });
}

async function sendOpenAiCompatibleChatRequest(client, options) {
  const messages = options.system
    ? [{ role: "system", content: options.system }, ...options.messages]
    : options.messages;
  const body = compactObject({
    model: options.model,
    messages,
    max_tokens: options.maxOutputTokens,
    temperature: options.temperature,
    tools: normalizeOpenAiCompatibleTools(options.tools),
    stream: false,
  });
  const payload = await fetchJson(client, "/chat/completions", {
    method: "POST",
    headers: {
      ...(client.credential.api_key ? { Authorization: `Bearer ${client.credential.api_key}` } : {}),
      "Content-Type": "application/json",
      ...(client.provider.provider_id === "openrouter"
        ? {
            "HTTP-Referer": "https://beheart.dev",
            "X-Title": "BeHeart",
          }
        : {}),
    },
    body,
  });
  const usage = trackTokenUsage(payload.usage ?? {});
  return normalizeGatewayResponse({
    providerId: client.provider.provider_id,
    modelId: payload.model ?? options.model,
    outputText: payload.choices?.[0]?.message?.content ?? "",
    raw: payload,
    usage,
  });
}

async function sendOllamaChatRequest(client, options) {
  const messages = options.system
    ? [{ role: "system", content: options.system }, ...options.messages]
    : options.messages;
  const payload = await fetchJson(client, "/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: compactObject({
      model: options.model,
      messages,
      stream: false,
      options: compactObject({
        temperature: options.temperature,
        num_predict: options.maxOutputTokens,
      }),
    }),
  });
  const usage = trackTokenUsage({
    input_tokens: payload.prompt_eval_count,
    output_tokens: payload.eval_count,
    total_tokens: Number(payload.prompt_eval_count ?? 0) + Number(payload.eval_count ?? 0),
  });
  return normalizeGatewayResponse({
    providerId: client.provider.provider_id,
    modelId: payload.model ?? options.model,
    outputText: payload.message?.content ?? payload.response ?? "",
    raw: payload,
    usage,
  });
}

async function sendBedrockConverseRequest(client, options) {
  const body = createBedrockConverseBody(options);
  const payload = await fetchAwsJson(client, `/model/${encodeURIComponent(options.model)}/converse`, {
    method: "POST",
    baseUrl: client.baseUrl,
    service: "bedrock",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
  const usage = trackTokenUsage({
    input_tokens: payload.usage?.inputTokens,
    output_tokens: payload.usage?.outputTokens,
    total_tokens: payload.usage?.totalTokens,
  });
  return normalizeGatewayResponse({
    providerId: client.provider.provider_id,
    modelId: options.model,
    outputText: extractBedrockText(payload),
    raw: payload,
    usage,
  });
}

async function* streamBedrockConverseResponse(client, options, runId) {
  const response = await fetchAwsStream(client, `/model/${encodeURIComponent(options.model)}/converse-stream`, {
    method: "POST",
    baseUrl: client.baseUrl,
    service: "bedrock",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/vnd.amazon.eventstream",
    },
    body: createBedrockConverseBody(options),
  });

  let outputText = "";
  let usage = trackTokenUsage({});
  let rawFinal = { streamed: true };
  let usageEmitted = false;

  for await (const message of parseAwsEventStream(response.body)) {
    const normalized = normalizeBedrockStreamEvent(message);
    if (normalized.delta) {
      outputText += normalized.delta;
      yield {
        event: "assistant_delta",
        run_id: runId,
        delta: normalized.delta,
      };
    }
    if (normalized.tool_calls?.length) {
      yield {
        event: "tool_call_delta",
        run_id: runId,
        tool_calls: redactProviderSecrets(normalized.tool_calls),
      };
    }
    if (normalized.usage) {
      usage = trackTokenUsage(normalized.usage);
      usageEmitted = true;
      yield {
        event: "usage",
        run_id: runId,
        usage,
        cost: estimateProviderCost({ providerId: client.provider.provider_id, modelId: options.model, usage }),
      };
    }
    if (normalized.final) {
      rawFinal = normalized.final;
    }
    if (normalized.error) {
      throw createGatewayError(
        normalized.error.code ?? "provider_error",
        normalized.error.message ?? "AWS Bedrock stream failed.",
        { status: normalized.error.status },
      );
    }
  }

  const responsePayload = normalizeGatewayResponse({
    providerId: client.provider.provider_id,
    modelId: options.model,
    outputText,
    raw: rawFinal,
    usage,
  });
  if (!usageEmitted) {
    yield {
      event: "usage",
      run_id: runId,
      usage,
      cost: responsePayload.cost,
    };
  }
  yield {
    event: "run_completed",
    run_id: runId,
    response: responsePayload,
  };
}

function createBedrockConverseBody(options) {
  return compactObject({
    system: options.system ? [{ text: options.system }] : undefined,
    messages: options.messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: [{ text: message.content }],
    })),
    inferenceConfig: compactObject({
      maxTokens: options.maxOutputTokens,
      temperature: options.temperature,
    }),
    toolConfig: normalizeBedrockTools(options.tools),
    requestMetadata: {
      app: "beheart",
    },
  });
}

function createStreamingRequest(client, options) {
  if (client.provider.chat_method === "responses") {
    return {
      path: "/responses",
      method: "POST",
      headers: {
        Authorization: `Bearer ${client.credential.api_key}`,
        "Content-Type": "application/json",
      },
      body: compactObject({
        model: options.model,
        input: toOpenAiResponsesInput(options.messages, options.system),
        max_output_tokens: options.maxOutputTokens,
        temperature: options.temperature,
        tools: normalizeOpenAiTools(options.tools),
        stream: true,
        store: false,
      }),
    };
  }

  if (client.provider.chat_method === "messages") {
    return {
      path: "/messages",
      method: "POST",
      headers: {
        "x-api-key": client.credential.api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: compactObject({
        model: options.model,
        max_tokens: options.maxOutputTokens,
        system: options.system || undefined,
        messages: options.messages.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
        temperature: options.temperature,
        tools: normalizeAnthropicTools(options.tools),
        stream: true,
      }),
    };
  }

  if (client.provider.chat_method === "generate_content") {
    return {
      path: `/models/${encodeURIComponent(options.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(client.credential.api_key)}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: compactObject({
        systemInstruction: options.system
          ? {
              parts: [{ text: options.system }],
            }
          : undefined,
        contents: options.messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: compactObject({
          maxOutputTokens: options.maxOutputTokens,
          temperature: options.temperature,
        }),
      }),
    };
  }

  if (client.provider.chat_method === "ollama_chat") {
    const messages = options.system
      ? [{ role: "system", content: options.system }, ...options.messages]
      : options.messages;
    return {
      path: "/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: compactObject({
        model: options.model,
        messages,
        stream: true,
        options: compactObject({
          temperature: options.temperature,
          num_predict: options.maxOutputTokens,
        }),
      }),
    };
  }

  const messages = options.system
    ? [{ role: "system", content: options.system }, ...options.messages]
    : options.messages;
  return {
    path: "/chat/completions",
    method: "POST",
    headers: {
      ...(client.credential.api_key ? { Authorization: `Bearer ${client.credential.api_key}` } : {}),
      "Content-Type": "application/json",
      ...(client.provider.provider_id === "openrouter"
        ? {
            "HTTP-Referer": "https://beheart.dev",
            "X-Title": "BeHeart",
          }
        : {}),
    },
    body: compactObject({
      model: options.model,
      messages,
      max_tokens: options.maxOutputTokens,
      temperature: options.temperature,
      tools: normalizeOpenAiCompatibleTools(options.tools),
      stream: true,
    }),
  };
}

async function fetchStream(client, requestPath, { method, headers, body }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), client.timeoutMs);
  try {
    const response = await client.fetchImpl(buildProviderUrl(client.baseUrl, requestPath), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      const payload = safeJsonParse(raw);
      throw createGatewayError(
        responseStatusCode(response.status),
        payload?.error?.message ?? payload?.message ?? `Provider stream failed with HTTP ${response.status}.`,
        { status: response.status },
      );
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(client, requestPath, { method, headers, body }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), client.timeoutMs);
  try {
    const response = await client.fetchImpl(buildProviderUrl(client.baseUrl, requestPath), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const raw = await response.text();
    const payload = safeJsonParse(raw);
    if (!response.ok) {
      throw createGatewayError(
        responseStatusCode(response.status),
        payload?.error?.message ?? payload?.message ?? `Provider request failed with HTTP ${response.status}.`,
        { status: response.status },
      );
    }
    return payload ?? {};
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAwsJson(client, requestPath, {
  method = "GET",
  headers = {},
  body,
  baseUrl = client.baseUrl,
  service = "bedrock",
} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), client.timeoutMs);
  const bodyText = body ? JSON.stringify(body) : "";
  const url = buildProviderUrl(baseUrl, requestPath);
  const signedHeaders = signAwsSigV4Request({
    url,
    method,
    headers,
    bodyText,
    credentials: client.aws,
    service,
  });
  try {
    const response = await client.fetchImpl(url, {
      method,
      headers: signedHeaders,
      body: bodyText || undefined,
      signal: controller.signal,
    });
    const raw = await response.text();
    const payload = safeJsonParse(raw);
    if (!response.ok) {
      throw createGatewayError(
        responseStatusCode(response.status),
        payload?.message ?? payload?.Message ?? payload?.error?.message ?? `AWS Bedrock request failed with HTTP ${response.status}.`,
        { status: response.status },
      );
    }
    return payload ?? {};
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAwsStream(client, requestPath, {
  method = "GET",
  headers = {},
  body,
  baseUrl = client.baseUrl,
  service = "bedrock",
} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), client.timeoutMs);
  const bodyText = body ? JSON.stringify(body) : "";
  const url = buildProviderUrl(baseUrl, requestPath);
  const signedHeaders = signAwsSigV4Request({
    url,
    method,
    headers,
    bodyText,
    credentials: client.aws,
    service,
  });
  try {
    const response = await client.fetchImpl(url, {
      method,
      headers: signedHeaders,
      body: bodyText || undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      const payload = safeJsonParse(raw);
      throw createGatewayError(
        responseStatusCode(response.status),
        payload?.message ?? payload?.Message ?? payload?.error?.message ?? `AWS Bedrock stream failed with HTTP ${response.status}.`,
        { status: response.status },
      );
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function* parseProviderStream(body) {
  let buffer = "";
  for await (const chunk of readStreamText(body)) {
    buffer += chunk.replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const payload of parseStreamBlock(block)) {
        yield payload;
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
  for (const payload of parseStreamBlock(buffer)) {
    yield payload;
  }
}

async function* parseAwsEventStream(body) {
  let buffer = Buffer.alloc(0);
  for await (const chunk of readStreamBytes(body)) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 12) {
      const totalLength = buffer.readUInt32BE(0);
      if (totalLength < 16) {
        throw createGatewayError("provider_stream_parse_error", "AWS event stream frame length is invalid.");
      }
      if (buffer.length < totalLength) {
        break;
      }
      const frame = buffer.subarray(0, totalLength);
      buffer = buffer.subarray(totalLength);
      yield decodeAwsEventStreamFrame(frame);
    }
  }
  if (buffer.length > 0) {
    throw createGatewayError("provider_stream_parse_error", "AWS event stream ended with a partial frame.");
  }
}

async function* readStreamBytes(body) {
  if (!body) {
    return;
  }
  if (typeof body.getReader === "function") {
    const reader = body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        yield Buffer.from(value);
      }
    } finally {
      reader.releaseLock?.();
    }
    return;
  }

  for await (const chunk of body) {
    yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  }
}

async function* readStreamText(body) {
  if (!body) {
    return;
  }
  const decoder = new TextDecoder();
  if (typeof body.getReader === "function") {
    const reader = body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        yield decoder.decode(value, { stream: true });
      }
      const tail = decoder.decode();
      if (tail) {
        yield tail;
      }
    } finally {
      reader.releaseLock?.();
    }
    return;
  }

  for await (const chunk of body) {
    yield typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
  }
  const tail = decoder.decode();
  if (tail) {
    yield tail;
  }
}

function decodeAwsEventStreamFrame(frame) {
  const totalLength = frame.readUInt32BE(0);
  const headersLength = frame.readUInt32BE(4);
  const headersStart = 12;
  const payloadStart = headersStart + headersLength;
  const payloadEnd = totalLength - 4;
  if (payloadStart > payloadEnd || payloadEnd > frame.length) {
    throw createGatewayError("provider_stream_parse_error", "AWS event stream frame boundaries are invalid.");
  }
  const headers = parseAwsEventStreamHeaders(frame.subarray(headersStart, payloadStart));
  const payloadText = new TextDecoder().decode(frame.subarray(payloadStart, payloadEnd));
  const payload = safeJsonParse(payloadText);
  return {
    headers,
    payload,
    payload_text: payloadText,
  };
}

function parseAwsEventStreamHeaders(buffer) {
  const headers = {};
  let offset = 0;
  while (offset < buffer.length) {
    const nameLength = buffer.readUInt8(offset);
    offset += 1;
    const name = buffer.subarray(offset, offset + nameLength).toString("utf8");
    offset += nameLength;
    const type = buffer.readUInt8(offset);
    offset += 1;
    const parsed = parseAwsEventStreamHeaderValue(buffer, offset, type);
    headers[name] = parsed.value;
    offset = parsed.offset;
  }
  return headers;
}

function parseAwsEventStreamHeaderValue(buffer, offset, type) {
  if (type === 0) return { value: true, offset };
  if (type === 1) return { value: false, offset };
  if (type === 2) return { value: buffer.readInt8(offset), offset: offset + 1 };
  if (type === 3) return { value: buffer.readInt16BE(offset), offset: offset + 2 };
  if (type === 4) return { value: buffer.readInt32BE(offset), offset: offset + 4 };
  if (type === 5 || type === 8) {
    return { value: Number(buffer.readBigInt64BE(offset)), offset: offset + 8 };
  }
  if (type === 6 || type === 7) {
    const length = buffer.readUInt16BE(offset);
    const start = offset + 2;
    const valueBuffer = buffer.subarray(start, start + length);
    return {
      value: type === 7 ? valueBuffer.toString("utf8") : valueBuffer,
      offset: start + length,
    };
  }
  if (type === 9) {
    return { value: buffer.subarray(offset, offset + 16).toString("hex"), offset: offset + 16 };
  }
  throw createGatewayError("provider_stream_parse_error", `Unsupported AWS event stream header type: ${type}.`);
}

function parseStreamBlock(block) {
  const rawBlock = String(block ?? "").trim();
  if (!rawBlock) {
    return [];
  }
  const lines = rawBlock.split("\n").map((line) => line.trim()).filter(Boolean);
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length > 0) {
    const data = dataLines.join("\n").trim();
    if (!data || data === "[DONE]") {
      return [{ done: true }];
    }
    return [safeJsonParse(data)].filter(Boolean);
  }

  const payloads = [];
  for (const line of lines) {
    const payload = safeJsonParse(line.replace(/^data:\s*/, ""));
    if (payload && Object.keys(payload).length > 0) {
      payloads.push(payload);
    }
  }
  if (payloads.length > 0) {
    return payloads;
  }

  const payload = safeJsonParse(rawBlock);
  return payload && Object.keys(payload).length > 0 ? [payload] : [];
}

function normalizeBedrockStreamEvent(message = {}) {
  const eventType = message.headers?.[":event-type"] ?? "";
  const payload = message.payload ?? {};
  if (eventType === "contentBlockDelta" || payload.contentBlockDelta) {
    const delta = payload.contentBlockDelta?.delta ?? {};
    if (delta.text) {
      return { delta: String(delta.text) };
    }
    if (delta.toolUse) {
      return {
        tool_calls: [{
          id: delta.toolUse.toolUseId ?? "",
          name: delta.toolUse.name ?? "",
          arguments_delta: delta.toolUse.input ? JSON.stringify(delta.toolUse.input) : "",
        }],
      };
    }
  }
  if (eventType === "metadata" || payload.metadata) {
    const usage = payload.metadata?.usage ?? {};
    return {
      usage: {
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        total_tokens: usage.totalTokens,
        cached_input_tokens: usage.cacheReadInputTokens,
      },
      final: payload,
    };
  }
  if (eventType === "messageStop" || payload.messageStop) {
    return { final: payload };
  }
  const errorPayload = payload.internalServerException ??
    payload.modelStreamErrorException ??
    payload.serviceUnavailableException ??
    payload.throttlingException ??
    payload.validationException;
  if (errorPayload || /exception$/i.test(eventType)) {
    const status = eventType === "throttlingException"
      ? 429
      : eventType === "serviceUnavailableException"
        ? 503
        : eventType === "validationException"
          ? 400
          : 500;
    return {
      error: {
        code: responseStatusCode(status),
        message: errorPayload?.message ?? `AWS Bedrock stream event ${eventType || "exception"} failed.`,
        status,
      },
    };
  }
  return {};
}

function normalizeStreamPayload(providerId, payload = {}) {
  if (payload.error) {
    return {
      error: {
        code: payload.error.code,
        message: payload.error.message ?? String(payload.error),
        status: payload.error.status,
      },
    };
  }

  if (providerId === "openai") {
    if (payload.type === "response.output_text.delta") {
      return { delta: String(payload.delta ?? "") };
    }
    if (payload.type === "response.function_call_arguments.delta") {
      return {
        tool_calls: [{ id: payload.item_id ?? "", name: payload.name ?? "", arguments_delta: payload.delta ?? "" }],
      };
    }
    if (payload.type === "response.completed") {
      return {
        final: payload.response ?? payload,
        usage: payload.response?.usage,
      };
    }
    if (payload.type === "response.failed") {
      return {
        error: {
          code: payload.response?.error?.code ?? "provider_error",
          message: payload.response?.error?.message ?? "OpenAI response stream failed.",
        },
      };
    }
    if (typeof payload.delta === "string") {
      return { delta: payload.delta };
    }
    if (payload.output_text) {
      return {
        delta: String(payload.output_text),
        usage: payload.usage,
        final: payload,
      };
    }
  }

  if (providerId === "anthropic") {
    if (payload.type === "content_block_delta") {
      return { delta: String(payload.delta?.text ?? "") };
    }
    if (payload.type === "content_block_start" && payload.content_block?.type === "tool_use") {
      return {
        tool_calls: [{
          id: payload.content_block.id ?? "",
          name: payload.content_block.name ?? "",
          arguments_delta: "",
        }],
      };
    }
    if (payload.type === "message_delta") {
      return { usage: payload.usage };
    }
    if (payload.type === "message_stop") {
      return { final: payload };
    }
  }

  if (providerId === "gemini") {
    return {
      delta: extractGeminiText(payload),
      usage: payload.usageMetadata
        ? {
            input_tokens: payload.usageMetadata.promptTokenCount,
            output_tokens: payload.usageMetadata.candidatesTokenCount,
            total_tokens: payload.usageMetadata.totalTokenCount,
          }
        : undefined,
      final: payload.usageMetadata ? payload : undefined,
    };
  }

  if (providerId === "ollama") {
    return {
      delta: String(payload.message?.content ?? payload.response ?? ""),
      usage: payload.done
        ? {
            input_tokens: payload.prompt_eval_count,
            output_tokens: payload.eval_count,
            total_tokens: Number(payload.prompt_eval_count ?? 0) + Number(payload.eval_count ?? 0),
          }
        : undefined,
      final: payload.done ? payload : undefined,
    };
  }

  const choice = payload.choices?.[0];
  return {
    delta: String(choice?.delta?.content ?? ""),
    tool_calls: choice?.delta?.tool_calls,
    usage: payload.usage,
    final: choice?.finish_reason ? payload : undefined,
  };
}

function normalizeGatewayResponse({ providerId, modelId, outputText, raw, usage }) {
  return {
    schema_version: 1,
    provider_id: providerId,
    model_id: modelId,
    output_text: String(outputText ?? ""),
    usage,
    cost: estimateProviderCost({ providerId, modelId, usage }),
    raw_response: redactProviderSecrets(raw),
  };
}

function normalizeMessages(messages = []) {
  return messages
    .map((message) => ({
      role: ["system", "assistant", "user"].includes(message.role) ? message.role : "user",
      content: String(message.content ?? message.text ?? "").trim(),
    }))
    .filter((message) => message.content && message.role !== "system");
}

function toOpenAiResponsesInput(messages, system) {
  const input = [];
  if (system) {
    input.push({
      role: "system",
      content: system,
    });
  }
  for (const message of messages) {
    input.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    });
  }
  return input;
}

function extractOpenAiResponseText(payload) {
  if (payload.output_text) {
    return payload.output_text;
  }
  const text = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" || content.type === "text") {
        text.push(content.text ?? "");
      }
    }
  }
  return text.join("\n").trim();
}

function extractAnthropicText(payload) {
  return (payload.content ?? [])
    .filter((entry) => entry.type === "text")
    .map((entry) => entry.text)
    .join("\n")
    .trim();
}

function extractGeminiText(payload) {
  return (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function extractBedrockText(payload) {
  return (payload.output?.message?.content ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function normalizeOpenAiTools(tools) {
  return tools.length > 0 ? tools : undefined;
}

function normalizeOpenAiCompatibleTools(tools) {
  return tools.length > 0 ? tools : undefined;
}

function normalizeAnthropicTools(tools) {
  return tools.length > 0
    ? tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters ?? tool.input_schema ?? { type: "object" },
      }))
    : undefined;
}

function normalizeBedrockTools(tools) {
  return tools.length > 0
    ? {
        tools: tools.map((tool) => ({
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: {
              json: tool.parameters ?? tool.input_schema ?? { type: "object" },
            },
          },
        })),
      }
    : undefined;
}

async function ensureAwsRuntimeCredentials(client) {
  if (client.provider.auth_method !== "aws_sigv4" || hasSignableAwsCredentials(client.aws)) {
    return client.aws;
  }
  if (!client.aws.profile) {
    return client.aws;
  }
  const resolved = await resolveAwsProfileCredentials(client);
  client.aws = {
    ...client.aws,
    ...resolved,
    region: resolved.region || client.aws.region || "us-east-1",
  };
  client.baseUrl = resolveBedrockRuntimeBaseUrl(client.provider, client.env, client.aws);
  return client.aws;
}

async function resolveAwsProfileCredentials(client) {
  const context = await loadAwsSharedProfileContext(client.env);
  return resolveAwsProfileChain({
    profileName: client.aws.profile || "default",
    context,
    client,
    visited: new Set(),
  });
}

async function resolveAwsProfileChain({ profileName, context, client, visited }) {
  const safeProfileName = normalizeAwsProfileName(profileName || "default");
  if (visited.has(safeProfileName)) {
    throw createGatewayError("aws_profile_cycle", `AWS profile ${safeProfileName} has a source_profile cycle.`);
  }
  visited.add(safeProfileName);
  const profile = getAwsProfile(context, safeProfileName);
  if (!profile) {
    throw createGatewayError("aws_profile_not_found", `AWS profile ${safeProfileName} was not found in shared credentials or config files.`);
  }
  const region = String(profile.region ?? client.aws.region ?? "us-east-1").trim();
  if (profile.aws_access_key_id && profile.aws_secret_access_key) {
    return {
      access_key_id: String(profile.aws_access_key_id).trim(),
      secret_access_key: String(profile.aws_secret_access_key).trim(),
      session_token: String(profile.aws_session_token ?? "").trim(),
      region,
      profile: safeProfileName,
      source: "aws_profile",
    };
  }
  if (profile.role_arn && profile.source_profile) {
    const sourceCredentials = await resolveAwsProfileChain({
      profileName: profile.source_profile,
      context,
      client,
      visited,
    });
    const assumed = await assumeAwsRole({
      client,
      profile,
      profileName: safeProfileName,
      sourceCredentials,
      region,
    });
    return {
      ...assumed,
      region,
      profile: safeProfileName,
      source: "aws_assume_role",
    };
  }
  if (isAwsSsoProfile(profile)) {
    throw createGatewayError(
      "aws_sso_profile_deferred",
      `AWS profile ${safeProfileName} uses IAM Identity Center/SSO. BeHeart detects it but does not execute SSO token loading yet; use env credentials or an assume-role profile with static source credentials for Bedrock live validation.`,
    );
  }
  if (profile.credential_process) {
    throw createGatewayError(
      "aws_credential_process_blocked",
      `AWS profile ${safeProfileName} uses credential_process. BeHeart does not execute external credential commands from model provider config.`,
    );
  }
  throw createGatewayError("aws_profile_credentials_missing", `AWS profile ${safeProfileName} does not contain signable credentials or a supported source_profile assume-role chain.`);
}

async function loadAwsSharedProfileContext(env = process.env) {
  const home = String(env.HOME ?? env.USERPROFILE ?? os.homedir() ?? "").trim();
  const credentialsPath = String(env.AWS_SHARED_CREDENTIALS_FILE ?? (home ? path.join(home, ".aws", "credentials") : "")).trim();
  const configPath = String(env.AWS_CONFIG_FILE ?? (home ? path.join(home, ".aws", "config") : "")).trim();
  const [credentialsRaw, configRaw] = await Promise.all([
    readOptionalText(credentialsPath),
    readOptionalText(configPath),
  ]);
  return {
    credentialProfiles: normalizeAwsProfileSections(parseIni(credentialsRaw), "credentials"),
    configProfiles: normalizeAwsProfileSections(parseIni(configRaw), "config"),
  };
}

async function readOptionalText(filePath) {
  if (!filePath) {
    return "";
  }
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return "";
    }
    throw createGatewayError("aws_profile_read_failed", `Unable to read AWS profile file ${filePath}: ${error.message}`);
  }
}

function parseIni(raw) {
  const sections = {};
  let current = "";
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }
    const section = trimmed.match(/^\[([^\]]+)\]$/);
    if (section) {
      current = section[1].trim();
      sections[current] = sections[current] ?? {};
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (!current || equalsIndex < 0) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex).trim().replace(/-/g, "_");
    const value = trimmed.slice(equalsIndex + 1).trim();
    sections[current][key] = value;
  }
  return sections;
}

function normalizeAwsProfileSections(sections = {}, kind) {
  const normalized = {};
  for (const [sectionName, values] of Object.entries(sections)) {
    const profileName = normalizeAwsProfileSectionName(sectionName, kind);
    if (!profileName) {
      continue;
    }
    normalized[profileName] = {
      ...(normalized[profileName] ?? {}),
      ...values,
    };
  }
  return normalized;
}

function normalizeAwsProfileSectionName(sectionName, kind) {
  const raw = String(sectionName ?? "").trim();
  if (!raw) {
    return "";
  }
  if (raw === "default") {
    return "default";
  }
  if (kind === "config") {
    if (raw.startsWith("profile ")) {
      return normalizeAwsProfileName(raw.slice("profile ".length));
    }
    return "";
  }
  return normalizeAwsProfileName(raw);
}

function normalizeAwsProfileName(value) {
  return String(value ?? "").trim().replace(/^['"]|['"]$/g, "");
}

function getAwsProfile(context, profileName) {
  const normalizedName = normalizeAwsProfileName(profileName);
  const config = context.configProfiles[normalizedName] ?? {};
  const credentials = context.credentialProfiles[normalizedName] ?? {};
  if (Object.keys(config).length === 0 && Object.keys(credentials).length === 0) {
    return null;
  }
  return {
    ...config,
    ...credentials,
  };
}

function isAwsSsoProfile(profile = {}) {
  return Boolean(
    profile.sso_session ||
      profile.sso_start_url ||
      profile.sso_account_id ||
      profile.sso_role_name ||
      profile.sso_region,
  );
}

async function assumeAwsRole({ client, profile, profileName, sourceCredentials, region }) {
  if (!hasSignableAwsCredentials(sourceCredentials)) {
    throw createGatewayError("aws_assume_role_source_missing", `AWS profile ${profileName} source_profile does not resolve to signable credentials.`);
  }
  const roleArn = String(profile.role_arn ?? "").trim();
  const roleSessionName = normalizeAwsRoleSessionName(profile.role_session_name || `beheart-bedrock-${Date.now().toString(36)}`);
  const body = new URLSearchParams({
    Action: "AssumeRole",
    Version: "2011-06-15",
    RoleArn: roleArn,
    RoleSessionName: roleSessionName,
    ...(profile.duration_seconds ? { DurationSeconds: String(profile.duration_seconds).trim() } : {}),
  }).toString();
  const stsRegion = String(profile.region ?? sourceCredentials.region ?? region ?? "us-east-1").trim();
  const url = `https://sts.${stsRegion}.amazonaws.com/`;
  const raw = await fetchAwsTextWithCredentials(client, {
    url,
    method: "POST",
    service: "sts",
    credentials: { ...sourceCredentials, region: stsRegion },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    bodyText: body,
  });
  const accessKeyId = extractXmlTag(raw, "AccessKeyId");
  const secretAccessKey = extractXmlTag(raw, "SecretAccessKey");
  const sessionToken = extractXmlTag(raw, "SessionToken");
  if (!accessKeyId || !secretAccessKey || !sessionToken) {
    throw createGatewayError("aws_assume_role_failed", `AWS AssumeRole for profile ${profileName} did not return temporary credentials.`);
  }
  return {
    access_key_id: accessKeyId,
    secret_access_key: secretAccessKey,
    session_token: sessionToken,
    expiration: extractXmlTag(raw, "Expiration"),
  };
}

async function fetchAwsTextWithCredentials(client, {
  url,
  method,
  headers,
  bodyText,
  credentials,
  service,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), client.timeoutMs);
  const signedHeaders = signAwsSigV4Request({
    url,
    method,
    headers,
    bodyText,
    credentials,
    service,
  });
  try {
    const response = await client.fetchImpl(url, {
      method,
      headers: signedHeaders,
      body: bodyText || undefined,
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      throw createGatewayError(
        responseStatusCode(response.status),
        extractXmlTag(raw, "Message") || `AWS STS request failed with HTTP ${response.status}.`,
        { status: response.status },
      );
    }
    return raw;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAwsRoleSessionName(value) {
  const normalized = String(value ?? "").replace(/[^\w+=,.@-]+/g, "-").slice(0, 64);
  return normalized.length >= 2 ? normalized : "beheart-bedrock";
}

function extractXmlTag(raw, tagName) {
  const match = String(raw ?? "").match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  return match ? decodeXmlEntities(match[1].trim()) : "";
}

function decodeXmlEntities(value) {
  return String(value ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function resolveAwsCredentials({ credential = {}, env = process.env, provider } = {}) {
  const baseUrl = resolveProviderBaseUrl(provider, { env });
  const region = String(
    credential.region ??
      credential.aws_region ??
      env.BE_AI_HEART_BEDROCK_REGION ??
      env.AWS_REGION ??
      env.AWS_DEFAULT_REGION ??
      inferAwsRegionFromUrl(baseUrl) ??
      "us-east-1",
  ).trim();
  return {
    access_key_id: String(
      credential.access_key_id ??
        credential.accessKeyId ??
        credential.aws_access_key_id ??
        env.BE_AI_HEART_BEDROCK_ACCESS_KEY_ID ??
        env.AWS_ACCESS_KEY_ID ??
        "",
    ).trim(),
    secret_access_key: String(
      credential.secret_access_key ??
        credential.secretAccessKey ??
        credential.aws_secret_access_key ??
        env.BE_AI_HEART_BEDROCK_SECRET_ACCESS_KEY ??
        env.AWS_SECRET_ACCESS_KEY ??
        "",
    ).trim(),
    session_token: String(
      credential.session_token ??
        credential.sessionToken ??
        credential.aws_session_token ??
        env.BE_AI_HEART_BEDROCK_SESSION_TOKEN ??
        env.AWS_SESSION_TOKEN ??
        "",
    ).trim(),
    region,
    profile: String(env.BE_AI_HEART_BEDROCK_PROFILE ?? env.AWS_PROFILE ?? credential.profile ?? "").trim(),
    control_base_url: String(env.BE_AI_HEART_BEDROCK_CONTROL_BASE_URL ?? "").trim(),
  };
}

function hasSignableAwsCredentials(credentials = {}) {
  return Boolean(credentials.access_key_id && credentials.secret_access_key && credentials.region);
}

function resolveBedrockControlBaseUrl(client) {
  return client.aws.control_base_url || `https://bedrock.${client.aws.region}.amazonaws.com`;
}

function resolveBedrockRuntimeBaseUrl(provider, env, aws) {
  const explicit = String(env.BE_AI_HEART_BEDROCK_RUNTIME_BASE_URL ?? env.BE_AI_HEART_BEDROCK_BASE_URL ?? "").trim();
  return explicit || `https://bedrock-runtime.${aws.region}.amazonaws.com`;
}

function signAwsSigV4Request({ url, method, headers = {}, bodyText = "", credentials, service }) {
  if (!hasSignableAwsCredentials(credentials)) {
    throw createGatewayError("missing_aws_credentials", "AWS SigV4 signing requires access key, secret key, and region.");
  }
  const requestUrl = new URL(url);
  const now = new Date();
  const amzDate = toAwsDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(bodyText);
  const requestHeaders = {
    ...headers,
    Host: requestUrl.host,
    "X-Amz-Content-Sha256": payloadHash,
    "X-Amz-Date": amzDate,
    ...(credentials.session_token ? { "X-Amz-Security-Token": credentials.session_token } : {}),
  };
  const canonical = canonicalizeAwsRequest({
    method,
    url: requestUrl,
    headers: requestHeaders,
    payloadHash,
  });
  const credentialScope = `${dateStamp}/${credentials.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonical.request),
  ].join("\n");
  const signingKey = deriveAwsSigningKey(credentials.secret_access_key, dateStamp, credentials.region, service);
  const signature = hmacHex(signingKey, stringToSign);

  return {
    ...requestHeaders,
    Authorization: [
      `AWS4-HMAC-SHA256 Credential=${credentials.access_key_id}/${credentialScope}`,
      `SignedHeaders=${canonical.signedHeaders}`,
      `Signature=${signature}`,
    ].join(", "),
  };
}

function canonicalizeAwsRequest({ method, url, headers, payloadHash }) {
  const normalizedHeaders = Object.entries(headers)
    .map(([key, value]) => [String(key).toLowerCase(), String(value).trim().replace(/\s+/g, " ")])
    .sort(([left], [right]) => left.localeCompare(right));
  const canonicalHeaders = normalizedHeaders.map(([key, value]) => `${key}:${value}\n`).join("");
  const signedHeaders = normalizedHeaders.map(([key]) => key).join(";");
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join("&");
  const request = [
    String(method ?? "GET").toUpperCase(),
    canonicalAwsPath(url.pathname),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  return { request, signedHeaders };
}

function deriveAwsSigningKey(secretAccessKey, dateStamp, region, service) {
  const dateKey = hmacBuffer(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmacBuffer(dateKey, region);
  const serviceKey = hmacBuffer(regionKey, service);
  return hmacBuffer(serviceKey, "aws4_request");
}

function canonicalAwsPath(pathname) {
  return String(pathname || "/")
    .split("/")
    .map((segment) => awsEncode(decodeURIComponent(segment)))
    .join("/") || "/";
}

function awsEncode(value) {
  return encodeURIComponent(String(value ?? ""))
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function inferAwsRegionFromUrl(value) {
  return String(value ?? "").match(/bedrock(?:-runtime)?\.([a-z0-9-]+)\.amazonaws\.com/)?.[1] ?? "";
}

function toAwsDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmacBuffer(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key, value) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""));
}

function chunkText(value, size) {
  const text = String(value ?? "");
  if (!text) {
    return [""];
  }
  const chunks = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

function normalizeModelId(value) {
  return String(value ?? "").trim();
}

function price(tokens, perMillion) {
  return (Number(tokens ?? 0) / 1_000_000) * Number(perMillion ?? 0);
}

function ensureTrailingSlash(value) {
  const raw = String(value ?? "").trim();
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function buildProviderUrl(baseUrl, requestPath) {
  return new URL(String(requestPath ?? "").replace(/^\/+/, ""), ensureTrailingSlash(baseUrl)).toString();
}

function responseStatusCode(status) {
  if (status === 401 || status === 403) return "auth_error";
  if (status === 404) return "model_not_found";
  if (status === 408 || status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "provider_error";
}

function createGatewayError(code, message, details = {}) {
  const error = new Error(redactMessage(message));
  error.code = code;
  error.details = details;
  error.status = details.status;
  error.retryable = ["rate_limited", "provider_unavailable", "request_timeout"].includes(code);
  return error;
}

function redactMessage(message) {
  return String(message ?? "")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/sk_[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{12,}\b/g, "[redacted]")
    .replace(/\b(?:aws_)?secret_access_key\s*[:=]\s*["']?[^"'\s,}]+/gi, "secret_access_key=[redacted]")
    .slice(0, 400);
}
