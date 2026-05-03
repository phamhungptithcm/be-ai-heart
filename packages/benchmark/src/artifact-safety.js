const SECRET_VALUE_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/,
  /\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*["']?[^"'\s,}]+/i,
];

const LOCAL_PATH_PATTERNS = [
  /(^|[\s"'])\/(?:Users|home|private|tmp|var\/folders)\//,
  /(^|[\s"'])[A-Za-z]:[\\/][^"'\s]+/,
];

const SENSITIVE_FIELD_NAMES = new Set([
  "body",
  "client_secret",
  "local_manifest_path",
  "patch",
  "provider_config",
  "raw_prompt",
  "repo_root",
  "session_token",
  "source_path",
]);

export function validatePublishedArtifactSafety(artifact, options = {}) {
  const findings = [];
  const maxFindings = Number.isInteger(options.maxFindings) ? options.maxFindings : 50;

  walkArtifact(artifact, [], (pathParts, value) => {
    if (findings.length >= maxFindings) {
      return;
    }

    const key = String(pathParts.at(-1) ?? "").toLowerCase();
    if (SENSITIVE_FIELD_NAMES.has(key)) {
      findings.push(createFinding("sensitive_field", pathParts, value));
    }

    if (typeof value !== "string") {
      return;
    }

    if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
      findings.push(createFinding("secret_like_value", pathParts, value));
      return;
    }

    if (LOCAL_PATH_PATTERNS.some((pattern) => pattern.test(value))) {
      findings.push(createFinding("absolute_local_path", pathParts, value));
    }
  });

  return {
    schema_version: 1,
    status: findings.length === 0 ? "safe" : "unsafe",
    finding_count: findings.length,
    findings,
  };
}

function walkArtifact(value, pathParts, visit) {
  visit(pathParts, value);
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkArtifact(entry, [...pathParts, String(index)], visit));
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    walkArtifact(entry, [...pathParts, key], visit);
  }
}

function createFinding(type, pathParts, value) {
  return {
    type,
    path: pathParts.join(".") || "$",
    redacted_value: redactFindingValue(value),
  };
}

function redactFindingValue(value) {
  if (typeof value !== "string") {
    return "[redacted]";
  }

  if (value.length <= 8) {
    return "[redacted]";
  }

  return `${value.slice(0, 4)}...[redacted]`;
}
