import fs from "node:fs/promises";
import path from "node:path";
import { parseSimpleYaml } from "../../shared-schema/src/index.js";

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
      ".next",
      "output",
      ".playwright-cli",
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
    enabled_tools: [
      "project_overview",
      "symbol_lookup",
      "dependency_explain",
      "context_pack",
      "impact_analysis",
      "document_search",
      "policy_check",
    ],
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
    - .next
    - output
    - .playwright-cli
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
    - project_overview
    - symbol_lookup
    - dependency_explain
    - context_pack
    - impact_analysis
    - document_search
    - policy_check
`;
}

export async function loadHeartConfig(repoRoot) {
  const configPath = path.join(repoRoot, "heart.config.yaml");

  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = parseSimpleYaml(raw);
    const projectName = parsed?.project?.name ?? path.basename(repoRoot);

    return {
      exists: true,
      path: configPath,
      raw,
      config: mergeConfig(createDefaultConfig(projectName), parsed),
    };
  } catch {
    return {
      exists: false,
      path: configPath,
      raw: "",
      config: createDefaultConfig(path.basename(repoRoot)),
    };
  }
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
