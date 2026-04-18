import { createDetectionResult } from "./types.js";

function normalizeDetectionList(value) {
  return Array.isArray(value) ? value : [];
}

export async function detectConnections({
  repoRoot,
  detectAgentsImpl = async () => [],
  detectModelsImpl = async () => [],
} = {}) {
  const result = createDetectionResult(repoRoot);
  result.agents = normalizeDetectionList(await detectAgentsImpl());
  result.models = normalizeDetectionList(await detectModelsImpl());
  return result;
}
