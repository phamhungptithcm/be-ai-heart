import { createDetectionResult } from "./types.js";
import { detectClaudeCode } from "./agent-adapters/claude-code.js";
import { detectCline } from "./agent-adapters/cline.js";
import { detectCodex } from "./agent-adapters/codex.js";
import { detectCopilotCli } from "./agent-adapters/copilot-cli.js";
import { detectContinue } from "./agent-adapters/continue.js";
import { detectCursor } from "./agent-adapters/cursor.js";
import { detectVsCode } from "./agent-adapters/vscode.js";
import { detectWindsurf } from "./agent-adapters/windsurf.js";
import { detectLmStudio } from "./model-adapters/lm-studio.js";
import { detectOllama } from "./model-adapters/ollama.js";

function missingExecFile() {
  const error = new Error("Command not found");
  error.code = "ENOENT";
  throw error;
}

function normalizeDetectionList(value) {
  return Array.isArray(value) ? value : [];
}

async function detectModels({ fetchImpl = globalThis.fetch } = {}) {
  return [
    await detectOllama({ fetchImpl }),
    await detectLmStudio({ fetchImpl }),
  ].filter(Boolean);
}

export async function detectAgents({
  repoRoot,
  remoteUrl = null,
  env = process.env,
  execFileImpl = missingExecFile,
} = {}) {
  return [
    await detectCursor({ repoRoot, remoteUrl, env, execFileImpl }),
    await detectClaudeCode({ repoRoot, remoteUrl, env, execFileImpl }),
    await detectCodex({ repoRoot, remoteUrl, env, execFileImpl }),
    await detectWindsurf({ repoRoot, remoteUrl, env }),
    await detectCline({ repoRoot, remoteUrl, env }),
    await detectCopilotCli({ repoRoot, remoteUrl, env }),
    await detectVsCode({ repoRoot, remoteUrl, env }),
    await detectContinue({ repoRoot, remoteUrl, env }),
  ].filter(Boolean);
}

export async function detectConnections({
  repoRoot,
  env = process.env,
  fetchImpl = globalThis.fetch,
  execFileImpl = missingExecFile,
  detectAgentsImpl = detectAgents,
  detectModelsImpl,
} = {}) {
  const result = createDetectionResult(repoRoot);
  result.agents = normalizeDetectionList(
    await detectAgentsImpl({ repoRoot, env, execFileImpl }),
  );
  const detectedModels = detectModelsImpl
    ? await detectModelsImpl({ repoRoot, env, fetchImpl })
    : await detectModels({ fetchImpl });
  result.models = normalizeDetectionList(detectedModels);
  return result;
}
