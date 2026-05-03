const SECRET_VALUE_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bsk_[A-Za-z0-9_-]{12,}\b/g,
  /\b(?:api[_-]?key|secret|password|token|client[_-]?secret|id[_-]?token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?[^"'\s,}&]+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
];

const LOCAL_PATH_PATTERNS = [
  /(^|[\s"'])\/(?:Users|home|private|tmp|var\/folders)\/[^\s"',}]+/g,
  /(^|[\s"'])[A-Za-z]:[\\/][^\s"',}]+/g,
];

const SENSITIVE_KEYS = new Set([
  "api_key",
  "apikey",
  "authorization",
  "bearer",
  "client_secret",
  "cookie",
  "csrf",
  "id_token",
  "password",
  "provider_config",
  "refresh_token",
  "request_body",
  "response_body",
  "secret",
  "session",
  "session_token",
  "token",
  "upstream_authorization",
]);

const SENSITIVE_KEY_FRAGMENTS = [
  "api_key",
  "authorization",
  "client_secret",
  "credential",
  "password",
  "secret",
  "session",
  "token",
];

export function redactSensitiveString(value) {
  let redacted = String(value ?? "");
  for (const pattern of SECRET_VALUE_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      const label = match.includes("=") ? match.split("=")[0] : match.split(":")[0];
      return label && label !== match ? `${label}=[redacted]` : "[redacted]";
    });
  }
  for (const pattern of LOCAL_PATH_PATTERNS) {
    redacted = redacted.replace(pattern, (match, prefix = "") => `${prefix}[local-path]`);
  }
  return redacted;
}

export function redactSensitiveData(value, options = {}) {
  return redactValue(value, [], {
    maxDepth: Number.isInteger(options.maxDepth) ? options.maxDepth : 8,
  });
}

export function redactUrlSearch(search) {
  const rawSearch = String(search ?? "");
  if (!rawSearch) {
    return "";
  }
  const params = new URLSearchParams(rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch);
  for (const key of [...params.keys()]) {
    if (isSensitiveKey(key)) {
      params.set(key, "[redacted]");
    } else {
      params.set(key, redactSensitiveString(params.get(key) ?? ""));
    }
  }
  const result = params.toString();
  return result ? `?${result}` : "";
}

export function redactHeaders(headers = {}) {
  const entries = headers instanceof Headers
    ? [...headers.entries()]
    : Object.entries(headers ?? {});
  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      isSensitiveKey(key) ? "[redacted]" : redactSensitiveString(Array.isArray(value) ? value.join(", ") : value),
    ]),
  );
}

export function isSensitiveKey(key) {
  const normalized = String(key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  return SENSITIVE_KEYS.has(normalized) ||
    SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function redactValue(value, pathParts, { maxDepth }) {
  if (pathParts.length > maxDepth) {
    return "[redacted]";
  }
  const key = pathParts.at(-1) ?? "";
  if (isSensitiveKey(key)) {
    return "[redacted]";
  }
  if (typeof value === "string") {
    return redactSensitiveString(value);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => redactValue(entry, [...pathParts, String(index)], { maxDepth }));
  }
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      redactValue(entryValue, [...pathParts, entryKey], { maxDepth }),
    ]),
  );
}
