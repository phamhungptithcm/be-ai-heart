import path from "node:path";

import { fileExists, readJsonFile } from "../filesystem.js";
import { resolveHeartCliPath } from "../heart-cli-path.js";
import { matchesMcpRemoteUrl } from "../mcp-transport.js";

const HEART_MCP_ID = "heart-mcp";

function missingExecFile() {
  const error = new Error("Command not found");
  error.code = "ENOENT";
  throw error;
}

function resolveHomeRoot(env = process.env) {
  return env.HOME || env.USERPROFILE || "";
}

function resolveCursorConfigLocations({ repoRoot, env = process.env } = {}) {
  const homeRoot = resolveHomeRoot(env);

  return {
    repo: path.join(repoRoot, ".cursor", "mcp.json"),
    user: homeRoot ? path.join(homeRoot, ".cursor", "mcp.json") : null,
  };
}

function buildHeartMcpEntry(repoRoot, remoteUrl = null) {
  if (remoteUrl) {
    return {
      url: remoteUrl,
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

function hasHeartCursorConfig(payload, { repoRoot, remoteUrl } = {}) {
  const entry = payload?.mcpServers?.[HEART_MCP_ID];
  if (!entry) {
    return false;
  }

  if (matchesMcpRemoteUrl(entry, remoteUrl)) {
    return true;
  }

  const args = Array.isArray(entry.args) ? entry.args : [];
  const rootFlagIndex = args.lastIndexOf("--root");
  if (rootFlagIndex === -1) {
    return false;
  }

  return args[rootFlagIndex + 1] === repoRoot;
}

async function configEvidence({ repoRoot, remoteUrl, configLocations }) {
  const repoPayload = await readJsonFile(configLocations.repo);
  const userPayload = configLocations.user
    ? await readJsonFile(configLocations.user)
    : null;

  return {
    repoConfigured: hasHeartCursorConfig(repoPayload, { repoRoot, remoteUrl }),
    userConfigured: hasHeartCursorConfig(userPayload, { repoRoot, remoteUrl }),
  };
}

export async function detectCursor({
  repoRoot,
  remoteUrl = null,
  env = process.env,
  execFileImpl = missingExecFile,
} = {}) {
  const configLocations = resolveCursorConfigLocations({ repoRoot, env });
  let detected = false;
  let detectedFromCli = false;

  try {
    const result = await execFileImpl("cursor-agent", ["mcp", "list"]);
    const stdout = typeof result?.stdout === "string" ? result.stdout : "";
    detected = true;
    detectedFromCli = stdout.includes(HEART_MCP_ID);
  } catch {
    // Fall back to explicit config-file evidence only.
  }

  const { repoConfigured, userConfigured } = await configEvidence({
    repoRoot,
    remoteUrl,
    configLocations,
  });
  const configured = repoConfigured || userConfigured;
  detected = detected || detectedFromCli || configured;

  return {
    id: "cursor",
    display_name: "Cursor",
    supports_mcp: true,
    supports_model_override: false,
    install_modes: ["repo", "user"],
    config_locations: configLocations,
    detected,
    configured,
    discovery_confidence: detected ? "high" : "low",
    warnings: [],
  };
}

export async function buildCursorInstallPlan({
  repoRoot,
  scope,
  env = process.env,
  modelRuntime = null,
  remoteUrl = null,
} = {}) {
  const configLocations = resolveCursorConfigLocations({ repoRoot, env });
  const targetPath =
    scope === "user" ? configLocations.user : configLocations.repo;
  if (scope === "user" && !targetPath) {
    throw new Error(
      "Cannot resolve user home path for Cursor install. Set HOME or USERPROFILE.",
    );
  }
  const existingTarget = targetPath ? await fileExists(targetPath) : false;
  const warnings = [];

  if (modelRuntime) {
    warnings.push(
      `Model binding '${modelRuntime}' was ignored for cursor because this client does not support model override.`,
    );
  }

  return {
    client: "cursor",
    scope,
    repo_root: repoRoot,
    target_file: targetPath,
    config_locations: configLocations,
    mcp_entry: buildHeartMcpEntry(repoRoot, remoteUrl),
    model_binding: null,
    files_to_backup: existingTarget ? [targetPath] : [],
    files_to_modify: targetPath ? [targetPath] : [],
    warnings,
    actions: [remoteUrl ? "write-remote-mcp-json" : "write-mcp-json"],
  };
}
