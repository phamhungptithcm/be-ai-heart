function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function percentage(value, total) {
  if (!total) {
    return 0;
  }

  return Math.max(0, Math.min(100, round((Number(value ?? 0) / Number(total)) * 100)));
}

export function buildAdminDemandMix(summary = {}) {
  const total = Math.max(Number(summary.pipeline_count ?? 0), 1);

  return [
    { label: "Demo", value: percentage(summary.demo_count, total), tone: "brand" },
    { label: "Trial", value: percentage(summary.trial_count, total), tone: "ink" },
    {
      label: "Benchmark-backed",
      value: percentage(summary.benchmark_backed_workspace_count, total),
      tone: "cyan",
    },
    {
      label: "Expansion-ready",
      value: percentage(summary.expansion_ready_workspace_count, total),
      tone: "teal",
    },
  ];
}

export function buildAdminWorkspaceMix(workspaces = []) {
  const total = Math.max(workspaces.length, 1);
  const expansionReadyCount = workspaces.filter((workspace) => Number(workspace.score ?? 0) >= 70).length;
  const watchCount = workspaces.filter((workspace) => {
    const score = Number(workspace.score ?? 0);
    return score >= 45 && score < 70;
  }).length;
  const interventionCount = workspaces.filter((workspace) => Number(workspace.score ?? 0) < 45).length;

  return {
    total: workspaces.length,
    expansion_ready_count: expansionReadyCount,
    watch_count: watchCount,
    intervention_count: interventionCount,
    expansion_ready_pct: percentage(expansionReadyCount, total),
    intervention_pct: percentage(interventionCount, total),
  };
}
