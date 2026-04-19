import { buildClineInstallPlan } from "./agent-adapters/cline.js";
import { buildCodexInstallPlan } from "./agent-adapters/codex.js";
import { buildCopilotCliInstallPlan } from "./agent-adapters/copilot-cli.js";
import { buildClaudeCodeInstallPlan } from "./agent-adapters/claude-code.js";
import { buildContinueInstallPlan } from "./agent-adapters/continue.js";
import { buildCursorInstallPlan } from "./agent-adapters/cursor.js";
import { buildVsCodeInstallPlan } from "./agent-adapters/vscode.js";
import { buildWindsurfInstallPlan } from "./agent-adapters/windsurf.js";

export async function buildInstallPlan({
  client,
  scope,
  repoRoot,
  env = process.env,
  modelRuntime = null,
  detectedModelsByRuntime = {},
  remoteUrl = null,
} = {}) {
  if (client === "cursor") {
    return buildCursorInstallPlan({ repoRoot, scope, env, modelRuntime, remoteUrl });
  }

  if (client === "claude-code") {
    return buildClaudeCodeInstallPlan({ repoRoot, scope, env, modelRuntime, remoteUrl });
  }

  if (client === "codex") {
    return buildCodexInstallPlan({ repoRoot, scope, env, modelRuntime, remoteUrl });
  }

  if (client === "windsurf") {
    return buildWindsurfInstallPlan({ repoRoot, scope, env, modelRuntime, remoteUrl });
  }

  if (client === "cline") {
    return buildClineInstallPlan({ repoRoot, scope, env, modelRuntime, remoteUrl });
  }

  if (client === "copilot-cli") {
    return buildCopilotCliInstallPlan({ repoRoot, scope, env, modelRuntime, remoteUrl });
  }

  if (client === "vscode") {
    return buildVsCodeInstallPlan({ repoRoot, scope, env, modelRuntime, remoteUrl });
  }

  if (client === "continue") {
    return buildContinueInstallPlan({
      repoRoot,
      scope,
      env,
      modelRuntime,
      detectedModelsByRuntime,
      remoteUrl,
    });
  }

  throw new Error(`Unsupported install client: ${client}`);
}
