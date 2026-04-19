export async function detectConnections({
  repoRoot = "",
  detectAgentsImpl,
  detectModelsImpl,
} = {}) {
  const safeRepoRoot = String(repoRoot ?? "").trim();
  const agents = await resolveDetectedItems(detectAgentsImpl);
  const models = await resolveDetectedItems(detectModelsImpl);

  return {
    repo_root: safeRepoRoot,
    agents,
    models,
    warnings: [],
    recommendations: [],
  };
}

async function resolveDetectedItems(detector) {
  if (typeof detector !== "function") {
    return [];
  }

  const result = await detector();
  return Array.isArray(result) ? result : [];
}
