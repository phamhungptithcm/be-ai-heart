import { createDetectionResult } from "./types.js";
import { detectClaudeCode } from "./agent-adapters/claude-code.js";
import { detectContinue } from "./agent-adapters/continue.js";
import { detectCursor } from "./agent-adapters/cursor.js";
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
  env = process.env,
  execFileImpl = missingExecFile,
} = {}) {
  return [
    await detectCursor({ repoRoot, env, execFileImpl }),
    await detectClaudeCode({ repoRoot, env, execFileImpl }),
    await detectContinue({ repoRoot, env }),
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
