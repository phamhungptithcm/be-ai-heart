import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import { parseSimpleYaml } from "../../shared-schema/src/index.js";
import { resolveMonorepoRoot } from "./monorepo-root.js";

export const DOMAIN_PACK_SCHEMA_VERSION = 1;
export const PACK_ARTIFACT_MANIFEST_SCHEMA_VERSION = 1;

const PACK_OUTPUTS = Object.freeze([
  {
    id: "domain-pack",
    label: "Domain Memory Pack",
    description: "Layer-aware domain memory for AI implementation work.",
  },
  {
    id: "sales-demo-kit",
    label: "Sales Demo Kit",
    description: "Source-backed sales collateral, demo script, fake data, and MVP story.",
  },
  {
    id: "website",
    label: "Website/Microsite",
    description: "Demo microsite copy and sections grounded in pack source notes.",
  },
  {
    id: "ui-prototype",
    label: "UI Prototype Spec",
    description: "Back-office and customer portal prototype requirements.",
  },
  {
    id: "proposal",
    label: "Proposal/RFP Starter",
    description: "Capability matrix, assumptions, phased scope, and security notes.",
  },
  {
    id: "benchmarks",
    label: "Benchmark Scenarios",
    description: "Repeatable ROI and quality scenarios for tolling workflows.",
  },
  {
    id: "context-pack",
    label: "AI Context Pack",
    description: "Compact context bundle for agent implementation prompts.",
  },
]);

const PACK_SECURITY_WARNINGS = Object.freeze([
  "No real PII, license plates, plate images, trip history, or support transcripts in generated artifacts.",
  "No raw card numbers, bank account numbers, payment secrets, or production endpoints.",
  "Toll rates, fee amounts, notice windows, collections rules, and legal outcomes require customer-approved source authority.",
  "Portal chat pack actions are allowlisted and must not execute arbitrary shell commands.",
]);

const SOURCE_NOTES = Object.freeze([
  {
    source_ref: "FHWA ETC interoperability",
    label: "FHWA Nationwide Electronic Toll Collection Interoperability",
    url: "https://ops.fhwa.dot.gov/publications/fhwahop21023/fhwahop21023.pdf",
    use: "Home/away agency, transaction exchange, image review, reconciliation, and back-office concepts.",
  },
  {
    source_ref: "TxDOT toll roads and HCTRA operations",
    label: "TxDOT and HCTRA toll operations",
    url: "https://www.txdot.gov/about/newsroom/statewide/2024/txdot-teams-up-with-hctra-to-enhance-toll-operations.html",
    use: "Customer support consolidation, transaction processing, billing handoff, and migration risk framing.",
  },
  {
    source_ref: "HCTRA EZ TAG Agreement",
    label: "HCTRA EZ TAG Agreement",
    url: "https://www.hctra.org/-/media/BF54E5D5AF9D482DBCD13A2472FDEEA9.ashx",
    use: "Account good standing, plate/payment responsibility, transponder replacement, protests, and interoperability data sharing.",
  },
  {
    source_ref: "NTTA TollTag and ZipCash",
    label: "NTTA TollTag and pay-your-bill guidance",
    url: "https://www.ntta.org/pay-your-bill",
    use: "Prepaid tag vs invoice billing UX and pay-by-mail operational risk.",
  },
  {
    source_ref: "FTC toll text scam guidance",
    label: "FTC unpaid toll text scam guidance",
    url: "https://consumer.ftc.gov/consumer-alerts/2025/01/got-text-about-unpaid-tolls-its-probably-scam",
    use: "Scam-safe notification and support guidance using official agency payment channels.",
  },
  {
    source_ref: "PCI DSS",
    label: "PCI DSS",
    url: "https://www.pcisecuritystandards.org/standards/pci-dss/",
    use: "Payment data boundary and hosted-payment/tokenization assumptions.",
  },
  {
    source_ref: "NIST Privacy Framework",
    label: "NIST Privacy Framework",
    url: "https://www.nist.gov/privacy-framework",
    use: "Privacy, redaction, governance, and risk framing.",
  },
]);

const PACK_LAYERS = Object.freeze([
  {
    id: "core",
    layer: "core",
    label: "Core",
    description: "Shared tolling operating backbone, security posture, entities, and workflows.",
    priority: 1,
  },
  {
    id: "regional:texas",
    layer: "regional",
    region_id: "texas",
    label: "Regional: Texas",
    description: "Texas-style interoperability, tag brands, billing handoff, and customer support transition examples.",
    priority: 2,
  },
  {
    id: "agency:txdot-example",
    layer: "agency",
    agency_id: "txdot-example",
    label: "Agency Overlay: TxDOT example",
    description: "Example TxDOT-style operational overlay. Not legal or official agency policy.",
    priority: 3,
  },
  {
    id: "agency:hctra-example",
    layer: "agency",
    agency_id: "hctra-example",
    label: "Agency Overlay: HCTRA-style example",
    description: "Example HCTRA-style EZ TAG customer support, account, and transponder overlay.",
    priority: 3,
  },
  {
    id: "agency:ntta-example",
    layer: "agency",
    agency_id: "ntta-example",
    label: "Agency Overlay: NTTA-style example",
    description: "Example NTTA-style TollTag and invoice-billing overlay.",
    priority: 3,
  },
  {
    id: "customer:template",
    layer: "customer",
    customer_overlay_id: "template",
    label: "Customer Overlay Template",
    description: "Accepted customer docs/specs, rules, integrations, and implementation constraints.",
    priority: 4,
  },
]);

