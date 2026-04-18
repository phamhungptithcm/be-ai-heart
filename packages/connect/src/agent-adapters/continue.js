import path from "node:path";

import { fileExists, readJsonFile } from "../filesystem.js";

const HEART_MCP_ID = "heart-mcp";

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

function buildHeartMcpEntry(repoRoot, modelRuntime = null) {
  return {
    name: HEART_MCP_ID,
    command: "node",
    args: [
      path.resolve(repoRoot, "packages/cli/bin/heart.js"),
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
  const configLocations = resolveContinueConfigLocations({ repoRoot, env });
  const targetPath =
    scope === "user" ? configLocations.user : configLocations.repo;
  const existingTarget = targetPath ? await fileExists(targetPath) : false;

  return {
    client: "continue",
    scope,
    repo_root: repoRoot,
    mcp_entry: {
      mcpServers: [buildHeartMcpEntry(repoRoot, modelRuntime)],
    },
    model_binding: modelRuntime,
    files_to_backup: existingTarget ? [targetPath] : [],
    files_to_modify: targetPath ? [targetPath] : [],
    warnings: [
      "Continue planning targets explicit repo or user MCP JSON files only.",
    ],
    actions: ["write-continue-mcp-json"],
  };
}
