import path from "node:path";

import { fileExists, readJsonFile } from "../filesystem.js";
import { resolveHeartCliPath } from "../heart-cli-path.js";
import { matchesMcpRemoteUrl } from "../mcp-transport.js";

const HEART_MCP_ID = "heart-mcp";

function resolveHomeRoot(env = process.env) {
  return env.HOME || env.USERPROFILE || "";
}

function resolveCopilotCliConfigLocations({ env = process.env } = {}) {
  const homeRoot = resolveHomeRoot(env);

  return {
    user: homeRoot ? path.join(homeRoot, ".copilot", "mcp-config.json") : null,
  };
}

function buildHeartMcpEntry(repoRoot, remoteUrl = null) {
  if (remoteUrl) {
    return {
      type: "http",
      url: remoteUrl,
      headers: {},
      tools: ["*"],
    };
  }

  return {
    type: "local",
    command: "node",
    args: [
      resolveHeartCliPath(),
      "mcp",
      "serve",
      "--root",
      repoRoot,
    ],
    env: {},
    tools: ["*"],
  };
}

function hasHeartCopilotCliConfig(payload, { repoRoot, remoteUrl } = {}) {
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

export async function detectCopilotCli({ repoRoot, remoteUrl = null, env = process.env } = {}) {
  const configLocations = resolveCopilotCliConfigLocations({ env });
  const configured = hasHeartCopilotCliConfig(
    await readJsonFile(configLocations.user),
    { repoRoot, remoteUrl },
  );

  return {
    id: "copilot-cli",
    display_name: "GitHub Copilot CLI",
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

export async function buildCopilotCliInstallPlan({
  repoRoot,
  scope,
  env = process.env,
  modelRuntime = null,
  remoteUrl = null,
} = {}) {
  if (scope !== "user") {
    throw new Error("GitHub Copilot CLI install currently supports user scope only.");
  }

  const configLocations = resolveCopilotCliConfigLocations({ env });
  if (!configLocations.user) {
    throw new Error(
      "Cannot resolve user home path for GitHub Copilot CLI install. Set HOME or USERPROFILE.",
    );
  }

  const warnings = [];
  if (modelRuntime) {
    warnings.push(
      `Model binding '${modelRuntime}' was ignored for copilot-cli because this client does not support model override.`,
    );
  }

  const existingTarget = await fileExists(configLocations.user);

  return {
    client: "copilot-cli",
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