const CORE_RULES = Object.freeze([
  rule({
    rule_id: "trip.idempotent-posting",
    title: "Idempotent trip posting",
    summary: "Roadside events must stay traceable and duplicate detection must run before financial posting.",
    layer: "core",
    source_ref: "FHWA ETC interoperability",
    risk: "money_movement",
    tags: ["trip-posting", "audit", "ledger"],
  }),
  rule({
    rule_id: "payment.pci-boundary",
    title: "Hosted payment boundary",
    summary: "Generated demos and MVP designs must assume hosted payment capture or tokenized payment references, not raw card handling.",
    layer: "core",
    source_ref: "PCI DSS",
    risk: "payment_data",
    tags: ["payments", "pci", "security"],
  }),
  rule({
    rule_id: "privacy.no-real-pii",
    title: "No real PII or plates",
    summary: "Generated artifacts must use obvious fake accounts, plates, transponders, payments, cases, and trip records.",
    layer: "core",
    source_ref: "NIST Privacy Framework",
    risk: "privacy",
    tags: ["pii", "plates", "demo-data"],
  }),
  rule({
    rule_id: "notification.official-payment-link",
    title: "Official payment channel guidance",
    summary: "Customer support and notification flows must send users to official agency websites or known phone numbers, never unknown SMS payment links.",
    layer: "core",
    source_ref: "FTC toll text scam guidance",
    risk: "fraud",
    tags: ["notifications", "support", "security"],
  }),
  rule({
    rule_id: "support.agent-account-360",
    title: "Agent Account 360 safe action model",
    summary: "Back-office support should separate read-only account context from money-changing, PII-changing, waiver, refund, and merge actions.",
    layer: "core",
    source_ref: "Tolling Management Domain Pack",
    risk: "staff_access",
    tags: ["account-360", "rbac", "audit"],
  }),
]);

const REGIONAL_RULES = Object.freeze({
  texas: [
    rule({
      rule_id: "regional.texas-tag-interoperability",
      title: "Texas tag interoperability example",
      summary: "Texas-style overlays should model tag brand, home agency, away agency, regional partner references, and pay-by-mail handoff separately.",
      layer: "regional",
      layer_id: "regional:texas",
      source_ref: "TxDOT toll roads and HCTRA operations",
      risk: "interoperability",
      tags: ["texas", "interoperability", "tags"],
    }),
    rule({
      rule_id: "regional.texas-billing-support-handoff",
      title: "Regional billing and support handoff",
      summary: "Billing source, account transition state, and regional partner reconciliation must remain visible to agents and reports.",
      layer: "regional",
      layer_id: "regional:texas",
      source_ref: "TxDOT toll roads and HCTRA operations",
      risk: "customer_support",
      tags: ["billing", "support", "migration"],
    }),
  ],
});

const AGENCY_OVERLAYS = Object.freeze({
  "txdot-example": overlay({
    overlay_id: "txdot-example",
    name: "TxDOT Example Overlay",
    layer: "agency",
    description: "Example TxDOT-style toll operations overlay for demos and proposals.",
    rules: [
      rule({
        rule_id: "agency.txdot.transition-support",
        title: "Account transition support",
        summary: "Agent screens should show migration state, customer support ownership, and source billing system context.",
        layer: "agency",
        layer_id: "agency:txdot-example",
        source_ref: "TxDOT toll roads and HCTRA operations",
        risk: "migration",
        tags: ["txdot", "support"],
      }),
    ],
  }),
  "hctra-example": overlay({
    overlay_id: "hctra-example",
    name: "HCTRA-style Example Overlay",
    layer: "agency",
    description: "Example HCTRA-style EZ TAG overlay for Account 360, notices, and transponder support.",
    rules: [
      rule({
        rule_id: "agency.hctra-account-good-standing",
        title: "Account good-standing support",
        summary: "Support flows should surface account funding state, payment method responsibility, and suspension risk as configurable policy.",
        layer: "agency",
        layer_id: "agency:hctra-example",
        source_ref: "HCTRA EZ TAG Agreement",
        risk: "account_status",
        tags: ["hctra", "account", "support"],
      }),
      rule({
        rule_id: "agency.hctra-transponder-replacement",
        title: "Transponder replacement workflow",
        summary: "Replacement-tag requests should track activation, mounting responsibility, inventory reservation, and audit notes.",
        layer: "agency",
        layer_id: "agency:hctra-example",
        source_ref: "HCTRA EZ TAG Agreement",
        risk: "inventory",
        tags: ["hctra", "transponder", "fulfillment"],
      }),
    ],
  }),
  "ntta-example": overlay({
    overlay_id: "ntta-example",
    name: "NTTA-style Example Overlay",
    layer: "agency",
    description: "Example NTTA-style TollTag and ZipCash overlay for demos and proposals.",
    rules: [
      rule({
        rule_id: "agency.ntta-invoice-billing",
        title: "Prepaid tag and invoice-billing distinction",
        summary: "Customer portal and support flows should distinguish prepaid tag accounts from invoice/pay-by-mail billing paths.",
        layer: "agency",
        layer_id: "agency:ntta-example",
        source_ref: "NTTA TollTag and ZipCash",
        risk: "billing",
        tags: ["ntta", "invoice", "zipcash"],
      }),
    ],
  }),
});

const OUTPUT_ALIASES = Object.freeze({
  "domain-memory-pack": "domain-pack",
  "memory-pack": "domain-pack",
  "demo-kit": "sales-demo-kit",
  "sales-kit": "sales-demo-kit",
  microsite: "website",
  "website-microsite": "website",
  prototype: "ui-prototype",
  "ui-prototype-spec": "ui-prototype",
  rfp: "proposal",
  "rfp-starter": "proposal",
  "proposal-rfp-starter": "proposal",
  benchmark: "benchmarks",
  "benchmark-scenarios": "benchmarks",
  "ai-context-pack": "context-pack",
});

const SENSITIVE_PATTERNS = Object.freeze([
  { id: "card_number", pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2})[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/ },
  { id: "secret", pattern: /\b(?:sk-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{20,})\b/i },
  { id: "plate_like_real", pattern: /\b[A-Z]{3}[- ]?\d{4}\b/ },
]);

