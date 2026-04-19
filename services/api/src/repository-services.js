import { METRIC_SOURCE_TYPES } from "../../../packages/shared-schema/src/enterprise.js";

const SERVICE_ORDER = Object.freeze([
  "code_graph",
  "diagrams",
  "document_memory",
  "policy_rails",
  "benchmark_roi",
  "runtime_signals",
]);

export function buildRepositoryServicesView({
  profile,
  documents,
  benchmarkHistory,
  workspace,
  codeGraph,
  runtimeSignals,
} = {}) {
  const documentItems = Array.isArray(documents?.documents) ? documents.documents.slice(0, 8) : [];
  const diagrams = Array.isArray(profile?.diagrams) ? profile.diagrams : [];
  const benchmarkReports = Array.isArray(benchmarkHistory?.reports) ? benchmarkHistory.reports : [];
  const benchmarkSummary = summarizeBenchmarkHistory(benchmarkReports);
  const documentCount = Number(documents?.totals?.document_count ?? profile?.documents?.document_count ?? 0);
  const readinessPct = computeRepositoryReadiness(profile, documentCount, benchmarkSummary.report_count);
  const actionCenter = buildRepositoryActions({
    profile,
    documentCount,
    benchmarkReportCount: benchmarkSummary.report_count,
    codeGraph,
    runtimeSignals,
  });
  const sections = {
    code_graph: buildCodeGraphService({ codeGraph }),
    diagrams: buildDiagramService({ diagrams }),
    document_memory: buildDocumentMemoryService({ profile, documents, documentItems }),
    policy_rails: buildPolicyRailsService({ profile, workspace }),
    benchmark_roi: buildBenchmarkRoiService({ benchmarkReports, benchmarkSummary }),
    runtime_signals: buildRuntimeSignalsService({ runtimeSignals }),
  };

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    summary: {
      readiness_pct: readinessPct,
      document_count: documentCount,
      benchmark_report_count: benchmarkSummary.report_count,
      service_count: SERVICE_ORDER.length,
      action_center: actionCenter,
      benchmark_summary: benchmarkSummary,
    },
    tabs: SERVICE_ORDER.map((serviceKey) => ({
      key: serviceKey,
      label: sections[serviceKey].title,
      subtitle: sections[serviceKey].subtitle,
    })),
    cards: SERVICE_ORDER.map((serviceKey) => buildServiceCard(serviceKey, sections[serviceKey])),
    ...sections,
  };
}

function buildCodeGraphService({ codeGraph } = {}) {
  const view = codeGraph?.view ?? null;
  const availableModes = Array.isArray(codeGraph?.available_modes)
    ? codeGraph.available_modes
    : ["focused"];

  return {
    key: "code_graph",
    title: "Code Graph",
    subtitle: "Classes, functions, files, and dependency paths that let teams understand the repo without reloading full context.",
    source_type: METRIC_SOURCE_TYPES.repoArtifact,
    state: view ? "ready" : "missing",
    note: view
      ? view.mode === "full"
        ? "Full graph is loaded. Use it when the focused lane is no longer enough."
        : "Focused graph is loaded first so customers can inspect the highest-signal subgraph before expanding."
      : "Run a fresh repository sync to publish the visual graph snapshot for this workspace.",
    metrics: [
      metric("Visible nodes", view?.node_count ?? 0),
      metric("Visible edges", view?.edge_count ?? 0),
      metric("Total nodes", view?.total_node_count ?? 0),
      metric("Modes", availableModes.join(" / ")),
    ],
    available_modes: availableModes,
    default_mode: codeGraph?.default_mode ?? "focused",
    view,
  };
}

