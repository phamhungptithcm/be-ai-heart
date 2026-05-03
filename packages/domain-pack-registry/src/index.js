import fs from "node:fs/promises";
import path from "node:path";

import {
  getDomainPack,
  listDomainPacks,
  validateDomainPack,
} from "../../core/src/index.js";

export const DOMAIN_PACK_REGISTRY_SCHEMA_VERSION = 1;

export { getDomainPack as loadDomainPack, listDomainPacks, validateDomainPack };

export async function selectDomainPack({ repoRoot = process.cwd(), domainId, prompt } = {}) {
  const packs = await listDomainPacks({ repoRoot });
  const requested = normalizeDomainId(domainId ?? inferDomainId(prompt));
  const selected = packs.find((pack) => pack.pack_id === requested);

  if (!selected) {
    return {
      schema_version: DOMAIN_PACK_REGISTRY_SCHEMA_VERSION,
      status: "not_found",
      requested_domain_id: requested,
      selected_pack: null,
      packs,
      next_action: "Run heart generate domains or create a custom domain pack.",
    };
  }

  return {
    schema_version: DOMAIN_PACK_REGISTRY_SCHEMA_VERSION,
    status: "selected",
    selected_pack: await getDomainPack(selected.pack_id, { repoRoot }),
    default_layers: {
      core: true,
      regional_layer: selected.pack_id === "tolling-management" ? "texas" : "",
      agency_overlay: "",
    },
    next_action: "Select a stack preset.",
  };
}

export async function createDomainPack({
  repoRoot = process.cwd(),
  domainId,
  name,
  description = "",
  answers = [],
  outputRoot,
  now = new Date().toISOString(),
} = {}) {
  const packId = normalizeDomainId(domainId ?? name);
  if (!packId) {
    throw new Error("Domain pack needs a domainId or name.");
  }

  const packsRoot = path.resolve(outputRoot ?? path.join(repoRoot, "packs"));
  const packRoot = path.join(packsRoot, packId);
  assertInside(packsRoot, packRoot);

  const files = [
    {
      relative_path: "pack.yaml",
      content: renderPackYaml({ packId, name: name ?? titleCase(packId), description, now }),
    },
    {
      relative_path: "domain.md",
      content: renderDomainDoc({ name: name ?? titleCase(packId), description, answers }),
    },
    {
      relative_path: "workflows.md",
      content: "# Workflows\n\nGenerated assumptions. Replace with source-backed workflows before production use.\n",
    },
    {
      relative_path: "entities.yaml",
      content: `schema_version: 1\npack_id: ${packId}\nentities: {}\n`,
    },
    {
      relative_path: "security-privacy.md",
      content: "# Security And Privacy\n\nList sensitive data, trust boundaries, and generated-data rules here.\n",
    },
    {
      relative_path: "benchmark-scenarios.json",
      content: `${JSON.stringify({ schema_version: 1, pack_id: packId, scenarios: [] }, null, 2)}\n`,
    },
    {
      relative_path: "source-notes.md",
      content: "# Source Notes\n\nAdd source citations before treating generated rules as binding.\n",
    },
  ];

  await fs.mkdir(packRoot, { recursive: true });
  for (const file of files) {
    const targetPath = path.join(packRoot, file.relative_path);
    assertInside(packRoot, targetPath);
    await fs.writeFile(targetPath, file.content, "utf8");
  }

  return {
    schema_version: DOMAIN_PACK_REGISTRY_SCHEMA_VERSION,
    status: "created",
    pack_id: packId,
    pack_root: packRoot,
    generated_files: files.map((file) => path.join(packRoot, file.relative_path)),
    warnings: [
      "Generated custom domain pack is assumption-labeled until source notes are added.",
      "Do not use generated legal, medical, financial, or compliance rules as binding policy without approved sources.",
    ],
  };
}

export function normalizeDomainId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferDomainId(prompt = "") {
  const value = String(prompt ?? "").toLowerCase();
  if (/toll|tolling|transponder|gantry|ez tag|tolltag/.test(value)) {
    return "tolling-management";
  }
  return value;
}

function renderPackYaml({ packId, name, description, now }) {
  return [
    "schema_version: 1",
    `pack_id: ${packId}`,
    `name: ${name}`,
    "pack_type: custom_domain",
    "status: draft",
    `retrieved_at: "${now.slice(0, 10)}"`,
    "base_pack_only: true",
    "customer_overlay_supported: true",
    "primary_use_cases: []",
    "recommended_context_budget:",
    "  minimal_tokens: 1200",
    "  standard_tokens: 3500",
    "  deep_tokens: 7000",
    "documents:",
    "  domain: domain.md",
    "  workflows: workflows.md",
    "  entities: entities.yaml",
    "  security_privacy: security-privacy.md",
    "  benchmarks: benchmark-scenarios.json",
    "  sources: source-notes.md",
    "sensitivity_defaults:",
    "  redact_by_default: []",
    "  never_include:",
    "    - raw_secret",
    "    - production_endpoint_secret",
    description ? `description: ${JSON.stringify(description)}` : "",
    "",
  ].filter(Boolean).join("\n");
}

function renderDomainDoc({ name, description, answers }) {
  return [
    `# ${name}`,
    "",
    "Status: Generated custom domain skeleton. Replace assumptions with source-backed rules before production use.",
    "",
    "## Purpose",
    "",
    description || "Describe this domain and the product outcome it should support.",
    "",
    "## Interview Answers",
    "",
    ...(answers.length > 0
      ? answers.map((answer) => `- ${answer.question_id ?? "answer"}: ${Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer}`)
      : ["- No structured answers captured yet."]),
    "",
    "## Required Follow-Up",
    "",
    "- Add source notes.",
    "- Define workflows.",
    "- Define entities and sensitive fields.",
    "- Define benchmark scenarios.",
    "- Validate assumptions with domain owner.",
    "",
  ].join("\n");
}

function titleCase(value) {
  return String(value ?? "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function assertInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Refusing to write outside the selected domain pack directory.");
  }
}
