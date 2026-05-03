import {
  detectPackLayerConflicts,
  explainEffectivePackRules,
  mergePackLayers,
} from "../../core/src/index.js";

export const DOMAIN_PACK_COMPILER_SCHEMA_VERSION = 1;

export async function mergeDomainLayers(input = {}, options = {}) {
  return mergePackLayers(normalizeSelection(input), options);
}

export async function detectDomainConflicts(input = {}, options = {}) {
  const conflicts = await detectPackLayerConflicts(normalizeSelection(input), options);
  return conflicts.map((conflict, index) => ({
    warning_id: `conflict-${index + 1}`,
    severity: normalizeSeverity(conflict.severity),
    rule_id: conflict.rule_id,
    layers: [conflict.earlier_layer, conflict.later_layer].filter(Boolean),
    message: conflict.message ?? `Domain rule conflict for ${conflict.rule_id}.`,
    resolution_required: normalizeSeverity(conflict.severity) === "blocking",
    suggested_question: "Which layer should own this policy for this generated project?",
    ...conflict,
  }));
}

export async function explainEffectiveDomainRules(input = {}, options = {}) {
  const context = await explainEffectivePackRules(normalizeSelection(input), options);
  return {
    schema_version: DOMAIN_PACK_COMPILER_SCHEMA_VERSION,
    ...context,
  };
}

export function askDomainQuestions({ domainId = "", custom = false } = {}) {
  if (!custom) {
    return [];
  }
  const normalizedDomainId = String(domainId || "custom-domain").trim();
  return [
    question("domain-purpose", "What product outcome should this domain pack support?", "text"),
    question("primary-actors", "Who are the primary users, operators, and administrators?", "text"),
    question("core-workflows", "What are the top 3-5 workflows the starter must model?", "text"),
    question("sensitive-data", "Which data fields are sensitive or regulated?", "text"),
    question("integrations", "Which external systems or vendors matter?", "text"),
    question("benchmark-tasks", "Which tasks should prove the pack saves discovery time?", "text"),
  ].map((entry) => ({
    ...entry,
    domain_id: normalizedDomainId,
  }));
}

export function normalizeSelection(input = {}) {
  return {
    pack_id: input.pack_id ?? input.packId ?? input.domain_pack_id ?? input.domainPackId ?? input.domainId ?? "tolling-management",
    regional_layer: input.regional_layer ?? input.regionalLayer ?? input.regional,
    agency_overlay: input.agency_overlay ?? input.agencyOverlay ?? input.agency,
    customer_overlay: input.customer_overlay ?? input.customerOverlay,
    customer_requirements: input.customer_requirements ?? input.customerRequirements,
  };
}

function question(questionId, prompt, answerType) {
  return {
    question_id: questionId,
    reason: "blocking",
    prompt,
    answer_type: answerType,
  };
}

function normalizeSeverity(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (["high", "critical", "blocking"].includes(normalized)) {
    return "blocking";
  }
  if (["medium", "warning"].includes(normalized)) {
    return "warning";
  }
  return "info";
}