const FALLBACK_BENCHMARKS = Object.freeze([
  {
    id: "tolling-trip-posting-dedupe",
    title: "Duplicate Trip Posting Prevention",
    task_prompt: "Fix a duplicate toll posting bug when the same lane event is replayed after an acknowledgement timeout.",
    expected_context_files: ["packs/tolling-management/trip-posting.md", "packs/tolling-management/business-rules.md"],
    guardrails: ["posting must be idempotent", "money-changing actions require audit"],
    roi_fields: ["prompt_tokens_avoided", "implementation_defects_avoided"],
  },
  {
    id: "tolling-low-confidence-image-review",
    title: "Low Confidence Image Review Queue",
    task_prompt: "Add an operator queue for low-confidence OCR results with human review and audit.",
    expected_context_files: ["packs/tolling-management/ai-image-review.md", "packs/tolling-management/security-privacy.md"],
    guardrails: ["low-confidence outcomes require human review", "raw image access is restricted"],
    roi_fields: ["manual_review_time_reduced", "image_storage_cost_lever_identified"],
  },
  {
    id: "tolling-support-smishing-guidance",
    title: "Toll Text Scam Support Guidance",
    task_prompt: "Add a support response for customers asking whether a toll payment text message is legitimate.",
    expected_context_files: ["packs/tolling-management/customer-support.md", "packs/tolling-management/source-notes.md"],
    guardrails: ["direct users to official agency websites or known phone numbers", "do not validate unknown payment links"],
    roi_fields: ["support_cases_deflected_safely", "security_risk_reduced"],
  },
]);

export async function listDomainPacks(options = {}) {
  const packRoot = resolveDomainPackRoot(options);
  const entries = await safeReaddir(packRoot);
  const packs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const pack = await loadDomainPackMetadata(entry.name, { ...options, packRoot });
    if (pack) {
      packs.push(compactDomainPack(pack));
    }
  }

  packs.sort((left, right) => left.pack_id.localeCompare(right.pack_id));
  if (packs.length === 0) {
    const fallback = createFallbackDomainPackMetadata("tolling-management", path.join(packRoot, "tolling-management"));
    packs.push(compactDomainPack(fallback));
  }
  return packs;
}

export async function getDomainPack(packId, options = {}) {
  const pack = await loadRequiredDomainPack(packId, options);
  const benchmarks = await getPackBenchmarks(pack.pack_id, options);
  return {
    ...publicDomainPackFields(pack),
    layers_available: listStaticPackLayers(pack.pack_id),
    artifacts_available: [...PACK_OUTPUTS],
    required_inputs: ["output_type", "layer_selection"],
    optional_inputs: ["regional_layer", "agency_overlay", "customer_requirements", "customer_overlay", "token_budget", "repo_id"],
    source_notes: await getPackSourceNotes(pack.pack_id, options),
    benchmark_scenarios: benchmarks.scenarios,
    build_options: getPackBuildOptions(pack.pack_id),
    generated_outputs: PACK_OUTPUTS.map((output) => output.id),
  };
}

export async function validateDomainPack(packId, options = {}) {
  const errors = [];
  const warnings = [];
  const pack = await loadDomainPackMetadata(packId, options);

  if (!pack) {
    return {
      schema_version: DOMAIN_PACK_SCHEMA_VERSION,
      pack_id: packId,
      status: "invalid",
      errors: [`Domain pack "${packId}" was not found.`],
      warnings,
      next_action: "Run heart packs list to see available packs.",
    };
  }

  for (const [documentKey, documentPath] of Object.entries(pack.documents ?? {})) {
    const exists = await fileExists(path.join(pack.pack_root, String(documentPath)));
    if (!exists) {
      errors.push(`Missing ${documentKey} document: ${documentPath}`);
    }
  }

  if (listStaticPackLayers(pack.pack_id).length === 0) {
    errors.push("No pack layers are registered.");
  }
  if (PACK_OUTPUTS.length === 0) {
    errors.push("No generated artifact outputs are registered.");
  }

  return {
    schema_version: DOMAIN_PACK_SCHEMA_VERSION,
    pack_id: pack.pack_id,
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
    warnings,
    checked_at: new Date().toISOString(),
    next_action: errors.length > 0 ? "Repair missing pack files, then rerun heart packs validate." : "Build or inspect the pack.",
  };
}

export async function listPackLayers(packId, options = {}) {
  await loadRequiredDomainPack(packId, options);
  return listStaticPackLayers(packId);
}

export async function listPackArtifacts(packId, options = {}) {
  await loadRequiredDomainPack(packId, options);
  return [...PACK_OUTPUTS];
}

export async function getPackSourceNotes(packId, options = {}) {
  await loadRequiredDomainPack(packId, options);
  return SOURCE_NOTES.map((source) => ({ ...source }));
}

export async function getPackBenchmarks(packId, options = {}) {
  const pack = await loadRequiredDomainPack(packId, options);
  const benchmarksPath = pack.documents?.benchmarks
    ? path.join(pack.pack_root, pack.documents.benchmarks)
    : path.join(pack.pack_root, "benchmark-scenarios.json");
  const raw = await readFileOrDefault(benchmarksPath, "");
  const parsed = raw
    ? safeJsonParse(raw, {
        schema_version: 1,
        pack_id: pack.pack_id,
        scenarios: [],
      })
    : {
        schema_version: 1,
        pack_id: pack.pack_id,
        scenarios: pack.pack_id === "tolling-management" ? cloneJson(FALLBACK_BENCHMARKS) : [],
      };

  return {
    schema_version: parsed.schema_version ?? 1,
    pack_id: parsed.pack_id ?? pack.pack_id,
    scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : [],
    source_path: relativePackPath(pack.pack_root, benchmarksPath),
  };
}

export function getPackBuildOptions(packId = "tolling-management") {
  return {
    schema_version: DOMAIN_PACK_SCHEMA_VERSION,
    pack_id: packId,
    outputs: [...PACK_OUTPUTS],
    layers: listStaticPackLayers(packId),
    regional_layers: PACK_LAYERS.filter((layer) => layer.layer === "regional"),
    agency_overlays: Object.values(AGENCY_OVERLAYS).map((entry) => ({
      overlay_id: entry.overlay_id,
      name: entry.name,
      description: entry.description,
      layer: entry.layer,
      rule_count: entry.rules.length,
    })),
    customer_overlay: {
      supported: true,
      max_length: 4000,
      validation: ["no secrets", "no real PII", "no raw payment data", "source label required for binding policy"],
    },
    token_budgets: {
      compact: 1200,
      standard: 3500,
      deep: 7000,
    },
  };
}

