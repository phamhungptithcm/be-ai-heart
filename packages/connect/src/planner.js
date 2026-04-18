import { buildClaudeCodeInstallPlan } from "./agent-adapters/claude-code.js";
import { buildContinueInstallPlan } from "./agent-adapters/continue.js";
import { buildCursorInstallPlan } from "./agent-adapters/cursor.js";

export async function buildInstallPlan({
  client,
  scope,
  repoRoot,
  env = process.env,
  modelRuntime = null,
} = {}) {
  if (client === "cursor") {
    return buildCursorInstallPlan({ repoRoot, scope, env });
  }

  if (client === "claude-code") {
    return buildClaudeCodeInstallPlan({ repoRoot, scope, env });
  }

  if (client === "continue") {
    return buildContinueInstallPlan({ repoRoot, scope, env, modelRuntime });
  }

  throw new Error(`Unsupported install client: ${client}`);
}
