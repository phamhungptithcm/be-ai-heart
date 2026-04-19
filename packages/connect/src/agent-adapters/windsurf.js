import path from "node:path";

import { fileExists, readJsonFile } from "../filesystem.js";
import { resolveHeartCliPath } from "../heart-cli-path.js";
import { matchesMcpRemoteUrl } from "../mcp-transport.js";

const HEART_MCP_ID = "heart-mcp";

function resolveHomeRoot(env = process.env) {
  return env.HOME || env.USERPROFILE || "";
}

function resolveWindsurfConfigLocations({ env = process.env } = {}) {
  const homeRoot = resolveHomeRoot(env);

  return {
    user: homeRoot ? path.join(homeRoot, ".codeium", "windsurf", "mcp_config.json") : null,
    legacy_user: homeRoot ? path.join(homeRoot, ".codeium", "mcp_config.json") : null,
  };
}

function buildHeartMcpEntry(repoRoot, remoteUrl = null) {
  if (remoteUrl) {
    return {
      serverUrl: remoteUrl,
      headers: {},
    };
  }

  return {
    command: "node",
    args: [
      resolveHeartCliPath(),
      "mcp",
      "serve",
      "--root",
      repoRoot,
    ],
  };
}

function hasHeartWindsurfConfig(payload, { repoRoot, remoteUrl } = {}) {
  const entry = payload?.mcpServers?.[HEART_MCP_ID];
  if (!entry) {
    return false;
  }

  if (matchesMcpRemoteUrl(entry, remoteUrl)) {
    return true;
  }

  if (typeof entry.command !== "string" || !Array.isArray(entry.args)) {
    return false;
  }

  const rootFlagIndex = entry.args.lastIndexOf("--root");
  return rootFlagIndex !== -1 && entry.args[rootFlagIndex + 1] === repoRoot;
}

export async function detectWindsurf({ repoRoot, remoteUrl = null, env = process.env } = {}) {
  const configLocations = resolveWindsurfConfigLocations({ env });
  const userPayload = configLocations.user
    ? await readJsonFile(configLocations.user)
    : null;
  const legacyPayload = configLocations.legacy_user
    ? await readJsonFile(configLocations.legacy_user)
    : null;
  const configured =
    hasHeartWindsurfConfig(userPayload, { repoRoot, remoteUrl }) ||
    hasHeartWindsurfConfig(legacyPayload, { repoRoot, remoteUrl });

  return {
    id: "windsurf",
    display_name: "Windsurf",
    supports_mcp: true,
    supports_model_override: false,
    install_modes: ["user"],
    config_locations: configLocations,
    detected: configured,
    configured,
    discovery_confidence: configured ? "medium" : "low",
    warnings: [],
  };
}

export async function buildWindsurfInstallPlan({
  repoRoot,
  scope,
  env = process.env,
  modelRuntime = null,
  remoteUrl = null,
} = {}) {
  if (scope !== "user") {
    throw new Error("Windsurf install currently supports user scope only.");
  }

  const configLocations = resolveWindsurfConfigLocations({ env });
  if (!configLocations.user) {
    throw new Error(
      "Cannot resolve user home path for Windsurf install. Set HOME or USERPROFILE.",
    );
  }

  const warnings = [];
  if (modelRuntime) {
    warnings.push(
      `Model binding '${modelRuntime}' was ignored for windsurf because this client does not support model override.`,
    );
  }

  const existingTarget = await fileExists(configLocations.user);

  return {
    client: "windsurf",
    scope,
    repo_root: repoRoot,
    target_file: configLocations.user,
    config_locations: configLocations,
    server_key: HEART_MCP_ID,
    json_root_key: "mcpServers",
    mcp_entry: buildHeartMcpEntry(repoRoot, remoteUrl),
    model_binding: null,
    files_to_backup: existingTarget ? [configLocations.user] : [],
    files_to_modify: [configLocations.user],
    warnings,
    actions: [remoteUrl ? "write-remote-mcp-json" : "write-mcp-json"],
  };
}
