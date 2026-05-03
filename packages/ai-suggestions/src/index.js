export const AI_SUGGESTION_SCHEMA_VERSION = 1;

export function collectEditContext({ buffer, cursor = buffer?.cursor, diagnostics = [], repoHints = [], recentEdits = [] } = {}) {
  const content = String(buffer?.content ?? "");
  const offset = offsetFromPosition(content, cursor ?? { line: 1, column: 1 });
  return {
    schema_version: AI_SUGGESTION_SCHEMA_VERSION,
    request_id: `suggestion-${Date.now().toString(36)}`,
    mode: "inline",
    buffer: {
      path: String(buffer?.path ?? ""),
      language: String(buffer?.language ?? "text"),
      version: Number(buffer?.version ?? 1),
      prefix: content.slice(Math.max(0, offset - 4000), offset),
      suffix: content.slice(offset, offset + 2000),
      nearby_symbols: [],
    },
    cursor: cursor ?? { line: 1, column: 1 },
    diagnostics,
    repo_hints: repoHints,
    recent_edits: recentEdits,
    max_output_tokens: 96,
  };
}

export async function requestInlineSuggestion({ request, suggestionProvider } = {}) {
  return requestSuggestion({ request: { ...request, mode: "inline" }, suggestionProvider });
}

export async function requestNextLineSuggestion({ request, suggestionProvider } = {}) {
  return requestSuggestion({ request: { ...request, mode: "next_line", max_output_tokens: 160 }, suggestionProvider });
}

export async function requestNextBlockSuggestion({ request, suggestionProvider } = {}) {
  return requestSuggestion({ request: { ...request, mode: "next_block", max_output_tokens: 384 }, suggestionProvider });
}

export function acceptSuggestionWord({ buffer, suggestion } = {}) {
  const word = String(suggestion?.text ?? "").match(/^\s*\S+/)?.[0] ?? "";
  return applySuggestionText(buffer, word, "word");
}

export function acceptSuggestionLine({ buffer, suggestion } = {}) {
  const line = String(suggestion?.text ?? "").split(/\r?\n/)[0] ?? "";
  return applySuggestionText(buffer, line, "line");
}

export function acceptSuggestionBlock({ buffer, suggestion } = {}) {
  return applySuggestionText(buffer, String(suggestion?.text ?? ""), "block");
}

export function rejectSuggestion({ suggestion, reason = "user_rejected" } = {}) {
  return {
    schema_version: AI_SUGGESTION_SCHEMA_VERSION,
    event_type: "suggestion_rejected",
    suggestion_id: suggestion?.suggestion_id ?? "",
    reason,
    created_at: new Date().toISOString(),
  };
}

async function requestSuggestion({ request, suggestionProvider } = {}) {
  if (typeof suggestionProvider !== "function") {
    return {
      schema_version: AI_SUGGESTION_SCHEMA_VERSION,
      suggestion_id: "",
      request_id: request?.request_id ?? "",
      status: "empty",
      kind: "insert",
      text: "",
      confidence: 0,
      model_id: "",
      latency_ms: 0,
      estimated_tokens: 0,
      reason: "No suggestion provider configured.",
    };
  }
  const startedAt = Date.now();
  const result = await suggestionProvider(redactSuggestionRequest(request));
  return {
    schema_version: AI_SUGGESTION_SCHEMA_VERSION,
    suggestion_id: result.suggestion_id ?? `suggestion-result-${Date.now().toString(36)}`,
    request_id: request?.request_id ?? "",
    status: result.text ? "ready" : "empty",
    kind: result.kind ?? "insert",
    text: String(result.text ?? ""),
    range: result.range ?? null,
    target_path: result.target_path ?? request?.buffer?.path ?? "",
    confidence: Number(result.confidence ?? 0.5),
    model_id: String(result.model_id ?? ""),
    latency_ms: Date.now() - startedAt,
    estimated_tokens: Math.ceil(String(result.text ?? "").length / 4),
    reason: result.reason ?? "",
  };
}

function applySuggestionText(buffer = {}, text, granularity) {
  const content = String(buffer.content ?? "");
  const cursor = buffer.cursor ?? { line: 1, column: 1 };
  const offset = offsetFromPosition(content, cursor);
  const nextContent = `${content.slice(0, offset)}${text}${content.slice(offset)}`;
  return {
    buffer: {
      ...buffer,
      content: nextContent,
      dirty: true,
      version: Number(buffer.version ?? 1) + 1,
    },
    telemetry: {
      schema_version: AI_SUGGESTION_SCHEMA_VERSION,
      event_type: "suggestion_accepted",
      accepted_granularity: granularity,
      created_at: new Date().toISOString(),
    },
  };
}

function redactSuggestionRequest(request = {}) {
  const redact = (value) =>
    String(value ?? "")
      .replace(/(api[_-]?key|password|token)=\S+/gi, "$1=[redacted]")
      .replace(/sk-[a-z0-9_-]{12,}/gi, "[redacted]")
      .replace(/sk_[a-z0-9_-]{12,}/gi, "[redacted]");
  return {
    ...request,
    buffer: {
      ...(request.buffer ?? {}),
      prefix: redact(request.buffer?.prefix),
      suffix: redact(request.buffer?.suffix),
    },
  };
}

function offsetFromPosition(content, position = {}) {
  const line = Math.max(1, Number(position.line ?? 1));
  const column = Math.max(1, Number(position.column ?? 1));
  const lines = String(content ?? "").split("\n");
  let offset = 0;
  for (let index = 0; index < line - 1 && index < lines.length; index += 1) {
    offset += lines[index].length + 1;
  }
  return Math.min(String(content ?? "").length, offset + column - 1);
}
