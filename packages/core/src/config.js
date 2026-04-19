import fs from "node:fs/promises";
import path from "node:path";
import { parseSimpleYaml } from "../../shared-schema/src/index.js";

export const KNOWN_MCP_TOOL_NAMES = Object.freeze([
  "project_overview",
  "symbol_lookup",
  "dependency_explain",
  "context_pack",
  "impact_analysis",
  "document_search",
  "policy_check",
]);

export const DEFAULT_CONFIG = Object.freeze({
  project: {
    name: "be-ai-heart",
    language_priority: ["typescript", "javascript"],
    entrypoints: ["packages", "apps", "services"],
    ignore: [
      "node_modules",
      "dist",
      "coverage",
      ".git",
      ".worktrees",
      ".next",
      "output",
      ".playwright-cli",
      ".heart/benchmarks",
      ".heart/cache",
      ".heart/diagrams",
      ".heart/published",
    ],
  },
  policies: {
    rules_file: ".heart/policies.yaml",
  },
  indexing: {
    incremental: true,
    embeddings: "disabled",
  },
  knowledge: {
    document_paths: ["docs"],
  },
  mcp: {
    enabled_tools: [...KNOWN_MCP_TOOL_NAMES],
  },
});

export function createDefaultConfig(projectName = "be-ai-heart") {
  return {
    ...DEFAULT_CONFIG,
    project: {
      ...DEFAULT_CONFIG.project,
      name: projectName,
    },
  };
}

export function createDefaultConfigYaml(projectName = "be-ai-heart") {
  return `project:
  name: ${projectName}
  language_priority:
    - typescript
    - javascript
  entrypoints:
    - packages
    - apps
    - services
  ignore:
    - node_modules
    - dist
    - coverage
    - .git
    - .worktrees
    - .next
    - output
    - .playwright-cli
    - .heart/benchmarks
    - .heart/cache
    - .heart/diagrams
    - .heart/published
policies:
  rules_file: .heart/policies.yaml
indexing:
  incremental: true
  embeddings: disabled
knowledge:
  document_paths:
    - docs
mcp:
  enabled_tools:
${KNOWN_MCP_TOOL_NAMES.map((tool) => `    - ${tool}`).join("\n")}
`;
}

export async function loadHeartConfig(repoRoot) {
  const configPath = path.join(repoRoot, "heart.config.yaml");

  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = parseSimpleYaml(raw);
    const normalized = normalizeConfigOverrides(parsed);
    const projectName = normalized.projectName ?? path.basename(repoRoot);

    return {
      exists: true,
      status: normalized.errors.length > 0 ? "invalid" : "loaded",
      path: configPath,
      raw,
      errors: normalized.errors,
      config: mergeConfig(createDefaultConfig(projectName), normalized.overrides),
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      return {
        exists: true,
        status: "invalid",
        path: configPath,
        raw: "",
        errors: [`Failed to parse heart.config.yaml: ${error.message}`],
        config: createDefaultConfig(path.basename(repoRoot)),
      };
    }

    return {
      exists: false,
      status: "missing",
      path: configPath,
      raw: "",
      errors: [],
      config: createDefaultConfig(path.basename(repoRoot)),
    };
  }
}

export function resolveDocumentRoots(config) {
  return [...new Set([...(config?.knowledge?.document_paths ?? []), ".heart/imported-documents"].filter(Boolean))];
}

export function resolveEnabledMcpTools(enabledTools) {
  if (!Array.isArray(enabledTools)) {
    return [...KNOWN_MCP_TOOL_NAMES];
  }

  const filtered = enabledTools.filter((tool) => KNOWN_MCP_TOOL_NAMES.includes(tool));
  return [...new Set(filtered)];
}

function mergeConfig(base, overrides) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return base;
  }

  const merged = { ...base };

  for (const [key, overrideValue] of Object.entries(overrides)) {
    const baseValue = merged[key];

    if (Array.isArray(overrideValue)) {
      merged[key] = [...overrideValue];
      continue;
    }

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      merged[key] = mergeConfig(baseValue, overrideValue);
      continue;
    }

    merged[key] = overrideValue;
  }

  return merged;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeConfigOverrides(parsed) {
  const errors = [];
  const overrides = {};
  const root = isPlainObject(parsed) ? parsed : {};
  reportUnknownKeys(root, ["project", "policies", "indexing", "knowledge", "mcp"], "config", errors);
  const project = normalizeProjectConfig(root.project, errors);
  const policies = normalizePoliciesConfig(root.policies, errors);
  const indexing = normalizeIndexingConfig(root.indexing, errors);
  const knowledge = normalizeKnowledgeConfig(root.knowledge, errors);
  const mcp = normalizeMcpConfig(root.mcp, errors);

  if (project) {
    overrides.project = project;
  }

  if (policies) {
    overrides.policies = policies;
  }

  if (indexing) {
    overrides.indexing = indexing;
  }

  if (knowledge) {
    overrides.knowledge = knowledge;
  }

  if (mcp) {
    overrides.mcp = mcp;
  }

  return {
    projectName: project?.name,
    overrides,
    errors,
  };
}

