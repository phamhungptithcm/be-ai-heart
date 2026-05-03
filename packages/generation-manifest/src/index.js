import { createHash } from "node:crypto";

export const GENERATION_MANIFEST_SCHEMA_VERSION = 1;

const SECRET_PATTERNS = Object.freeze([
  { id: "card_number", pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2})[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/ },
  { id: "secret", pattern: /\b(?:sk-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{20,})\b/i },
  { id: "token_assignment", pattern: /\b(?:api[_-]?key|secret|password|access[_-]?token|refresh[_-]?token)\s*[:=]\s*['"]?[^'"\s]{8,}/i },
]);

const DEMO_RISK_PATTERNS = Object.freeze([
  { id: "real_looking_plate", pattern: /\b[A-Z]{3}[- ]?\d{4}\b/ },
  { id: "raw_bank_account", pattern: /\b\d{9,17}\b/ },
]);

export function createGenerationManifest({
  plan,
  artifacts = [],
  prompts = [],
  assumptions = [],
  warnings = [],
  validationResults = [],
  rollbackToken,
  now = new Date().toISOString(),
} = {}) {
  const planId = plan?.plan_id ?? createStableId("plan", JSON.stringify(plan ?? {}));
  const manifestId = createStableId("gen", `${planId}:${now}`);
  return {
    schema_version: GENERATION_MANIFEST_SCHEMA_VERSION,
    manifest_id: manifestId,
    plan_id: planId,
    domain_pack_id: plan?.domain_pack_id ?? plan?.domainPackId ?? "tolling-management",
    stack_preset_id: plan?.stack_preset_id ?? plan?.stackPresetId ?? "",
    mode: plan?.mode ?? "product-starter",
    output_dir: sanitizePathForManifest(plan?.output_dir ?? ""),
    generated_files: artifacts.map(normalizeArtifactForManifest),
    source_citations: dedupeCitations([
      ...(plan?.source_citations ?? []),
      ...artifacts.flatMap((artifact) => artifact.source_refs ?? artifact.source_citations ?? []),
    ]),
    prompts: prompts.map((prompt) => redactSensitiveText(prompt).slice(0, 1200)),
    assumptions: assumptions.map((assumption) => redactSensitiveText(assumption).slice(0, 1200)),
    warnings,
    validation_results: validationResults,
    rollback_token: rollbackToken,
    created_at: now,
  };
}

export function validateGenerationManifest(manifest = {}) {
  const errors = [];
  if (manifest.schema_version !== GENERATION_MANIFEST_SCHEMA_VERSION) {
    errors.push("Unsupported generation manifest schema_version.");
  }
  for (const field of ["manifest_id", "plan_id", "domain_pack_id", "mode", "output_dir", "created_at"]) {
    if (!String(manifest[field] ?? "").trim()) {
      errors.push(`Missing ${field}.`);
    }
  }
  if (!Array.isArray(manifest.generated_files)) {
    errors.push("generated_files must be an array.");
  }
  const serialized = JSON.stringify(manifest);
  for (const finding of scanSecretLikeText(serialized)) {
    errors.push(`Manifest appears to include ${finding.id}.`);
  }
  return {
    schema_version: GENERATION_MANIFEST_SCHEMA_VERSION,
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
  };
}

export function scanSecretLikeText(value = "") {
  const text = String(value ?? "");
  return SECRET_PATTERNS
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => ({ id: entry.id, message: `Detected ${entry.id}.` }));
}

export function scanUnsafeDemoData(value = "") {
  const text = String(value ?? "");
  return DEMO_RISK_PATTERNS
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => ({ id: entry.id, message: `Detected ${entry.id}. Use obvious fake demo values.` }));
}

export function redactSensitiveText(value = "") {
  let output = String(value ?? "");
  for (const entry of SECRET_PATTERNS) {
    output = output.replace(entry.pattern, `[redacted:${entry.id}]`);
  }
  return output;
}

export function createStableId(prefix, value) {
  return `${prefix}-${createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12)}`;
}

function normalizeArtifactForManifest(artifact = {}) {
  return {
    artifact_id: artifact.artifact_id ?? createStableId("artifact", artifact.relative_path ?? ""),
    kind: artifact.kind ?? "doc",
    relative_path: artifact.relative_path,
    source_refs: artifact.source_refs ?? artifact.source_citations ?? [],
    story_ids: artifact.story_ids ?? [],
    overwrite_policy: artifact.overwrite_policy ?? "create_only",
  };
}

function dedupeCitations(citations = []) {
  const byKey = new Map();
  for (const citation of citations) {
    if (!citation) continue;
    const key = `${citation.source_ref ?? ""}:${citation.path_or_url ?? citation.url ?? citation.ref ?? ""}`;
    if (!byKey.has(key)) {
      byKey.set(key, citation);
    }
  }
  return [...byKey.values()];
}

function sanitizePathForManifest(value) {
  return String(value ?? "").replace(process.env.HOME ?? "__NO_HOME__", "~");
}
