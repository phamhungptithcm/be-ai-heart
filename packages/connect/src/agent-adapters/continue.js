import path from "node:path";
import fs from "node:fs/promises";

import { fileExists, readJsonFile } from "../filesystem.js";
import { resolveHeartCliPath } from "../heart-cli-path.js";

const HEART_MCP_ID = "heart-mcp";
const SUPPORTED_MODEL_RUNTIMES = new Set(["ollama", "lm-studio"]);
const MANAGED_CONTINUE_CONFIG_HEADER = "name: BeHeart Local Config";

function resolveHomeRoot(env = process.env) {
  return env.HOME || env.USERPROFILE || "";
}

function resolveContinueConfigLocations({ repoRoot, env = process.env } = {}) {
  const homeRoot = resolveHomeRoot(env);

  return {
    repo: path.join(repoRoot, ".continue", "mcpServers", `${HEART_MCP_ID}.json`),
    user: homeRoot
      ? path.join(homeRoot, ".continue", "mcpServers", `${HEART_MCP_ID}.json`)
      : null,
  };
}

export function resolveContinueManagedConfigPath(env = process.env) {
  const homeRoot = resolveHomeRoot(env);
  return homeRoot ? path.join(homeRoot, ".continue", "config.yaml") : null;
}

export function createContinueManagedConfig(modelRuntime) {
  if (modelRuntime === "ollama") {
    return `${MANAGED_CONTINUE_CONFIG_HEADER}
version: 1
models:
  - name: qwen3.5-coder:latest
    provider: ollama
    model: qwen3.5-coder:latest
`;
  }

  if (modelRuntime === "lm-studio") {
    return `${MANAGED_CONTINUE_CONFIG_HEADER}
version: 1
models:
  - name: qwen3.5-coder:latest
    provider: lm-studio
    model: qwen3.5-coder:latest
`;
  }

  throw new Error(`Unsupported Continue model runtime: ${modelRuntime}`);
}

export async function inspectContinueManagedConfig({
  scope,
  env = process.env,
  modelRuntime = null,
} = {}) {
  if (scope !== "user" || !modelRuntime) {
    return {
      managedConfigPath: null,
      filesToModify: [],
      filesToBackup: [],
      warnings: [],
    };
  }

  const managedConfigPath = resolveContinueManagedConfigPath(env);
  if (!managedConfigPath) {
    throw new Error(
      "Cannot resolve user home path for Continue install. Set HOME or USERPROFILE.",
    );
  }

  let existingText = null;
  try {
    existingText = await fs.readFile(managedConfigPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  if (existingText === null) {
    return {
      managedConfigPath,
      filesToModify: [managedConfigPath],
      filesToBackup: [],
      warnings: [],
    };
  }

  const expectedManagedConfig = createContinueManagedConfig(modelRuntime);
  if (existingText === expectedManagedConfig) {
    return {
      managedConfigPath,
      filesToModify: [managedConfigPath],
      filesToBackup: [managedConfigPath],
      warnings: [],
    };
  }

  const warning = existingText.startsWith(MANAGED_CONTINUE_CONFIG_HEADER)
    ? "Continue managed config contains user edits; skipping managed model config."
    : "Continue user config exists and is not BeHeart-managed; skipping managed model config.";

  return {
    managedConfigPath,
    filesToModify: [],
    filesToBackup: [],
    warnings: [warning],
  };
}

function buildHeartMcpEntry(repoRoot, modelRuntime = null) {
  return {
    name: HEART_MCP_ID,
    command: "node",
    args: [
      resolveHeartCliPath(),
      "mcp",
      "serve",
      "--root",
      repoRoot,
    ],
    ...(modelRuntime ? { modelRuntime } : {}),
  };
}

function hasValidHeartContinueConfig(payload, repoRoot) {
  const entries = payload?.mcpServers;
  if (!Array.isArray(entries)) {
    return false;
  }

  return entries.some(
    (entry) => {
      if (
        entry?.name !== HEART_MCP_ID ||
        typeof entry.command !== "string" ||
        !Array.isArray(entry.args)
      ) {
        return false;
      }

      const rootFlagIndex = entry.args.lastIndexOf("--root");
      if (rootFlagIndex === -1) {
        return false;
      }

      return entry.args[rootFlagIndex + 1] === repoRoot;
    },
  );
}

export async function detectContinue({
  repoRoot,
  env = process.env,
} = {}) {
  const configLocations = resolveContinueConfigLocations({ repoRoot, env });
  const repoConfigured = hasValidHeartContinueConfig(
    await readJsonFile(configLocations.repo),
    repoRoot,
  );
  const userConfigured = configLocations.user
    ? hasValidHeartContinueConfig(await readJsonFile(configLocations.user), repoRoot)
    : false;
  const configured = repoConfigured || userConfigured;

  return {
    id: "continue",
    display_name: "Continue",
    supports_mcp: true,
    supports_model_override: true,
    install_modes: ["repo", "user"],
    config_locations: configLocations,
    detected: configured,
    configured,
    discovery_confidence: "low",
    warnings: [
      "Continue detection in v1 is config-hinted unless a Continue MCP config already exists.",
    ],
  };
}

export async function buildContinueInstallPlan({
  repoRoot,
  scope,
  env = process.env,
  modelRuntime = null,
} = {}) {
  if (modelRuntime && !SUPPORTED_MODEL_RUNTIMES.has(modelRuntime)) {
    throw new Error(`Unsupported Continue model runtime: ${modelRuntime}`);
  }

  const configLocations = resolveContinueConfigLocations({ repoRoot, env });
  const targetPath =
    scope === "user" ? configLocations.user : configLocations.repo;
  if (scope === "user" && !targetPath) {
    throw new Error(
      "Cannot resolve user home path for Continue install. Set HOME or USERPROFILE.",
    );
  }
  const existingTarget = targetPath ? await fileExists(targetPath) : false;
  const managedConfig = await inspectContinueManagedConfig({
    scope,
    env,
    modelRuntime,
  });

  return {
    client: "continue",
    scope,
    repo_root: repoRoot,
    target_file: targetPath,
    managed_config_file: managedConfig.managedConfigPath,
    mcp_entry: {
      mcpServers: [buildHeartMcpEntry(repoRoot, modelRuntime)],
    },
    model_binding: modelRuntime,
    files_to_backup: [
      ...(existingTarget ? [targetPath] : []),
      ...managedConfig.filesToBackup,
    ],
    files_to_modify: [
      ...(targetPath ? [targetPath] : []),
      ...managedConfig.filesToModify,
    ],
    warnings: [
      "Continue planning targets explicit repo or user MCP JSON files only.",
      ...managedConfig.warnings,
    ],
    actions: ["write-continue-mcp-json"],
  };
}

export { MANAGED_CONTINUE_CONFIG_HEADER };