function buildDiagramService({ diagrams } = {}) {
  return {
    key: "diagrams",
    title: "Diagrams",
    subtitle: "Architecture, component, class, and sequence visuals published from the latest repository sync.",
    source_type: METRIC_SOURCE_TYPES.repoArtifact,
    state: diagrams.length > 0 ? "ready" : "missing",
    note:
      diagrams.length > 0
        ? "These visuals stay image-like in the portal so customers can scan intent quickly without reading raw artifacts."
        : "No synced diagrams are attached to this repository profile yet.",
    metrics: [
      metric("Visuals", diagrams.length),
      metric(
        "Top type",
        diagrams[0]?.type?.replace(/[-_]+/g, " ") ?? "not available",
      ),
      metric("Confidence", diagrams[0]?.confidence ?? "n/a"),
      metric("Source", METRIC_SOURCE_TYPES.repoArtifact.replace(/_/g, " ")),
    ],
    items: diagrams,
  };
}

function buildDocumentMemoryService({ profile, documents, documentItems } = {}) {
  const totals = documents?.totals ?? profile?.documents ?? {};
  const documentCount = Number(totals.document_count ?? 0);

  return {
    key: "document_memory",
    title: "Document Memory",
    subtitle: "Requirements, ADRs, briefs, and design context attached to this repository’s project memory.",
    source_type: METRIC_SOURCE_TYPES.repoArtifact,
    state: documentCount > 0 ? "ready" : "missing",
    note:
      documentCount > 0
        ? "Top synced documents are surfaced here so engineers can understand intent without searching through the whole codebase again."
        : "This repository still needs synced documents before the customer can rely on durable project intent.",
    metrics: [
      metric("Documents", documentCount),
      metric("Requirements", Number(totals.requirement_count ?? 0)),
      metric("Decisions", Number(totals.decision_count ?? 0)),
      metric("Technical", Number(totals.technical_count ?? 0)),
    ],
    totals: {
      document_count: documentCount,
      requirement_count: Number(totals.requirement_count ?? 0),
      decision_count: Number(totals.decision_count ?? 0),
      technical_count: Number(totals.technical_count ?? 0),
    },
    items: documentItems,
  };
}

function buildPolicyRailsService({ profile, workspace } = {}) {
  const warningCount = Number(profile?.overview?.policy_warnings ?? 0);
  const cacheStatus = String(profile?.cache?.status ?? "unknown");
  const syncStatus = String(workspace?.sync_status ?? cacheStatus);

  return {
    key: "policy_rails",
    title: "Policy Rails",
    subtitle: "Boundary posture, warning count, and sync truth for rollout-safe repository use.",
    source_type: METRIC_SOURCE_TYPES.repoArtifact,
    state: warningCount > 0 ? "warning" : "ready",
    note:
      warningCount > 0
        ? "Policy warnings are attached to this repository profile. Resolve them before widening AI rollout."
        : "No repository-level policy warnings are attached to the current profile snapshot.",
    metrics: [
      metric("Warnings", warningCount),
      metric("Cache", cacheStatus),
      metric("Domains", Number(profile?.overview?.domain_count ?? 0)),
      metric("Sync", syncStatus),
    ],
    summary: {
      warning_count: warningCount,
      cache_status: cacheStatus,
      workspace_sync_status: syncStatus,
      domain_count: Number(profile?.overview?.domain_count ?? 0),
      relationship_count: Number(profile?.overview?.relationship_count ?? 0),
    },
  };
}

function buildBenchmarkRoiService({ benchmarkReports, benchmarkSummary } = {}) {
  return {
    key: "benchmark_roi",
    title: "Benchmark ROI",
    subtitle: "Benchmark-backed token, cleanup, memory, and cost deltas tied to this repository.",
    source_type: METRIC_SOURCE_TYPES.benchmarkArtifact,
    state: benchmarkSummary.report_count > 0 ? "ready" : "missing",
    note:
      benchmarkSummary.report_count > 0
        ? "Savings stay clearly labeled as benchmark-derived so customers do not confuse proof with live metered spend."
        : "No benchmark artifact is attached to this repository yet.",
    metrics: [
      metric("Reports", benchmarkSummary.report_count),
      metric("Token save", `${benchmarkSummary.avg_token_savings_pct}%`),
      metric("Cleanup", `${benchmarkSummary.avg_review_cleanup_reduction_pct}%`),
      metric("Cost delta", `$${benchmarkSummary.avg_cost_savings_usd}`),
    ],
    summary: benchmarkSummary,
    reports: benchmarkReports.slice(0, 6),
  };
}

