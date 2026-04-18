import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONFIG = Object.freeze({
  project: {
    name: "be-ai-heart",
    language_priority: ["typescript", "javascript"],
    entrypoints: ["packages", "apps", "services"],
    ignore: ["node_modules", "dist", "coverage", ".git"],
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
    const projectName = raw.match(/^\s*name:\s*(.+)$/m)?.[1]?.trim() ?? path.basename(repoRoot);

    return {
      exists: true,
      path: configPath,
      raw,
      config: createDefaultConfig(projectName),
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
