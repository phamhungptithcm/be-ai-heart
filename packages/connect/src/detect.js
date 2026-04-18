import { createDetectionResult } from "./types.js";
import { detectLmStudio } from "./model-adapters/lm-studio.js";
import { detectOllama } from "./model-adapters/ollama.js";

function normalizeDetectionList(value) {
  return Array.isArray(value) ? value : [];
}

async function detectModels({ fetchImpl = globalThis.fetch } = {}) {
  return [
    await detectOllama({ fetchImpl }),
    await detectLmStudio({ fetchImpl }),
  ].filter(Boolean);
}

export async function detectConnections({
  repoRoot,
  fetchImpl = globalThis.fetch,
  detectAgentsImpl = async () => [],
  detectModelsImpl,
} = {}) {
  const result = createDetectionResult(repoRoot);
  result.agents = normalizeDetectionList(await detectAgentsImpl());
  const detectedModels = detectModelsImpl
    ? await detectModelsImpl()
    : await detectModels({ fetchImpl });
  result.models = normalizeDetectionList(detectedModels);
  return result;
}