export async function loadPackLayer(packId, layerId, options = {}) {
  await loadRequiredDomainPack(packId, options);
  const normalized = normalizeLayerId(layerId);
  if (normalized === "core") {
    return {
      id: "core",
      layer: "core",
      label: "Core",
      priority: 1,
      rules: CORE_RULES.map((entry) => ({ ...entry })),
    };
  }
  if (normalized.startsWith("regional:")) {
    const regionId = normalized.split(":")[1];
    return {
      id: `regional:${regionId}`,
      layer: "regional",
      region_id: regionId,
      label: `Regional: ${titleCase(regionId)}`,
      priority: 2,
      rules: (REGIONAL_RULES[regionId] ?? []).map((entry) => ({ ...entry })),
    };
  }
  if (normalized.startsWith("agency:")) {
    const agencyId = normalized.split(":")[1];
    return loadAgencyOverlay(packId, agencyId, options);
  }
  if (normalized.startsWith("customer:")) {
    return {
      id: normalized,
      layer: "customer",
      customer_overlay_id: normalized.split(":")[1],
      label: "Customer Overlay",
      priority: 4,
      rules: [],
    };
  }
  throw new Error(`Unknown layer "${layerId}". Next action: run heart packs layers ${packId}.`);
}

export async function loadAgencyOverlay(packId, agencyId, options = {}) {
  await loadRequiredDomainPack(packId, options);
  const normalized = sanitizeToken(agencyId);
  const overlayEntry = AGENCY_OVERLAYS[normalized];
  if (!overlayEntry) {
    throw new Error(`Unknown agency overlay "${agencyId}". Next action: run heart packs layers ${packId}.`);
  }

  return {
    id: `agency:${overlayEntry.overlay_id}`,
    layer: "agency",
    agency_id: overlayEntry.overlay_id,
    priority: 3,
    ...cloneJson(overlayEntry),
  };
}

export async function loadCustomerOverlay(packId, customerOverlayId, options = {}) {
  await loadRequiredDomainPack(packId, options);
  const overlayId = sanitizeToken(customerOverlayId, "customer-overlay");
  return {
    id: `customer:${overlayId}`,
    overlay_id: overlayId,
    name: "Customer Overlay",
    layer: "customer",
    priority: 4,
    description: "Customer-specific accepted requirements and implementation rules.",
    rules: [],
  };
}

export async function mergePackLayers(input = {}, options = {}) {
  const packId = input.pack_id ?? input.packId ?? "tolling-management";
  await loadRequiredDomainPack(packId, options);
  const layers = [await loadPackLayer(packId, "core", options)];
  const regionalLayer = input.regional_layer ?? input.regionalLayer;
  const agencyOverlay = input.agency_overlay ?? input.agencyOverlay;
  const customerOverlay = normalizeCustomerOverlay(input);
  const acceptedDocsOverlay = normalizeAcceptedCustomerDocs(input);

  if (regionalLayer) {
    layers.push(await loadPackLayer(packId, `regional:${sanitizeToken(regionalLayer)}`, options));
  }
  if (agencyOverlay) {
    layers.push(await loadAgencyOverlay(packId, agencyOverlay, options));
  }
  if (customerOverlay) {
    layers.push(customerOverlay);
  }
  if (acceptedDocsOverlay) {
    layers.push(acceptedDocsOverlay);
  }

  const validation = customerOverlay ? validateOverlayRules(customerOverlay) : { status: "valid", errors: [], warnings: [] };
  const byRuleId = new Map();
  const conflicts = [];
  const citations = [];

  for (const layer of layers.sort((left, right) => left.priority - right.priority)) {
    for (const layerRule of layer.rules ?? []) {
      const normalizedRule = normalizeRule({ ...layerRule, layer: layer.layer, layer_id: layer.id });
      const previous = byRuleId.get(normalizedRule.rule_id);
      if (previous && !rulesEquivalent(previous, normalizedRule)) {
        conflicts.push(createRuleConflict(previous, normalizedRule));
      }
      byRuleId.set(normalizedRule.rule_id, normalizedRule);
      const citation = citeRuleSource(normalizedRule);
      if (citation) {
        citations.push(citation);
      }
    }
  }

  return {
    schema_version: DOMAIN_PACK_SCHEMA_VERSION,
    pack_id: packId,
    layer_priority: ["core", "regional", "agency", "customer", "accepted_customer_docs"],
    selected_layers: layers.map((layer) => ({
      id: layer.id,
      layer: layer.layer,
      label: layer.label ?? layer.name ?? layer.id,
      priority: layer.priority,
      rule_count: layer.rules?.length ?? 0,
    })),
    effective_rules: [...byRuleId.values()],
    conflicts,
    citations: dedupeCitations(citations),
    overlay_validation: validation,
    warnings: [...PACK_SECURITY_WARNINGS, ...(validation.warnings ?? [])],
  };
}

export async function detectPackLayerConflicts(input = {}, options = {}) {
  const merged = await mergePackLayers(input, options);
  return merged.conflicts;
}

export async function explainEffectivePackRules(input = {}, options = {}) {
  const merged = await mergePackLayers(input, options);
  return {
    schema_version: DOMAIN_PACK_SCHEMA_VERSION,
    pack_id: merged.pack_id,
    summary: `Effective ${merged.pack_id} rules combine ${merged.selected_layers.length} layer(s) with ${merged.conflicts.length} surfaced conflict(s).`,
    rules_by_layer: groupBy(merged.effective_rules, "layer"),
    conflicts: merged.conflicts,
    citations: merged.citations,
    warnings: merged.warnings,
  };
}

