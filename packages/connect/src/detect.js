import { createDetectionResult } from "./types.js";

export async function detectConnections({
  repoRoot,
  detectAgentsImpl = async () => [],
  detectModelsImpl = async () => [],
} = {}) {
  const result = createDetectionResult(repoRoot);
  result.agents = await detectAgentsImpl();
  result.models = await detectModelsImpl();
  return result;
}
