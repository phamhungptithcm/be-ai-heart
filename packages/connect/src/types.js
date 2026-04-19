export function createDetectionResult(repoRoot) {
  return {
    repo_root: repoRoot,
    agents: [],
    models: [],
    warnings: [],
    recommendations: [],
  };
}