export function citePackRuleSource(ruleId) {
  const allRules = [
    ...CORE_RULES,
    ...Object.values(REGIONAL_RULES).flat(),
    ...Object.values(AGENCY_OVERLAYS).flatMap((entry) => entry.rules),
  ];
  const found = allRules.find((entry) => entry.rule_id === ruleId);
  return found ? citeRuleSource(found) : null;
}

export function validateOverlayRules(overlay = {}) {
  const errors = [];
  const warnings = [];
  const serialized = JSON.stringify(overlay ?? {});

  if (!overlay || typeof overlay !== "object" || Array.isArray(overlay)) {
    errors.push("Overlay must be an object.");
  }
  if (!Array.isArray(overlay.rules)) {
    errors.push("Overlay rules must be an array.");
  }
  for (const sensitive of SENSITIVE_PATTERNS) {
    if (sensitive.pattern.test(serialized)) {
      errors.push(`Overlay appears to include ${sensitive.id}. Use fake demo-safe values only.`);
    }
  }
  if (!String(overlay.overlay_id ?? overlay.customer_overlay_id ?? "").trim()) {
    warnings.push("Overlay has no stable overlay_id.");
  }

  return {
    schema_version: DOMAIN_PACK_SCHEMA_VERSION,
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
    warnings,
  };
}

export async function createPackArtifactManifest({
  packId = "tolling-management",
  outputType = "domain-pack",
  regionalLayer,
  agencyOverlay,
  customerRequirements = "",
  customerOverlay,
  tokenBudget,
  generatedFiles = [],
  now = new Date().toISOString(),
  sourceRepoRoot,
} = {}) {
  const output = normalizeOutputType(outputType);
  const merged = await mergePackLayers({
    pack_id: packId,
    regional_layer: regionalLayer,
    agency_overlay: agencyOverlay,
    customer_overlay: customerOverlay,
    customer_requirements: customerRequirements,
  }, { repoRoot: sourceRepoRoot ?? process.cwd() });
  const hash = createHash("sha256")
    .update(JSON.stringify({
      packId,
      output,
      regionalLayer,
      agencyOverlay,
      customerRequirements: redactSensitiveText(customerRequirements),
      now,
    }))
    .digest("hex")
    .slice(0, 10);
  const artifactId = `pack-${sanitizeToken(packId)}-${output}-${compactIsoTimestamp(now)}-${hash}`;

  return {
    schema_version: PACK_ARTIFACT_MANIFEST_SCHEMA_VERSION,
    artifact_id: artifactId,
    pack_id: packId,
    output_type: output,
    layer_selection: {
      core: true,
      regional_layer: regionalLayer ? sanitizeToken(regionalLayer) : "",
      agency_overlay: agencyOverlay ? sanitizeToken(agencyOverlay) : "",
      customer_overlay_id: customerOverlay?.overlay_id ?? customerOverlay?.customer_overlay_id ?? "",
    },
    inputs: {
      customer_requirements: redactSensitiveText(customerRequirements).slice(0, 1200),
      token_budget: Number.isFinite(Number(tokenBudget)) ? Number(tokenBudget) : null,
    },
    generated_files: generatedFiles,
    source_citations: merged.citations,
    conflicts: merged.conflicts,
    warnings: merged.warnings,
    created_at: now,
  };
}

export async function writePackArtifact({
  repoRoot = process.cwd(),
  sourceRepoRoot,
  packId = "tolling-management",
  outputType = "domain-pack",
  regionalLayer,
  agencyOverlay,
  customerRequirements = "",
  customerOverlay,
  tokenBudget,
  now = new Date().toISOString(),
} = {}) {
  const sourceRoot = sourceRepoRoot ?? repoRoot;
  const output = normalizeOutputType(outputType);
  const relativeFiles = outputFilesForType(output);
  const manifest = await createPackArtifactManifest({
    packId,
    outputType: output,
    regionalLayer,
    agencyOverlay,
    customerRequirements,
    customerOverlay,
    tokenBudget,
    generatedFiles: relativeFiles,
    now,
    sourceRepoRoot: sourceRoot,
  });
  const artifactDir = path.join(
    path.resolve(repoRoot),
    ".heart",
    "packs",
    sanitizeToken(packId),
    "generated",
    output,
    manifest.artifact_id,
  );
  await fs.mkdir(artifactDir, { recursive: true });

  const merged = await mergePackLayers({
    pack_id: packId,
    regional_layer: regionalLayer,
    agency_overlay: agencyOverlay,
    customer_overlay: customerOverlay,
    customer_requirements: customerRequirements,
  }, { repoRoot: sourceRoot });

  const writtenFiles = [];
  for (const relativeFile of relativeFiles) {
    const targetPath = path.join(artifactDir, relativeFile);
    await fs.writeFile(
      targetPath,
      renderPackArtifactContent({
        packId,
        output,
        regionalLayer,
        agencyOverlay,
        customerRequirements,
        merged,
        now,
      }),
      "utf8",
    );
    writtenFiles.push(targetPath);
  }

  const manifestPath = path.join(artifactDir, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    status: "generated",
    artifact_id: manifest.artifact_id,
    output_dir: artifactDir,
    manifest_path: manifestPath,
    generated_files: writtenFiles,
    manifest,
    next_actions: [
      "Open generated artifact in the portal or sync it to the pack source tree.",
      `heart packs open ${packId}`,
      `heart packs sync ${packId}`,
    ],
  };
}

export async function listGeneratedPackArtifacts({
  repoRoot = process.cwd(),
  packId = "tolling-management",
} = {}) {
  const generatedRoot = path.join(path.resolve(repoRoot), ".heart", "packs", sanitizeToken(packId), "generated");
  const outputs = await safeReaddir(generatedRoot);
  const artifacts = [];

  for (const outputEntry of outputs) {
    if (!outputEntry.isDirectory()) {
      continue;
    }
    const outputDir = path.join(generatedRoot, outputEntry.name);
    const entries = await safeReaddir(outputDir);
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const manifest = await readJsonOrDefault(path.join(outputDir, entry.name, "manifest.json"), null);
      if (manifest) {
        artifacts.push({
          ...manifest,
          artifact_dir: path.join(outputDir, entry.name),
          manifest_path: path.join(outputDir, entry.name, "manifest.json"),
        });
      }
    }
  }

  artifacts.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
  return artifacts;
}

