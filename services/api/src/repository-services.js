import { METRIC_SOURCE_TYPES } from "../../../packages/shared-schema/src/enterprise.js";
import { buildBenchmarkTrendDigest } from "../../../packages/benchmark/src/trends.js";

const SERVICE_ORDER = Object.freeze([
  "code_graph",
  "diagrams",
  "document_memory",
  "context_pack_preview",
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
    code_graph: buildCodeGraphService({ codeGraph, profile }),
    diagrams: buildDiagramService({ diagrams }),
    document_memory: buildDocumentMemoryService({ profile, documents, documentItems }),
    context_pack_preview: buildContextPackPreviewService({
      profile,
      documents,
      documentItems,
      codeGraph,
    }),
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

function buildCodeGraphService({ codeGraph, profile } = {}) {
  const view =
    codeGraph?.view ??
    buildDiagramDerivedCodeGraphView({
      diagrams: profile?.diagrams,
      mode: codeGraph?.requested_mode,
    });
  const availableModes = Array.isArray(codeGraph?.available_modes)
    ? codeGraph.available_modes
    : ["focused"];
  const isDiagramDerived = Boolean(view?.is_diagram_derived);

  return {
    key: "code_graph",
    title: "Code Graph",
    subtitle: "Files, symbols, domains, and relationships from the latest synced repo artifacts.",
    source_type: METRIC_SOURCE_TYPES.repoArtifact,
    state: view ? "ready" : "missing",
    note: view
      ? isDiagramDerived
        ? "Graph artifact is not published yet. This low-confidence view is derived from the synced Mermaid symbol graph."
        : view.mode === "full"
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

function buildDiagramDerivedCodeGraphView({ diagrams, mode = "focused" } = {}) {
  const sourceDiagram = (Array.isArray(diagrams) ? diagrams : []).find(
    (diagram) => String(diagram.type ?? "").includes("symbol") && diagram.content,
  ) ?? (Array.isArray(diagrams) ? diagrams : []).find((diagram) => diagram.content);

  if (!sourceDiagram?.content) {
    return null;
  }

  const nodeMap = new Map();
  const edgeCandidates = [];
  const nodePattern = /^\s*([A-Za-z0-9_]+)\["([^"]+)"\]/;
  const edgePattern = /^\s*([A-Za-z0-9_]+)\s*(?:-->|-.+?->)\s*([A-Za-z0-9_]+)/;

  for (const line of String(sourceDiagram.content).split(/\r?\n/)) {
    const nodeMatch = line.match(nodePattern);
    if (nodeMatch) {
      nodeMap.set(nodeMatch[1], normalizeDerivedGraphNode(nodeMatch[1], nodeMatch[2]));
      continue;
    }

    const edgeMatch = line.match(edgePattern);
    if (edgeMatch) {
      edgeCandidates.push({
        id: `${edgeMatch[1]}-${edgeMatch[2]}-${edgeCandidates.length}`,
        from: edgeMatch[1],
        to: edgeMatch[2],
      });
    }
  }

  const allNodes = [...nodeMap.values()];
  if (allNodes.length === 0) {
    return null;
  }

  const selectedLimit = String(mode) === "full" ? 90 : 42;
  const selectedNodes = allNodes.slice(0, selectedLimit);
  const selectedIds = new Set(selectedNodes.map((node) => node.id));
  const selectedEdges = edgeCandidates
    .filter((edge) => selectedIds.has(edge.from) && selectedIds.has(edge.to))
    .slice(0, selectedLimit * 2)
    .map((edge) => ({
      ...edge,
      type_key: "diagram_edge",
      type_label: "synced",
      color: "rgba(44, 84, 255, 0.64)",
    }));
  const degreeByNode = new Map();
  for (const edge of selectedEdges) {
    degreeByNode.set(edge.from, Number(degreeByNode.get(edge.from) ?? 0) + 1);
    degreeByNode.set(edge.to, Number(degreeByNode.get(edge.to) ?? 0) + 1);
  }

  const layout = createDerivedGraphLayout(selectedNodes.length);
  const nodes = selectedNodes.map((node, index) => {
    const position = layout.positions[index] ?? { x: 120, y: 120 };
    return {
      ...node,
      position,
      degree: Number(degreeByNode.get(node.id) ?? 0),
      radius: node.type_key === "repository" ? 24 : node.type_key === "domain" ? 20 : 16,
    };
  });

  return {
    schema_version: 1,
    mode: String(mode) === "full" ? "full" : "focused",
    source_type: "diagram_derived",
    confidence_label: "low",
    inference_mode: "diagram-derived-fallback",
    is_diagram_derived: true,
    is_truncated: selectedNodes.length < allNodes.length,
    node_count: nodes.length,
    edge_count: selectedEdges.length,
    total_node_count: allNodes.length,
    total_edge_count: edgeCandidates.length,
    node_type_counts: countBy(nodes, "type_key"),
    edge_type_counts: countBy(selectedEdges, "type_key"),
    total_node_type_counts: countBy(allNodes, "type_key"),
    total_edge_type_counts: { diagram_edge: edgeCandidates.length },
    layout: {
      algorithm: "diagram-derived-radial",
      width: layout.width,
      height: layout.height,
    },
    nodes,
    edges: selectedEdges,
  };
}

function normalizeDerivedGraphNode(id, label) {
  const safeLabel = String(label ?? id);
  const type = inferDerivedNodeType(safeLabel);
  const displayLabel = safeLabel.replace(/^(Repo|File|Domain|Docs|function|const|class|interface|enum):\s*/i, "");

  return {
    id,
    label: truncate(displayLabel, 48),
    type_key: type.key,
    type_label: type.label,
    secondary_label: safeLabel.startsWith("File:") ? displayLabel : "",
    path: safeLabel.startsWith("File:") ? displayLabel : "",
    search_text: `${safeLabel} ${displayLabel}`.toLowerCase(),
    color: type.color,
    degree: 0,
    meta: {
      source: "synced Mermaid symbol graph",
    },
  };
}

function inferDerivedNodeType(label) {
  if (/^Repo:/i.test(label)) {
    return { key: "repository", label: "repository", color: "#2c54ff" };
  }
  if (/^Domain:/i.test(label)) {
    return { key: "domain", label: "domain", color: "#16a34a" };
  }
  if (/^File:/i.test(label)) {
    return { key: "file", label: "file", color: "#7c3aed" };
  }
  if (/^(function|const):/i.test(label)) {
    return { key: "symbol", label: "symbol", color: "#0ea5e9" };
  }
  if (/^(class|interface|enum):/i.test(label)) {
    return { key: "type", label: "type", color: "#f97316" };
  }
  if (/^Docs:/i.test(label)) {
    return { key: "document", label: "document", color: "#64748b" };
  }
  return { key: "node", label: "node", color: "#64748b" };
}

function createDerivedGraphLayout(count) {
  const columns = count > 36 ? 7 : count > 18 ? 6 : 5;
  const rows = Math.max(1, Math.ceil(count / columns));
  const cellWidth = 160;
  const cellHeight = 118;
  const width = Math.max(760, columns * cellWidth + 120);
  const height = Math.max(520, rows * cellHeight + 140);
  const positions = Array.from({ length: count }, (_, index) => ({
    x: 80 + (index % columns) * cellWidth,
    y: 90 + Math.floor(index / columns) * cellHeight,
  }));

  return { width, height, positions };
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = String(item?.[key] ?? "unknown");
    counts[value] = Number(counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function truncate(value, limit) {
  const safeValue = String(value ?? "");
  return safeValue.length > limit ? `${safeValue.slice(0, limit - 3)}...` : safeValue;
}

function buildDiagramService({ diagrams } = {}) {
  const betaDiagramCount = diagrams.filter((diagram) => diagram.trust?.label === "beta").length;
  const warningCount = diagrams.reduce(
    (sum, diagram) => sum + Number(diagram.validation?.warning_count ?? 0),
    0,
  );

  return {
    key: "diagrams",
    title: "Diagrams",
    subtitle: "Architecture, component, class, and sequence visuals published from the latest repository sync.",
    source_type: METRIC_SOURCE_TYPES.repoArtifact,
    state: diagrams.length > 0 ? "ready" : "missing",
    note:
      diagrams.length > 0
        ? betaDiagramCount > 0
          ? "Some diagrams are heuristic and now stay labeled beta until they are validated against implementation."
          : "These visuals stay image-like in the portal so customers can scan intent quickly without reading raw artifacts."
        : "No synced diagrams are attached to this repository profile yet.",
    metrics: [
      metric("Visuals", diagrams.length),
      metric(
        "Top type",
        diagrams[0]?.type?.replace(/[-_]+/g, " ") ?? "not available",
      ),
      metric("Trust", diagrams[0]?.trust?.label ?? "n/a"),
      metric("Validation", warningCount > 0 ? `${warningCount} warning(s)` : "passed"),
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

function buildContextPackPreviewService({
  profile,
  documents,
  documentItems,
  codeGraph,
} = {}) {
  const view = codeGraph?.view ?? {};
  const nodes = Array.isArray(view.nodes) ? view.nodes : [];
  const fileItems = buildContextPreviewFiles(nodes);
  const symbolItems = buildContextPreviewSymbols(nodes);
  const docItems = buildContextPreviewDocuments(documentItems);
  const warningCount = Number(profile?.overview?.policy_warnings ?? 0);
  const citations = [
    ...fileItems.slice(0, 3).map((file) => ({
      type: "graph",
      label: file.path,
      reason: "High-signal file from the synced focused code graph.",
    })),
    ...docItems.slice(0, 3).map((document) => ({
      type: "document",
      label: document.title,
      reason: document.restricted
        ? "Restricted document metadata is visible; raw content stays out of the preview."
        : "Synced project document can explain business or technical intent.",
    })),
    warningCount > 0
      ? {
          type: "policy",
          label: `${warningCount} policy warning(s)`,
          reason: "Policy warnings should be reviewed before giving this task to an agent.",
        }
      : {
          type: "policy",
          label: "No active policy warnings",
          reason: "The current repository profile has no published policy warnings.",
        },
  ].filter(Boolean);
  const tokenBudget = 1200;
  const estimatedTokens = Math.min(
    tokenBudget,
    fileItems.length * 90 + symbolItems.length * 36 + docItems.length * 110 + citations.length * 32,
  );
  const risks = buildContextPreviewRisks({
    profile,
    documents,
    fileItems,
    docItems,
    warningCount,
  });

  return {
    key: "context_pack_preview",
    title: "Context Pack Preview",
    subtitle: "A hosted preview of what a task-specific Heart pack would contain, built only from synced artifacts.",
    source_type: METRIC_SOURCE_TYPES.repoArtifact,
    state: fileItems.length > 0 || docItems.length > 0 ? "ready" : "missing",
    note:
      "This preview does not execute against the customer repository. Generate the final pack locally with the CLI so ignore rules, policy, and fresh graph state are applied.",
    metrics: [
      metric("Files", fileItems.length),
      metric("Docs", docItems.length),
      metric("Citations", citations.length),
      metric("Budget", `${tokenBudget} tokens`),
    ],
    sample_task: "add SSO login audit logging",
    cli_command: "heart pack \"add SSO login audit logging\"",
    mcp_tool: "context_pack",
    model_presets: [
      { id: "balanced", label: "Balanced coding model", token_budget: tokenBudget },
      { id: "low-cost", label: "Low-cost review model", token_budget: 900 },
      { id: "deep-context", label: "Deep context model", token_budget: 1800 },
    ],
    command_examples: [
      "/pack \"add SSO login audit logging\"",
      "/docs \"SSO requirements\"",
      "/impact src/auth/login.ts",
    ],
    preview: {
      schema_version: 1,
      task: "add SSO login audit logging",
      token_budget: tokenBudget,
      estimated_tokens: estimatedTokens,
      confidence_label: fileItems.length > 0 && docItems.length > 0 ? "medium" : "low",
      files: fileItems.slice(0, 6),
      symbols: symbolItems.slice(0, 6),
      documents: docItems.slice(0, 5),
      citations: citations.slice(0, 8),
      risks,
      next_actions: [
        "Run heart pack locally for the exact task before handing context to an AI agent.",
        "Run heart policy check if the preview includes policy warnings.",
        "Run heart docs sync-web when business requirements changed in the portal.",
      ],
    },
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
  const trendDigest = buildBenchmarkTrendDigest(benchmarkReports);
  return {
    key: "benchmark_roi",
    title: "Benchmark ROI",
    subtitle: "Benchmark-backed token, cleanup, memory, cost, and evidence-quality deltas tied to this repository.",
    source_type: METRIC_SOURCE_TYPES.benchmarkArtifact,
    state: benchmarkSummary.report_count > 0 ? "ready" : "missing",
    note:
      benchmarkSummary.report_count > 0
        ? "Savings stay clearly labeled as benchmark-derived so customers do not confuse proof with live metered spend."
        : "No benchmark artifact is attached to this repository yet.",
    metrics: [
      metric("Reports", benchmarkSummary.report_count),
      metric("Token save", `${benchmarkSummary.avg_token_savings_pct}%`),
      metric("Measurement", benchmarkSummary.latest_measurement_mode || "estimated"),
      metric("Evidence", trendDigest.summary.evidence_quality_label),
    ],
    summary: benchmarkSummary,
    trend_digest: trendDigest,
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
    latest_measurement_mode:
      [...reports]
        .sort((left, right) => String(right.generated_at ?? "").localeCompare(String(left.generated_at ?? "")))
        .find(Boolean)?.provenance?.summary?.measurement_mode ?? "",
    latest_confidence_label:
      [...reports]
        .sort((left, right) => String(right.generated_at ?? "").localeCompare(String(left.generated_at ?? "")))
        .find(Boolean)?.provenance?.summary?.confidence_label ?? "",
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

function buildContextPreviewFiles(nodes = []) {
  const seen = new Set();
  return nodes
    .filter((node) => node?.path)
    .sort((left, right) => Number(right.degree ?? 0) - Number(left.degree ?? 0))
    .flatMap((node) => {
      const filePath = sanitizeArtifactPath(node.path);
      if (!filePath || seen.has(filePath)) {
        return [];
      }

      seen.add(filePath);
      return [{
        path: filePath,
        label: node.type_key === "file" ? node.label : node.secondary_label || node.label,
        reason: node.degree > 0
          ? `${node.degree} visible graph connection(s)`
          : "Included in the synced focused graph",
      }];
    });
}

function buildContextPreviewSymbols(nodes = []) {
  const seen = new Set();
  return nodes
    .filter((node) => node?.path && node?.type_key !== "file")
    .sort((left, right) => Number(right.degree ?? 0) - Number(left.degree ?? 0))
    .flatMap((node) => {
      const symbolKey = `${node.label}:${node.path}`;
      if (seen.has(symbolKey)) {
        return [];
      }

      seen.add(symbolKey);
      return [{
        name: String(node.label ?? "symbol").slice(0, 120),
        type: String(node.type_label ?? node.type_key ?? "symbol").slice(0, 80),
        path: sanitizeArtifactPath(node.path),
      }];
    });
}

function buildContextPreviewDocuments(documentItems = []) {
  return documentItems.map((document) => ({
    title: String(document.title ?? document.path ?? "Untitled document").slice(0, 140),
    category: String(document.category ?? "general").slice(0, 80),
    path: sanitizeArtifactPath(document.path),
    restricted: Boolean(document.restricted),
    summary: sanitizePreviewText(document.summary || "No summary available."),
  }));
}

function buildContextPreviewRisks({
  profile,
  documents,
  fileItems,
  docItems,
  warningCount,
} = {}) {
  const risks = [];
  if (fileItems.length === 0) {
    risks.push("No focused code graph files are published for this repository.");
  }
  if (docItems.length === 0 && Number(documents?.totals?.document_count ?? profile?.documents?.document_count ?? 0) === 0) {
    risks.push("No synced requirements or design documents are available for this repository.");
  }
  if (warningCount > 0) {
    risks.push("Policy warnings are present and should be checked before agent handoff.");
  }
  if (String(profile?.cache?.status ?? "").toLowerCase() === "stale") {
    risks.push("The repository profile is stale; rescan before trusting the preview.");
  }
  return risks.length > 0 ? risks : ["No immediate preview risk is published for this repository."];
}

function sanitizeArtifactPath(value) {
  const pathValue = String(value ?? "").replace(/\\/g, "/");
  if (!pathValue || pathValue.startsWith("/") || /^[A-Za-z]:\//.test(pathValue)) {
    return "";
  }
  return pathValue.split("/").filter(Boolean).join("/").slice(0, 180);
}

function sanitizePreviewText(value) {
  return String(value ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, "[redacted-secret]")
    .slice(0, 220);
}
