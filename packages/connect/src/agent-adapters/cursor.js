import path from "node:path";

import { fileExists, readJsonFile } from "../filesystem.js";

const HEART_MCP_ID = "heart-mcp";

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

function buildHeartMcpEntry(repoRoot) {
  return {
    command: "node",
    args: ["./bin/heart.js", "mcp", "serve", "--root", repoRoot],
  };
}

function hasHeartCursorConfig(payload, repoRoot) {
  const entry = payload?.mcpServers?.[HEART_MCP_ID];
  if (!entry || entry.command !== "node" || !Array.isArray(entry.args)) {
    return false;
  }

  const args = entry.args;
  return (
    args.length >= 2 &&
    args[args.length - 2] === "--root" &&
    args[args.length - 1] === repoRoot
  );
}

async function configEvidence({ repoRoot, configLocations }) {
  const repoPayload = await readJsonFile(configLocations.repo);
  const userPayload = configLocations.user
    ? await readJsonFile(configLocations.user)
    : null;

  return {
    repoConfigured: hasHeartCursorConfig(repoPayload, repoRoot),
    userConfigured: hasHeartCursorConfig(userPayload, repoRoot),
  };
}

export async function detectCursor({
  repoRoot,
  env = process.env,
  execFileImpl = async () => ({ stdout: "", stderr: "" }),
} = {}) {
  const configLocations = resolveCursorConfigLocations({ repoRoot, env });
  let detected = false;
  let configuredFromCli = false;

  try {
    const result = await execFileImpl("cursor-agent", ["mcp", "list"]);
    const stdout = typeof result?.stdout === "string" ? result.stdout : "";
    detected = true;
    configuredFromCli = stdout.includes(HEART_MCP_ID);
  } catch {
    // Fall back to explicit config-file evidence only.
  }

  const { repoConfigured, userConfigured } = await configEvidence({
    repoRoot,
    configLocations,
  });
  const configured = configuredFromCli || repoConfigured || userConfigured;
  detected = detected || configured;

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
} = {}) {
  const configLocations = resolveCursorConfigLocations({ repoRoot, env });
  const targetPath =
    scope === "user" ? configLocations.user : configLocations.repo;
  const existingTarget = targetPath ? await fileExists(targetPath) : false;

  return {
    client: "cursor",
    scope,
    repo_root: repoRoot,
    mcp_entry: buildHeartMcpEntry(repoRoot),
    model_binding: null,
    files_to_backup: existingTarget ? [targetPath] : [],
    files_to_modify: targetPath ? [targetPath] : [],
    warnings: [],
    actions: ["write-mcp-json"],
  };
}
