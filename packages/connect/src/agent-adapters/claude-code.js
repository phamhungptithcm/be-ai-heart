import path from "node:path";

const HEART_MCP_ID = "heart-mcp";

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
      path.resolve(repoRoot, "packages/cli/bin/heart.js"),
      "mcp",
      "serve",
      "--root",
      repoRoot,
    ],
  };
}

export async function detectClaudeCode({
  repoRoot,
  env = process.env,
  execFileImpl = async () => ({ stdout: "", stderr: "" }),
} = {}) {
  try {
    await execFileImpl("claude", ["mcp", "list"]);
  } catch {
    return null;
  }

  return {
    id: "claude-code",
    display_name: "Claude Code",
    supports_mcp: true,
    supports_model_override: false,
    install_modes: ["repo", "user"],
    config_locations: resolveClaudeCodeConfigLocations({ repoRoot, env }),
    detected: true,
    configured: false,
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
    config_locations: resolveClaudeCodeConfigLocations({ repoRoot, env }),
  };
}