function buildRuntimeSignalsService({ runtimeSignals } = {}) {
  const summary = runtimeSignals?.summary ?? {};
  const sourceType = runtimeSignals?.source_type ?? METRIC_SOURCE_TYPES.hostedTelemetry;
  const telemetryPresent = Number(summary.requests ?? 0) > 0;

  return {
    key: "runtime_signals",
    title: "Runtime Signals",
    subtitle: "Live telemetry for this repository, clearly separated from benchmark-derived ROI proof.",
    source_type: sourceType,
    state: telemetryPresent || Number(summary.benchmark_report_count ?? 0) > 0 ? "ready" : "missing",
    note:
      telemetryPresent
        ? "Live telemetry is tenant-scoped and repository-aware. ROI values remain benchmark-derived."
        : "No live telemetry has been observed for this repository yet. Benchmark proof is still shown separately when available.",
    metrics: [
      metric("Requests", Number(summary.requests ?? 0)),
      metric("Input tokens", Number(summary.input_tokens ?? 0)),
      metric("Cost", `$${Number(summary.estimated_token_cost_usd ?? 0).toFixed(2)}`),
      metric("Source", formatSourceLabel(sourceType)),
    ],
    summary: {
      requests: Number(summary.requests ?? 0),
      input_tokens: Number(summary.input_tokens ?? 0),
      output_tokens: Number(summary.output_tokens ?? 0),
      estimated_token_cost_usd: roundCurrency(summary.estimated_token_cost_usd),
      avg_token_savings_pct: Number(summary.avg_token_savings_pct ?? 0),
      benchmark_report_count: Number(summary.benchmark_report_count ?? 0),
      benchmark_cost_savings_usd: roundCurrency(summary.estimated_cost_savings_usd),
      workspace_slug: String(summary.workspace_slug ?? ""),
      repo: String(summary.repo ?? ""),
      source_type: sourceType,
    },
  };
}

function buildServiceCard(serviceKey, section) {
  return {
    key: serviceKey,
    title: section.title,
    subtitle: section.subtitle,
    state: section.state,
    source_type: section.source_type,
    metrics: section.metrics.slice(0, 3),
  };
}

function summarizeBenchmarkHistory(reports = []) {
  if (reports.length === 0) {
    return {
      report_count: 0,
      avg_token_savings_pct: 0,
      avg_cost_savings_usd: 0,
      avg_memory_refresh_reduction_pct: 0,
      avg_review_cleanup_reduction_pct: 0,
      latest_generated_at: "",
    };
  }

  return {
    report_count: reports.length,
    avg_token_savings_pct: average(reports.map((report) => report.metrics?.token_savings_pct ?? 0)),
    avg_cost_savings_usd: average(reports.map((report) => report.metrics?.token_cost_savings_usd ?? 0)),
    avg_memory_refresh_reduction_pct: average(
      reports.map((report) => report.metrics?.memory_refresh_reduction_pct ?? 0),
    ),
    avg_review_cleanup_reduction_pct: average(
      reports.map((report) => report.metrics?.review_edit_reduction_pct ?? 0),
    ),
    latest_generated_at: [...reports]
      .map((report) => String(report.generated_at ?? ""))
      .sort()
      .at(-1) ?? "",
  };
}

function computeRepositoryReadiness(profile, documentCount, benchmarkCount) {
  const warningCount = Number(profile?.overview?.policy_warnings ?? 0);
  const relationshipCount = Number(profile?.heart?.relationship_count ?? 0);
  const cacheStatus = String(profile?.cache?.status ?? "").toLowerCase();
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (documentCount > 0 ? 34 : 16) +
          Math.min(24, benchmarkCount * 18) +
          Math.min(24, relationshipCount / 35) -
          Math.min(22, warningCount * 10) -
          (cacheStatus === "stale" || cacheStatus === "rebuild" ? 16 : 0),
      ),
    ),
  );
}