export async function readGeneratedPackArtifact({
  repoRoot = process.cwd(),
  packId = "tolling-management",
  artifactId,
} = {}) {
  const artifacts = await listGeneratedPackArtifacts({ repoRoot, packId });
  const artifact = artifacts.find((entry) => entry.artifact_id === artifactId) ?? artifacts[0];
  if (!artifact) {
    return null;
  }
  const files = [];
  for (const relativeFile of artifact.generated_files ?? []) {
    const filePath = path.join(artifact.artifact_dir, relativeFile);
    files.push({
      path: relativeFile,
      content: await readFileOrDefault(filePath, ""),
    });
  }
  return {
    manifest: artifact,
    files,
  };
}

export async function syncGeneratedPackArtifact({
  repoRoot = process.cwd(),
  packId = "tolling-management",
  artifactId,
} = {}) {
  const artifact = await readGeneratedPackArtifact({ repoRoot, packId, artifactId });
  if (!artifact) {
    return {
      status: "not_found",
      pack_id: packId,
      next_action: `Run heart packs build ${packId} --output sales-demo-kit first.`,
    };
  }

  const targetDir = path.join(
    path.resolve(repoRoot),
    "packs",
    sanitizeToken(packId),
    "generated",
    artifact.manifest.output_type,
    artifact.manifest.artifact_id,
  );
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, "manifest.json"), `${JSON.stringify(artifact.manifest, null, 2)}\n`, "utf8");
  for (const file of artifact.files) {
    await fs.writeFile(path.join(targetDir, file.path), file.content, "utf8");
  }

  return {
    status: "synced",
    pack_id: packId,
    artifact_id: artifact.manifest.artifact_id,
    target_dir: targetDir,
    next_action: "Commit generated artifacts only after reviewing source citations, warnings, and customer-specific assumptions.",
  };
}

export function validateGeneratedPackArtifact(manifest = {}) {
  const errors = [];
  if (manifest.schema_version !== PACK_ARTIFACT_MANIFEST_SCHEMA_VERSION) {
    errors.push("Unsupported pack artifact manifest schema_version.");
  }
  for (const field of ["artifact_id", "pack_id", "output_type", "created_at"]) {
    if (!String(manifest[field] ?? "").trim()) {
      errors.push(`Missing ${field}.`);
    }
  }
  if (!Array.isArray(manifest.generated_files)) {
    errors.push("generated_files must be an array.");
  }
  const serialized = JSON.stringify(manifest);
  for (const sensitive of SENSITIVE_PATTERNS) {
    if (sensitive.pattern.test(serialized)) {
      errors.push(`Manifest appears to include ${sensitive.id}.`);
    }
  }
  return {
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
  };
}

export function normalizeOutputType(outputType) {
  const normalized = sanitizeToken(outputType || "domain-pack");
  const aliased = OUTPUT_ALIASES[normalized] ?? normalized;
  if (!PACK_OUTPUTS.some((output) => output.id === aliased)) {
    throw new Error(`Unknown pack output "${outputType}". Next action: run heart packs show tolling-management.`);
  }
  return aliased;
}

function compactDomainPack(pack) {
  return {
    schema_version: DOMAIN_PACK_SCHEMA_VERSION,
    pack_id: pack.pack_id,
    name: pack.name,
    description: pack.description,
    version: pack.version,
    category: pack.category,
    layers_available: listStaticPackLayers(pack.pack_id),
    artifacts_available: [...PACK_OUTPUTS],
    required_inputs: ["output_type", "layer_selection"],
    optional_inputs: ["regional_layer", "agency_overlay", "customer_requirements", "token_budget"],
    source_notes_count: SOURCE_NOTES.length,
    benchmark_scenario_count: pack.benchmark_scenario_count ?? 0,
    generated_outputs: PACK_OUTPUTS.map((output) => output.id),
    security_warnings: [...PACK_SECURITY_WARNINGS],
    status: pack.status,
    last_updated: pack.last_updated,
  };
}

function publicDomainPackFields(pack) {
  return {
    schema_version: pack.schema_version,
    pack_id: pack.pack_id,
    name: pack.name,
    description: pack.description,
    version: pack.version,
    category: pack.category,
    status: pack.status,
    last_updated: pack.last_updated,
    pack_type: pack.pack_type,
    base_pack_only: pack.base_pack_only,
    customer_overlay_supported: pack.customer_overlay_supported,
    primary_use_cases: pack.primary_use_cases,
    recommended_context_budget: pack.recommended_context_budget,
    documents: pack.documents,
    sensitivity_defaults: pack.sensitivity_defaults,
    benchmark_scenario_count: pack.benchmark_scenario_count,
    security_warnings: pack.security_warnings,
  };
}

async function loadRequiredDomainPack(packId, options = {}) {
  const pack = await loadDomainPackMetadata(packId, options);
  if (!pack) {
    throw new Error(`Domain pack "${packId}" was not found. Next action: run heart packs list.`);
  }
  return pack;
}

