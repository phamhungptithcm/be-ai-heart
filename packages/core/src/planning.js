export const PLANNING_CHANGE_REQUEST_SCHEMA_VERSION = 1;

const VALID_CHANGE_REQUEST_STATUSES = new Set([
  "proposed",
  "accepted",
  "superseded",
  "rejected",
]);

export function createPlanningChangeRequestId({ date = new Date(), sequence = 1 } = {}) {
  const parsedDate = date instanceof Date ? date : new Date(date);
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date(0) : parsedDate;
  const yyyy = String(safeDate.getUTCFullYear()).padStart(4, "0");
  const mm = String(safeDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(safeDate.getUTCDate()).padStart(2, "0");
  const safeSequence = Math.max(1, Number.parseInt(sequence, 10) || 1);
  return `CR-${yyyy}${mm}${dd}-${String(safeSequence).padStart(2, "0")}`;
}

export function normalizePlanningChangeRequest(input = {}) {
  const status = normalizeStatus(input.status);
  const now = input.now ?? new Date().toISOString();
  const id = sanitizeIdentifier(
    input.id ?? createPlanningChangeRequestId({ date: now, sequence: input.sequence }),
  );

  return {
    schema_version: PLANNING_CHANGE_REQUEST_SCHEMA_VERSION,
    id,
    status,
    title: sanitizePlanningText(input.title || "Untitled change request", 160),
    actor: sanitizePlanningText(input.actor || input.persona || "unspecified", 100),
    trigger: sanitizePlanningText(input.trigger || "manual", 140),
    problem: sanitizePlanningText(input.problem || "", 500),
    proposed_change: sanitizePlanningText(input.proposed_change || input.change || "", 900),
    latest_agreed_summary: sanitizePlanningText(input.latest_agreed_summary || "", 600),
    affected_story_ids: normalizeList(input.affected_story_ids ?? input.story_ids).map(sanitizeIdentifier),
    code_areas: normalizeList(input.code_areas ?? input.packages).map((value) => sanitizePlanningText(value, 160)),
    docs_required: normalizeList(input.docs_required ?? input.docs).map((value) => sanitizePlanningText(value, 160)),
    acceptance_criteria: normalizeList(input.acceptance_criteria).map((value) =>
      sanitizePlanningText(value, 300),
    ),
    validation_plan: normalizeList(input.validation_plan ?? input.tests_required).map((value) =>
      sanitizePlanningText(value, 240),
    ),
    security_considerations: normalizeList(input.security_considerations).map((value) =>
      sanitizePlanningText(value, 260),
    ),
    decision_required: Boolean(input.decision_required),
    links: normalizeList(input.links).map((value) => sanitizePlanningText(value, 220)),
    created_at: sanitizePlanningText(input.created_at || now, 80),
    updated_at: sanitizePlanningText(input.updated_at || now, 80),
  };
}

export function validatePlanningChangeRequest(request = {}) {
  const errors = [];
  const normalized = normalizePlanningChangeRequest(request);

  if (!normalized.title || normalized.title === "Untitled change request") {
    errors.push({ field: "title", message: "Title is required." });
  }
  if (!normalized.proposed_change) {
    errors.push({ field: "proposed_change", message: "Proposed change is required." });
  }
  if (normalized.affected_story_ids.length === 0) {
    errors.push({ field: "affected_story_ids", message: "At least one story ID is required." });
  }
  if (normalized.acceptance_criteria.length === 0) {
    errors.push({ field: "acceptance_criteria", message: "At least one acceptance criterion is required." });
  }
  if (!VALID_CHANGE_REQUEST_STATUSES.has(normalized.status)) {
    errors.push({ field: "status", message: "Status is invalid." });
  }

  return {
    valid: errors.length === 0,
    errors,
    request: normalized,
  };
}

export function renderPlanningChangeRequestMarkdown(input = {}) {
  const request = normalizePlanningChangeRequest(input);
  const validation = validatePlanningChangeRequest(request);
  const lines = [
    `## ${request.id}: ${request.title}`,
    "",
    `Status: ${toTitleCase(request.status)}`,
    "",
    "Metadata:",
    `- Actor: ${request.actor}`,
    `- Trigger: ${request.trigger}`,
    `- Created: ${request.created_at}`,
    `- Updated: ${request.updated_at}`,
    `- Decision required: ${request.decision_required ? "yes" : "no"}`,
    "",
    "Problem:",
    `- ${request.problem || "Not recorded."}`,
    "",
    "Proposed change:",
    `- ${request.proposed_change || "Not recorded."}`,
    "",
    "Latest discussed and agreed:",
    `- ${request.latest_agreed_summary || "Not recorded yet."}`,
    "",
    "Affected stories:",
    ...formatList(request.affected_story_ids),
    "",
    "Code areas:",
    ...formatList(request.code_areas),
    "",
    "Docs required:",
    ...formatList(request.docs_required),
    "",
    "Acceptance criteria:",
    ...formatList(request.acceptance_criteria),
    "",
    "Validation plan:",
    ...formatList(request.validation_plan),
    "",
    "Security considerations:",
    ...formatList(request.security_considerations),
    "",
    "Links:",
    ...formatList(request.links),
  ];

  if (!validation.valid) {
    lines.push(
      "",
      "Validation:",
      ...validation.errors.map((error) => `- ${error.field}: ${error.message}`),
    );
  }

  return `${lines.join("\n")}\n`;
}

function normalizeStatus(value) {
  const normalized = String(value ?? "proposed").trim().toLowerCase();
  return VALID_CHANGE_REQUEST_STATUSES.has(normalized) ? normalized : "proposed";
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => String(entry ?? "").trim());
  }
  if (!value) {
    return [];
  }
  return String(value)
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sanitizeIdentifier(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sanitizePlanningText(value, maxLength) {
  return redactSensitiveText(String(value ?? "").trim()).slice(0, maxLength);
}

function redactSensitiveText(value) {
  return String(value ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, "[redacted-secret]");
}

function formatList(items) {
  if (!items.length) {
    return ["- Not recorded."];
  }
  return items.map((item) => `- ${item}`);
}

function toTitleCase(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