function buildRepositoryActions({
  profile,
  documentCount,
  benchmarkReportCount,
  codeGraph,
  runtimeSignals,
} = {}) {
  const warningCount = Number(profile?.overview?.policy_warnings ?? 0);
  const cacheStatus = String(profile?.cache?.status ?? "unknown").toLowerCase();
  const isStale = ["stale", "rebuild"].includes(cacheStatus);
  const graphReady = Boolean(codeGraph?.view?.node_count);
  const liveRequests = Number(runtimeSignals?.summary?.requests ?? 0);

  return [
    {
      label: "Sync freshness",
      value: isStale ? "Resync needed" : "Fresh",
      note: isStale
        ? "Cache status suggests the repository should be rescanned before trusting current graph or diagram artifacts."
        : "Current sync status is healthy enough for customer review.",
      progress: isStale ? 28 : 92,
    },
    {
      label: "Code graph coverage",
      value: graphReady ? `${codeGraph.view.total_node_count} mapped nodes` : "Missing",
      note: graphReady
        ? "Focused graph is available for fast review, with full graph expansion as an optional deeper lane."
        : "No graph snapshot is published for this repository yet.",
      progress: graphReady ? Math.min(100, 36 + Number(codeGraph?.view?.node_count ?? 0)) : 18,
    },
    {
      label: "Document memory",
      value: documentCount > 0 ? `${documentCount} docs` : "Missing",
      note:
        documentCount > 0
          ? "Business and technical memory are attached to this repository."
          : "This repository still lacks synced requirement or design context.",
      progress: documentCount > 0 ? 100 : 22,
    },
    {
      label: "Benchmark proof",
      value: benchmarkReportCount > 0 ? `${benchmarkReportCount} report(s)` : "Missing",
      note:
        benchmarkReportCount > 0
          ? "Benchmark proof already exists for this repository and supports expansion decisions."
          : "Publish at least one benchmark before treating this repository as financially proven.",
      progress: benchmarkReportCount > 0 ? Math.min(100, 40 + benchmarkReportCount * 20) : 18,
    },
    {
      label: "Runtime telemetry",
      value: liveRequests > 0 ? `${liveRequests} requests` : "No live traffic",
      note:
        liveRequests > 0
          ? "Hosted telemetry is visible for this repository and stays separate from benchmark ROI."
          : "No repository-scoped live telemetry is visible for the current tenant window.",
      progress: liveRequests > 0 ? Math.min(100, 32 + Math.round(Math.log10(liveRequests + 1) * 18)) : 12,
    },
    {
      label: "Policy posture",
      value: warningCount > 0 ? `${warningCount} warning(s)` : "Clean",
      note:
        warningCount > 0
          ? "Architecture or policy warnings still need attention before this repo is rollout-ready."
          : "No active policy warnings are attached to this repository profile.",
      progress: warningCount > 0 ? Math.max(12, 100 - warningCount * 20) : 94,
    },
  ];
}

function metric(label, value) {
  return {
    label,
    value,
  };
}

function average(values) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return Math.round((total / Math.max(values.length, 1)) * 10) / 10;
}

function roundCurrency(value) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function formatSourceLabel(value) {
  const safeValue = String(value ?? "unknown");
  if (safeValue === "hosted_telemetry") {
    return "Live";
  }
  if (safeValue === "benchmark_artifact") {
    return "Benchmark";
  }
  if (safeValue === "repo_artifact") {
    return "Repository";
  }
  if (safeValue === "external_integration") {
    return "External";
  }
  if (safeValue === "mixed") {
    return "Mixed";
  }
  return safeValue.replace(/[_-]+/g, " ");
}
