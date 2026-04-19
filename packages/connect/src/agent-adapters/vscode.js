import path from "node:path";

import { fileExists, readJsonFile } from "../filesystem.js";
import { resolveHeartCliPath } from "../heart-cli-path.js";
import { matchesMcpRemoteUrl } from "../mcp-transport.js";

const HEART_MCP_ID = "heart-mcp";

function resolveVsCodeConfigLocations({ repoRoot } = {}) {
  return {
    repo: path.join(repoRoot, ".vscode", "mcp.json"),
  };
}

function buildHeartMcpEntry(repoRoot, remoteUrl = null) {
  if (remoteUrl) {
    return {
      type: "http",
      url: remoteUrl,
    };
  }

  return {
    type: "stdio",
    command: "node",
    args: [
      resolveHeartCliPath(),
      "mcp",
      "serve",
      "--root",
      repoRoot,
    ],
    env: {},
  };
}

function hasHeartVsCodeConfig(payload, { repoRoot, remoteUrl } = {}) {
  const entry = payload?.servers?.[HEART_MCP_ID];
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

export async function detectVsCode({ repoRoot, remoteUrl = null } = {}) {
  const configLocations = resolveVsCodeConfigLocations({ repoRoot });
  const configured = hasHeartVsCodeConfig(
    await readJsonFile(configLocations.repo),
    { repoRoot, remoteUrl },
  );

  return {
    id: "vscode",
    display_name: "VS Code / Copilot Agent",
    supports_mcp: true,
    supports_model_override: false,
    install_modes: ["repo"],
    config_locations: configLocations,
    detected: configured,
    configured,
    discovery_confidence: configured ? "medium" : "low",
    warnings: [],
  };
}

export async function buildVsCodeInstallPlan({
  repoRoot,
  scope,
  modelRuntime = null,
  remoteUrl = null,
} = {}) {
  if (scope !== "repo") {
    throw new Error("VS Code MCP install currently supports repo scope only.");
  }

  const configLocations = resolveVsCodeConfigLocations({ repoRoot });
  const warnings = [];
  if (modelRuntime) {
    warnings.push(
      `Model binding '${modelRuntime}' was ignored for vscode because this client does not support model override.`,
    );
  }

  const existingTarget = await fileExists(configLocations.repo);

  return {
    client: "vscode",
    scope,
    repo_root: repoRoot,
    target_file: configLocations.repo,
    config_locations: configLocations,
    server_key: HEART_MCP_ID,
    json_root_key: "servers",
    mcp_entry: buildHeartMcpEntry(repoRoot, remoteUrl),
    model_binding: null,
    files_to_backup: existingTarget ? [configLocations.repo] : [],
    files_to_modify: [configLocations.repo],
    warnings,
    actions: [remoteUrl ? "write-remote-mcp-json" : "write-mcp-json"],
  };
}