async function loadDomainPackMetadata(packId, options = {}) {
  const safePackId = sanitizeToken(packId);
  const packRoot = options.packRoot ?? resolveDomainPackRoot(options);
  const packDir = path.join(packRoot, safePackId);
  const raw = await readFileOrDefault(path.join(packDir, "pack.yaml"), "");
  if (!raw) {
    return safePackId === "tolling-management"
      ? createFallbackDomainPackMetadata(safePackId, packDir)
      : null;
  }

  const parsed = parseSimpleYaml(raw);
  const benchmarks = await readJsonOrDefault(path.join(packDir, "benchmark-scenarios.json"), { scenarios: [] });
  return {
    schema_version: DOMAIN_PACK_SCHEMA_VERSION,
    pack_id: String(parsed.pack_id ?? safePackId),
    name: safePackId === "tolling-management" ? "Tolling Management" : String(parsed.name ?? safePackId),
    description:
      safePackId === "tolling-management"
        ? "Layered tolling back-office, customer portal, payments, disputes, roadside operations, and sales-demo MVP domain memory."
        : String(parsed.description ?? parsed.name ?? safePackId),
    version: String(parsed.version ?? parsed.retrieved_at ?? "0.1.0").replaceAll("-", "."),
    category: safePackId === "tolling-management" ? "transportation.tolling" : "domain",
    status: String(parsed.status ?? "draft"),
    last_updated: String(parsed.last_updated ?? parsed.retrieved_at ?? "unknown"),
    pack_type: String(parsed.pack_type ?? "industry_domain"),
    base_pack_only: Boolean(parsed.base_pack_only),
    customer_overlay_supported: parsed.customer_overlay_supported !== false,
    primary_use_cases: Array.isArray(parsed.primary_use_cases) ? parsed.primary_use_cases : [],
    recommended_context_budget: parsed.recommended_context_budget ?? {},
    documents: parsed.documents ?? {},
    sensitivity_defaults: parsed.sensitivity_defaults ?? {},
    benchmark_scenario_count: Array.isArray(benchmarks.scenarios) ? benchmarks.scenarios.length : 0,
    pack_root: packDir,
    pack_yaml_path: path.join(packDir, "pack.yaml"),
    security_warnings: [...PACK_SECURITY_WARNINGS],
  };
}

function createFallbackDomainPackMetadata(packId, packDir) {
  return {
    schema_version: DOMAIN_PACK_SCHEMA_VERSION,
    pack_id: packId,
    name: "Tolling Management",
    description: "Layered tolling back-office, customer portal, payments, disputes, roadside operations, and sales-demo MVP domain memory.",
    version: "2026.05.02",
    category: "transportation.tolling",
    status: "draft",
    last_updated: "2026-05-02",
    pack_type: "industry_domain",
    base_pack_only: true,
    customer_overlay_supported: true,
    primary_use_cases: ["back_office", "road_side", "trip_posting", "image_review", "customer_support", "ai_agent_support"],
    recommended_context_budget: {
      minimal_tokens: 1200,
      standard_tokens: 3500,
      deep_tokens: 7000,
    },
    documents: {},
    sensitivity_defaults: {
      redact_by_default: ["license_plate", "plate_image", "vehicle_owner", "address", "account_balance", "payment_status", "trip_history"],
      never_include: ["card_number", "bank_account_number", "raw_secret", "production_endpoint_secret"],
    },
    benchmark_scenario_count: FALLBACK_BENCHMARKS.length,
    pack_root: packDir,
    pack_yaml_path: path.join(packDir, "pack.yaml"),
    security_warnings: [...PACK_SECURITY_WARNINGS],
  };
}

function resolveDomainPackRoot(options = {}) {
  if (options.packRoot) {
    return path.resolve(options.packRoot);
  }

  const monorepoRoot = resolveMonorepoRoot({
    startDir: options.sourceRepoRoot ?? options.repoRoot ?? process.cwd(),
    fallbackDir: process.cwd(),
  });
  return path.join(monorepoRoot, "packs");
}

function listStaticPackLayers(packId) {
  if (sanitizeToken(packId) !== "tolling-management") {
    return [];
  }
  return PACK_LAYERS.map((layer) => ({ ...layer }));
}

function rule(input) {
  return normalizeRule(input);
}

function overlay(input) {
  return {
    ...input,
    rules: (input.rules ?? []).map((entry) => normalizeRule(entry)),
  };
}

function normalizeRule(input = {}) {
  return {
    rule_id: sanitizeRuleId(input.rule_id),
    title: String(input.title ?? input.rule_id ?? "Rule"),
    summary: String(input.summary ?? ""),
    layer: String(input.layer ?? "core"),
    layer_id: String(input.layer_id ?? input.layer ?? "core"),
    source_ref: String(input.source_ref ?? "Tolling Management Domain Pack"),
    risk: String(input.risk ?? "domain"),
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => String(tag)) : [],
  };
}

function normalizeLayerId(layerId = "") {
  const normalized = String(layerId || "core").trim().toLowerCase();
  if (["core", "regional", "agency", "customer"].includes(normalized)) {
    return normalized;
  }
  if (normalized === "texas") {
    return "regional:texas";
  }
  if (AGENCY_OVERLAYS[normalized]) {
    return `agency:${normalized}`;
  }
  return normalized;
}

function normalizeCustomerOverlay(input = {}) {
  const explicit = input.customer_overlay ?? input.customerOverlay;
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) {
    return {
      id: `customer:${sanitizeToken(explicit.overlay_id ?? explicit.customer_overlay_id ?? "customer")}`,
      overlay_id: sanitizeToken(explicit.overlay_id ?? explicit.customer_overlay_id ?? "customer"),
      name: String(explicit.name ?? "Customer Overlay"),
      layer: "customer",
      label: "Customer Overlay",
      priority: 4,
      rules: Array.isArray(explicit.rules) ? explicit.rules.map((entry) => normalizeRule({ ...entry, layer: "customer", layer_id: "customer" })) : [],
    };
  }

  const customerRequirements = String(input.customer_requirements ?? input.customerRequirements ?? "").trim();
  if (!customerRequirements) {
    return null;
  }

  return {
    id: "customer:ad-hoc",
    overlay_id: "ad-hoc",
    name: "Customer Requirements",
    layer: "customer",
    label: "Customer Requirements",
    priority: 4,
    rules: [
      normalizeRule({
        rule_id: customerRequirements.toLowerCase().includes("sms payment link")
          ? "notification.official-payment-link"
          : "customer.requirements",
        title: "Customer-specific requirement",
        summary: redactSensitiveText(customerRequirements),
        layer: "customer",
        layer_id: "customer:ad-hoc",
        source_ref: "Customer-provided requirements",
        risk: "customer_policy",
        tags: ["customer-overlay"],
      }),
    ],
  };
}

