import path from "node:path";

import { fileExists, readJsonFile } from "../filesystem.js";
import { resolveHeartCliPath } from "../heart-cli-path.js";
import { matchesMcpRemoteUrl } from "../mcp-transport.js";

const HEART_MCP_ID = "heart-mcp";

function resolveHomeRoot(env = process.env) {
  return env.HOME || env.USERPROFILE || "";
}

function resolveClineBaseRoot(env = process.env) {
  return env.CLINE_DIR || resolveHomeRoot(env);
}

function resolveClineConfigLocations({ env = process.env } = {}) {
  const baseRoot = resolveClineBaseRoot(env);

  return {
    user: baseRoot
      ? path.join(baseRoot, ".cline", "data", "settings", "cline_mcp_settings.json")
      : null,
  };
}

function buildHeartMcpEntry(repoRoot, remoteUrl = null) {
  if (remoteUrl) {
    return {
      url: remoteUrl,
      headers: {},
      alwaysAllow: ["project_overview", "document_search", "context_pack"],
      disabled: false,
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
    env: {},
    alwaysAllow: ["project_overview", "document_search", "context_pack"],
    disabled: false,
  };
}

function hasHeartClineConfig(payload, { repoRoot, remoteUrl } = {}) {
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

export async function detectCline({ repoRoot, remoteUrl = null, env = process.env } = {}) {
  const configLocations = resolveClineConfigLocations({ env });
  const configured = hasHeartClineConfig(
    await readJsonFile(configLocations.user),
    { repoRoot, remoteUrl },
  );

  return {
    id: "cline",
    display_name: "Cline",
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

export async function buildClineInstallPlan({
  repoRoot,
  scope,
  env = process.env,
  modelRuntime = null,
  remoteUrl = null,
} = {}) {
  if (scope !== "user") {
    throw new Error("Cline install currently supports user scope only.");
  }

  const configLocations = resolveClineConfigLocations({ env });
  if (!configLocations.user) {
    throw new Error(
      "Cannot resolve user home path for Cline install. Set HOME, USERPROFILE, or CLINE_DIR.",
    );
  }

  const warnings = [];
  if (modelRuntime) {
    warnings.push(
      `Model binding '${modelRuntime}' was ignored for cline because this client does not support model override.`,
    );
  }

  const existingTarget = await fileExists(configLocations.user);

  return {
    client: "cline",
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