function normalizeProjectConfig(project, errors) {
  if (project === undefined) {
    return null;
  }

  if (!isPlainObject(project)) {
    errors.push("project must be a mapping when provided.");
    return null;
  }

  const normalized = {};
  reportUnknownKeys(project, ["name", "language_priority", "entrypoints", "ignore"], "project config", errors);

  if (typeof project.name === "string" && project.name.trim() !== "") {
    normalized.name = project.name.trim();
  } else if (project.name !== undefined) {
    errors.push("project.name must be a non-empty string.");
  }

  assignStringArray(normalized, project, "language_priority", errors);
  assignStringArray(normalized, project, "entrypoints", errors);
  assignStringArray(normalized, project, "ignore", errors);

  return Object.keys(normalized).length > 0 ? normalized : {};
}

function normalizePoliciesConfig(policies, errors) {
  if (policies === undefined) {
    return null;
  }

  if (!isPlainObject(policies)) {
    errors.push("policies must be a mapping when provided.");
    return null;
  }

  reportUnknownKeys(policies, ["rules_file"], "policies config", errors);

  if (policies.rules_file === undefined) {
    return {};
  }

  if (typeof policies.rules_file !== "string" || policies.rules_file.trim() === "") {
    errors.push("policies.rules_file must be a non-empty string.");
    return {};
  }

  return {
    rules_file: policies.rules_file.trim(),
  };
}

function normalizeIndexingConfig(indexing, errors) {
  if (indexing === undefined) {
    return null;
  }

  if (!isPlainObject(indexing)) {
    errors.push("indexing must be a mapping when provided.");
    return null;
  }

  const normalized = {};
  reportUnknownKeys(indexing, ["incremental", "embeddings"], "indexing config", errors);

  if (indexing.incremental !== undefined) {
    if (typeof indexing.incremental !== "boolean") {
      errors.push("indexing.incremental must be a boolean.");
    } else {
      normalized.incremental = indexing.incremental;
    }
  }

  if (indexing.embeddings !== undefined) {
    if (typeof indexing.embeddings !== "string" || indexing.embeddings.trim() === "") {
      errors.push("indexing.embeddings must be a non-empty string.");
    } else if (!["disabled", "local"].includes(indexing.embeddings.trim())) {
      errors.push("indexing.embeddings must be one of: disabled, local.");
    } else {
      normalized.embeddings = indexing.embeddings.trim();
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : {};
}

function normalizeKnowledgeConfig(knowledge, errors) {
  if (knowledge === undefined) {
    return null;
  }

  if (!isPlainObject(knowledge)) {
    errors.push("knowledge must be a mapping when provided.");
    return null;
  }

  const normalized = {};
  reportUnknownKeys(knowledge, ["document_paths"], "knowledge config", errors);
  assignStringArray(normalized, knowledge, "document_paths", errors);
  return Object.keys(normalized).length > 0 ? normalized : {};
}

function normalizeMcpConfig(mcp, errors) {
  if (mcp === undefined) {
    return null;
  }

  if (!isPlainObject(mcp)) {
    errors.push("mcp must be a mapping when provided.");
    return null;
  }

  reportUnknownKeys(mcp, ["enabled_tools"], "mcp config", errors);

  if (mcp.enabled_tools === undefined) {
    return {};
  }

  if (!Array.isArray(mcp.enabled_tools)) {
    errors.push("mcp.enabled_tools must be an array of tool names.");
    return {};
  }

  const invalidTools = mcp.enabled_tools.filter(
    (tool) => typeof tool !== "string" || !KNOWN_MCP_TOOL_NAMES.includes(tool),
  );
  if (invalidTools.length > 0) {
    errors.push(`mcp.enabled_tools contains unknown tools: ${invalidTools.join(", ")}`);
  }

  return {
    enabled_tools: resolveEnabledMcpTools(mcp.enabled_tools),
  };
}

function assignStringArray(target, source, key, errors) {
  if (source[key] === undefined) {
    return;
  }

  if (!Array.isArray(source[key]) || source[key].some((value) => typeof value !== "string" || value.trim() === "")) {
    errors.push(`${key} must be an array of non-empty strings.`);
    return;
  }

  target[key] = source[key].map((value) => value.trim());
}

function reportUnknownKeys(source, allowedKeys, label, errors) {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      const prefix = label === "config" ? "Unknown top-level config key" : `Unknown ${label} key`;
      errors.push(`${prefix}: ${key}`);
    }
  }
}