function normalizeAcceptedCustomerDocs(input = {}) {
  const docs = input.accepted_customer_docs ?? input.acceptedCustomerDocs;
  if (!Array.isArray(docs) || docs.length === 0) {
    return null;
  }

  return {
    id: "accepted-customer-docs",
    overlay_id: "accepted-customer-docs",
    name: "Accepted Customer Docs",
    layer: "accepted_customer_docs",
    label: "Accepted Customer Docs",
    priority: 5,
    rules: docs.map((doc, index) => normalizeRule({
      rule_id: doc.rule_id ?? `accepted-doc.${index + 1}`,
      title: doc.title ?? `Accepted customer doc ${index + 1}`,
      summary: redactSensitiveText(doc.summary ?? doc.content ?? ""),
      layer: "accepted_customer_docs",
      layer_id: "accepted-customer-docs",
      source_ref: doc.source_ref ?? doc.path ?? "Accepted customer docs/specs",
      risk: doc.risk ?? "customer_policy",
      tags: ["accepted-doc"],
    })),
  };
}

function rulesEquivalent(left, right) {
  return (
    normalizeComparableText(left.summary) === normalizeComparableText(right.summary) &&
    String(left.source_ref) === String(right.source_ref)
  );
}

function createRuleConflict(previous, next) {
  return {
    conflict_id: `conflict-${previous.rule_id}-${sanitizeToken(previous.layer)}-${sanitizeToken(next.layer)}`,
    rule_id: previous.rule_id,
    severity: ["payment_data", "fraud", "privacy", "money_movement"].includes(previous.risk) ? "high" : "medium",
    earlier_layer: previous.layer,
    earlier_source_ref: previous.source_ref,
    later_layer: next.layer,
    later_source_ref: next.source_ref,
    summary: `Layer ${next.layer} overrides ${previous.layer} rule ${previous.rule_id}; review before generation or implementation.`,
    next_action: "Resolve this conflict in a customer overlay or accepted source document before treating it as implementation policy.",
  };
}

function citeRuleSource(ruleEntry) {
  const source = SOURCE_NOTES.find((entry) => entry.source_ref === ruleEntry.source_ref);
  return {
    rule_id: ruleEntry.rule_id,
    source_ref: ruleEntry.source_ref,
    label: source?.label ?? ruleEntry.source_ref,
    url: source?.url ?? "",
    layer: ruleEntry.layer,
  };
}

function dedupeCitations(citations) {
  const seen = new Set();
  const result = [];
  for (const citation of citations) {
    const key = `${citation.rule_id}:${citation.source_ref}:${citation.layer}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(citation);
    }
  }
  return result;
}

function outputFilesForType(output) {
  const byType = {
    "domain-pack": ["domain-pack.md"],
    "sales-demo-kit": ["sales-demo-kit.md"],
    website: ["website-microsite.md"],
    "ui-prototype": ["ui-prototype-spec.md"],
    proposal: ["proposal-rfp-starter.md"],
    benchmarks: ["benchmark-scenarios.md"],
    "context-pack": ["ai-context-pack.md"],
  };
  return byType[output] ?? ["artifact.md"];
}

function renderPackArtifactContent({
  packId,
  output,
  regionalLayer,
  agencyOverlay,
  customerRequirements,
  merged,
  now,
}) {
  const outputLabel = PACK_OUTPUTS.find((entry) => entry.id === output)?.label ?? output;
  const rules = merged.effective_rules.slice(0, 12).map((entry) => `- [${entry.layer}] ${entry.title}: ${entry.summary}`).join("\n");
  const conflicts = merged.conflicts.length > 0
    ? merged.conflicts.map((conflict) => `- ${conflict.severity}: ${conflict.summary}`).join("\n")
    : "- No conflicts detected for selected layers.";
  const citations = merged.citations.slice(0, 10).map((citation) => `- ${citation.label}${citation.url ? ` (${citation.url})` : ""}`).join("\n");
  const requirements = redactSensitiveText(customerRequirements).trim() || "No customer-specific requirements supplied.";

  return `# ${outputLabel}: ${packId}

Generated: ${now}

Layer selection:
- Core: enabled
- Regional: ${regionalLayer || "none"}
- Agency overlay: ${agencyOverlay || "none"}

MVP label:
This is generated demo and implementation-starting material. It is not production policy, legal advice, measured ROI evidence, or an official agency artifact.

## Customer Requirements

${requirements}

## Effective Rules

${rules}

## Conflicts And Warnings

${conflicts}

Security warnings:
${PACK_SECURITY_WARNINGS.map((warning) => `- ${warning}`).join("\n")}

## Source Citations

${citations}

## Next Actions

- Review conflicts before treating generated text as implementation policy.
- Replace demo-only assumptions with accepted customer docs/specs.
- Run benchmark scenarios before making ROI claims.
`;
}

function sanitizeToken(value, fallback = "item") {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function sanitizeRuleId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "rule";
}

function titleCase(value) {
  return String(value ?? "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function compactIsoTimestamp(value) {
  return String(value ?? new Date().toISOString()).replace(/[^0-9A-Za-z]/g, "");
}

function redactSensitiveText(value) {
  let result = String(value ?? "");
  for (const sensitive of SENSITIVE_PATTERNS) {
    result = result.replace(sensitive.pattern, `[redacted:${sensitive.id}]`);
  }
  return result;
}

function normalizeComparableText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function groupBy(items, key) {
  const grouped = {};
  for (const item of items) {
    const groupKey = item[key] ?? "unknown";
    grouped[groupKey] = grouped[groupKey] ?? [];
    grouped[groupKey].push(item);
  }
  return grouped;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function safeReaddir(directory) {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readFileOrDefault(targetPath, fallback) {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return fallback;
  }
}

async function readJsonOrDefault(targetPath, fallback) {
  const raw = await readFileOrDefault(targetPath, "");
  return raw ? safeJsonParse(raw, fallback) : fallback;
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function relativePackPath(packRoot, targetPath) {
  return path.relative(packRoot, targetPath).replaceAll(path.sep, "/");
}
