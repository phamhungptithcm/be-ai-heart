import path from "node:path";

import { readJsonFile } from "../filesystem.js";
import { resolveHeartCliPath } from "../heart-cli-path.js";

const HEART_MCP_ID = "heart-mcp";

function missingExecFile() {
  const error = new Error("Command not found");
  error.code = "ENOENT";
  throw error;
}

function resolveHomeRoot(env = process.env) {
  return env.HOME || env.USERPROFILE || "";
}

function resolveClaudeCodeConfigLocations({ repoRoot, env = process.env } = {}) {
  const homeRoot = resolveHomeRoot(env);

  return {
    repo: path.join(repoRoot, ".mcp.json"),
    user: homeRoot ? path.join(homeRoot, ".claude.json") : null,
  };
}

function buildHeartMcpEntry(repoRoot) {
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

function hasHeartClaudeConfig(payload, repoRoot) {
  const entry = payload?.mcpServers?.[HEART_MCP_ID];
  if (!entry || typeof entry.command !== "string" || !Array.isArray(entry.args)) {
    return false;
  }

  const rootFlagIndex = entry.args.lastIndexOf("--root");
  if (rootFlagIndex === -1) {
    return false;
  }

  return entry.args[rootFlagIndex + 1] === repoRoot;
}

export async function detectClaudeCode({
  repoRoot,
  env = process.env,
  execFileImpl = missingExecFile,
} = {}) {
  const configLocations = resolveClaudeCodeConfigLocations({ repoRoot, env });
  const repoConfigured = hasHeartClaudeConfig(
    await readJsonFile(configLocations.repo),
    repoRoot,
  );
  const userConfigured = configLocations.user
    ? hasHeartClaudeConfig(await readJsonFile(configLocations.user), repoRoot)
    : false;
  const configured = repoConfigured || userConfigured;
  let detectedFromCli = false;

  try {
    await execFileImpl("claude", ["mcp", "list"]);
    detectedFromCli = true;
  } catch {
    // Fall back to allowlisted config evidence only.
  }

  if (!detectedFromCli && !configured) {
    return null;
  }

  return {
    id: "claude-code",
    display_name: "Claude Code",
    supports_mcp: true,
    supports_model_override: false,
    install_modes: ["repo", "user"],
    config_locations: configLocations,
    detected: detectedFromCli || configured,
    configured,
    discovery_confidence: "high",
    warnings: [],
  };
}

export async function buildClaudeCodeInstallPlan({
  repoRoot,
  scope,
  env = process.env,
  modelRuntime = null,
} = {}) {
  const mcpEntry = buildHeartMcpEntry(repoRoot);
  const warnings = [];
  const claudeScope = scope === "repo" ? "project" : "user";

  if (modelRuntime) {
    warnings.push(
      `Model binding '${modelRuntime}' was ignored for claude-code because this client does not support model override.`,
    );
  }

  return {
    client: "claude-code",
    scope,
    repo_root: repoRoot,
    mcp_entry: mcpEntry,
    model_binding: null,
    files_to_backup: [],
    files_to_modify: [],
    warnings,
    actions: ["run-claude-mcp-add-json"],
    command: "claude",
    args: [
      "mcp",
      "add-json",
      HEART_MCP_ID,
      JSON.stringify(mcpEntry),
      "--scope",
      claudeScope,
    ],
    exec: {
      command: "claude",
      args: [
        "mcp",
        "add-json",
        HEART_MCP_ID,
        JSON.stringify(mcpEntry),
        "--scope",
        claudeScope,
      ],
    },
    config_locations: resolveClaudeCodeConfigLocations({ repoRoot, env }),
  };
}
