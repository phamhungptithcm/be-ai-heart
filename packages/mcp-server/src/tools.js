import { findRelevantDocuments } from "../../document-ingest/src/index.js";
import { createBenchmarkSummary } from "../../benchmark/src/index.js";
import { compileContextPack } from "../../context-compiler/src/index.js";
import {
  detectPackLayerConflicts,
  explainEffectivePackRules,
  getDomainPack,
  getPackBenchmarks,
  getPackBuildOptions,
  listDomainPacks,
  listPackLayers,
  validateDomainPack,
  writePackArtifact,
} from "../../core/src/index.js";
import {
  createDefaultGenerationPlan,
  generateProjectFromDomainAndStack,
  listStackPresets,
  previewGenerationPlan,
} from "../../project-generator/src/index.js";
import {
  createDependencyExplanation,
  createImpactAnalysis,
  createProjectOverview,
  searchSymbols,
} from "../../graph/src/index.js";
import { evaluatePolicyViolations } from "../../policy-engine/src/index.js";
import { EDGE_TYPES, NODE_TYPES } from "../../shared-schema/src/index.js";

const TOOL_DEFINITIONS = Object.freeze([
  {
    name: "project_overview",
    description: "Summarize the indexed repository shape and architecture hotspots.",
    inputSchema: emptyInputSchema(),
  },
  {
    name: "symbol_lookup",
    description: "Find symbols by name and show their file locations.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Symbol name or partial symbol name to search for.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "dependency_explain",
    description: "Explain import, call, inheritance, and test relationships for a file or symbol.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "File path or symbol name to explain.",
        },
      },
      required: ["target"],
      additionalProperties: false,
    },
  },
  {
    name: "context_pack",
    description: "Compile a task-specific context pack for AI coding work.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Concrete coding task or question to optimize context for.",
        },
        token_budget: {
          type: "integer",
          description: "Optional maximum token target for deterministic pack trimming.",
          minimum: 1,
        },
      },
      required: ["task"],
      additionalProperties: false,
    },
  },
  {
    name: "domain_pack_list",
    description: "List available domain packs with compact metadata and security warnings.",
    inputSchema: emptyInputSchema(),
  },
  {
    name: "domain_pack_get",
    description: "Get compact metadata, output types, layers, citations, and warnings for a domain pack.",
    inputSchema: domainPackIdSchema(),
  },
  {
    name: "domain_pack_layers",
    description: "List pack layers and overlays.",
    inputSchema: domainPackIdSchema(),
  },
  {
    name: "domain_pack_build_options",
    description: "Show allowlisted output types, layer selectors, overlays, and token budgets for a domain pack.",
    inputSchema: domainPackIdSchema(),
  },
  {
    name: "domain_pack_generate",
    description: "Generate a source-backed domain pack artifact using allowlisted output and layer options.",
    inputSchema: {
      type: "object",
      properties: {
        pack_id: { type: "string", description: "Domain pack id.", default: "tolling-management" },
        output: {
          type: "string",
          enum: ["domain-pack", "sales-demo-kit", "website", "ui-prototype", "proposal", "benchmarks", "context-pack"],
        },
        regional_layer: { type: "string", description: "Regional layer id such as texas." },
        agency_overlay: { type: "string", description: "Agency overlay id such as hctra-example." },
        customer_requirements: { type: "string", description: "Customer-specific demo-safe requirements." },
        token_budget: { type: "integer", minimum: 1 },
      },
      required: ["output"],
      additionalProperties: false,
    },
  },
  {
    name: "domain_pack_validate",
    description: "Validate a domain pack contract and expected source files.",
    inputSchema: domainPackIdSchema(),
  },
  {
    name: "domain_pack_conflicts",
    description: "Detect conflicts across selected pack layers and overlays.",
    inputSchema: domainPackSelectionSchema(),
  },
  {
    name: "domain_pack_context",
    description: "Return compact layer-aware rules and citations for AI implementation context.",
    inputSchema: domainPackSelectionSchema(),
  },
  {
    name: "domain_pack_benchmark_scenarios",
    description: "Return compact benchmark scenarios for a domain pack.",
    inputSchema: domainPackIdSchema(),
  },
  {
    name: "stack_preset_list",
    description: "List supported domain-to-project tech stack presets.",
    inputSchema: emptyInputSchema(),
  },
  {
    name: "domain_project_plan",
    description: "Preview a domain-to-project generation plan without writing files.",
    inputSchema: domainProjectPlanSchema(),
  },
  {
    name: "domain_project_generate",
    description: "Generate a starter project from domain and stack only when confirmed.",
    inputSchema: {
      ...domainProjectPlanSchema(),
      properties: {
        ...domainProjectPlanSchema().properties,
        confirmed: { type: "boolean", description: "Must be true before files are written." },
      },
    },
  },
  {
    name: "impact_analysis",
    description: "Show likely dependent files and risk radius for a file or symbol.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "File path or symbol name to analyze.",
        },
      },
      required: ["target"],
      additionalProperties: false,
    },
  },
  {
    name: "document_search",
    description: "Find relevant business, requirements, technical, or system-design documents.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Task, domain, or document concept to search for.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "docs_search",
    description: "Alias for document_search for MCP clients that prefer docs naming.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Task, domain, or document concept to search for.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "policy_check",
    description: "Evaluate current source files against lightweight repository policies.",
    inputSchema: emptyInputSchema(),
  },
  {
    name: "benchmark_summary",
    description: "Summarize local benchmark ROI evidence and latest report readiness.",
    inputSchema: emptyInputSchema(),
  },
]);

export function createToolRegistry(options = {}) {
  const enabledTools = normalizeEnabledTools(options.enabledTools);
  return TOOL_DEFINITIONS.filter((tool) => enabledTools === null || enabledTools.has(tool.name));
}

export function handleToolCall({
  name,
  args = {},
  graph,
  documentIndex = { documents: [], totals: { document_count: 0 } },
  heartModel = { domains: [], links: [], summary: { relationship_count: 0 } },
  scanResult = graph.scanResult,
  policyReport,
  readiness,
  enabledTools,
  repoRoot,
}) {
  if (!isToolEnabled(name, enabledTools)) {
    throw new Error(`MCP tool "${name}" is disabled by mcp.enabled_tools in heart.config.yaml.`);
  }

  switch (name) {
    case "project_overview": {
      const resolvedPolicyReport = policyReport ?? evaluatePolicyViolations(scanResult);
      const overview = createProjectOverview(
        graph,
        resolvedPolicyReport,
        documentIndex,
        heartModel,
      );
      return {
        ...overview,
        readiness,
        memory_profile: createMemoryProfile(graph, documentIndex, resolvedPolicyReport),
        agent_workflow: createProjectOverviewWorkflow(documentIndex, enabledTools),
      };
    }
    case "symbol_lookup":
      return {
        query: args.query ?? "",
        matches: searchSymbols(graph, args.query ?? ""),
      };
    case "dependency_explain":
      return createDependencyExplanation(graph, args.target ?? "");
    case "context_pack": {
      const pack = compileContextPack({
        task: args.task ?? "",
        graph,
        documentIndex,
        heartModel,
        policyReport: policyReport ?? evaluatePolicyViolations(scanResult),
        tokenBudget: args.token_budget,
      });
      return {
        ...pack,
        agent_contract: createContextPackAgentContract(pack, enabledTools),
      };
    }
    case "domain_pack_list":
      return listDomainPacks({ repoRoot }).then((packs) => ({
        schema_version: 1,
        packs: packs.map(compactDomainPackForMcp),
      }));
    case "domain_pack_get":
      return getDomainPack(args.pack_id ?? "tolling-management", { repoRoot }).then(compactDomainPackDetailForMcp);
    case "domain_pack_layers":
      return listPackLayers(args.pack_id ?? "tolling-management", { repoRoot }).then((layers) => ({
        schema_version: 1,
        pack_id: args.pack_id ?? "tolling-management",
        layers,
      }));
    case "domain_pack_build_options":
      return {
        ...getPackBuildOptions(args.pack_id ?? "tolling-management"),
        security_warnings: createDomainPackSecurityWarnings(),
      };
    case "domain_pack_generate":
      return writePackArtifact({
        repoRoot: repoRoot ?? graph.rootDir ?? graph.scanResult?.rootDir ?? process.cwd(),
        sourceRepoRoot: process.cwd(),
        packId: args.pack_id ?? "tolling-management",
        outputType: args.output,
        regionalLayer: args.regional_layer,
        agencyOverlay: args.agency_overlay,
        customerRequirements: args.customer_requirements ?? "",
        tokenBudget: args.token_budget,
      }).then((result) => ({
        schema_version: 1,
        status: result.status,
        artifact_id: result.artifact_id,
        manifest: result.manifest,
        generated_files: result.manifest.generated_files,
        citations: result.manifest.source_citations,
        security_warnings: result.manifest.warnings,
        next_actions: result.next_actions,
      }));
    case "domain_pack_validate":
      return validateDomainPack(args.pack_id ?? "tolling-management", { repoRoot });
    case "domain_pack_conflicts":
      return detectPackLayerConflicts(normalizeDomainPackToolArgs(args), { repoRoot }).then((conflicts) => ({
        schema_version: 1,
        pack_id: args.pack_id ?? "tolling-management",
        conflicts,
        status: conflicts.length > 0 ? "conflicts_found" : "clear",
      }));
    case "domain_pack_context":
      return explainEffectivePackRules(normalizeDomainPackToolArgs(args), { repoRoot }).then((context) => ({
        schema_version: 1,
        pack_id: context.pack_id,
        token_budget: args.token_budget ?? null,
        summary: context.summary,
        context_items: Object.values(context.rules_by_layer)
          .flat()
          .slice(0, clampToolLimit(args.token_budget, 12))
          .map((entry) => ({
            rule_id: entry.rule_id,
            layer: entry.layer,
            title: entry.title,
            summary: entry.summary,
            source_ref: entry.source_ref,
            risk: entry.risk,
          })),
        conflicts: context.conflicts,
        citations: context.citations,
        security_warnings: context.warnings,
      }));
    case "domain_pack_benchmark_scenarios":
      return getPackBenchmarks(args.pack_id ?? "tolling-management", { repoRoot }).then((benchmarks) => ({
        schema_version: benchmarks.schema_version,
        pack_id: benchmarks.pack_id,
        scenarios: benchmarks.scenarios.map((scenario) => ({
          id: scenario.id,
          title: scenario.title,
          task_prompt: scenario.task_prompt,
          expected_context_files: scenario.expected_context_files,
          guardrails: scenario.guardrails,
          roi_fields: scenario.roi_fields,
        })),
      }));
    case "stack_preset_list":
      return {
        schema_version: 1,
        presets: listStackPresets().map((preset) => ({
          stack_id: preset.stack_id,
          display_name: preset.display_name,
          frontend_framework: preset.frontend_framework,
          backend_framework: preset.backend_framework,
          database: preset.database,
          deploy_target: preset.deploy_target,
          limitations: preset.limitations,
        })),
      };
    case "domain_project_plan":
      return createDefaultGenerationPlan({
        repoRoot: repoRoot ?? graph.rootDir ?? graph.scanResult?.rootDir ?? process.cwd(),
        domainId: args.domain_id ?? args.pack_id ?? "tolling-management",
        stackId: args.stack_id,
        mode: args.mode,
        outputDir: args.output_dir,
        regionalLayer: args.regional_layer,
        agencyOverlay: args.agency_overlay,
        customerRequirements: args.customer_requirements,
        prompt: args.prompt,
      }).then((plan) => previewGenerationPlan(plan));
    case "domain_project_generate":
      return generateProjectFromDomainAndStack({
        repoRoot: repoRoot ?? graph.rootDir ?? graph.scanResult?.rootDir ?? process.cwd(),
        domainId: args.domain_id ?? args.pack_id ?? "tolling-management",
        stackId: args.stack_id,
        mode: args.mode,
        outputDir: args.output_dir,
        regionalLayer: args.regional_layer,
        agencyOverlay: args.agency_overlay,
        customerRequirements: args.customer_requirements,
        prompt: args.prompt,
        confirmed: Boolean(args.confirmed),
      });
    case "impact_analysis":
      return createImpactAnalysis(graph, args.target ?? "");
    case "document_search":
    case "docs_search":
      return {
        query: args.query ?? "",
        matches: findRelevantDocuments(documentIndex, args.query ?? "", 8),
      };
    case "policy_check":
      return policyReport ?? evaluatePolicyViolations(scanResult);
    case "benchmark_summary":
      return createBenchmarkSummary(repoRoot ?? graph.rootDir ?? graph.scanResult?.rootDir ?? process.cwd());
    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

export function createToolCallResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
    isError: false,
  };
}

function emptyInputSchema() {
  return {
    type: "object",
    properties: {},
    additionalProperties: false,
  };
}

function domainPackIdSchema() {
  return {
    type: "object",
    properties: {
      pack_id: {
        type: "string",
        description: "Domain pack id.",
        default: "tolling-management",
      },
    },
    additionalProperties: false,
  };
}

function domainPackSelectionSchema() {
  return {
    type: "object",
    properties: {
      pack_id: { type: "string", default: "tolling-management" },
      regional_layer: { type: "string" },
      agency_overlay: { type: "string" },
      customer_requirements: { type: "string" },
      token_budget: { type: "integer", minimum: 1 },
    },
    additionalProperties: false,
  };
}

function domainProjectPlanSchema() {
  return {
    type: "object",
    properties: {
      domain_id: { type: "string", description: "Domain pack id.", default: "tolling-management" },
      pack_id: { type: "string", description: "Compatibility alias for domain_id." },
      stack_id: { type: "string", description: "Stack preset id such as next-fullstack-postgres." },
      mode: { type: "string", description: "Generation mode such as docs-only, sales-demo, or product-starter." },
      output_dir: { type: "string", description: "Output directory relative to repo root." },
      regional_layer: { type: "string", description: "Regional layer id such as texas." },
      agency_overlay: { type: "string", description: "Agency overlay id such as hctra-example." },
      customer_requirements: { type: "string", description: "Demo-safe customer requirements." },
      prompt: { type: "string", description: "Natural-language generation request." },
    },
    additionalProperties: false,
  };
}

function normalizeEnabledTools(enabledTools) {
  if (!Array.isArray(enabledTools)) {
    return null;
  }

  const selected = new Set(enabledTools);
  if (selected.has("document_search")) {
    selected.add("docs_search");
  }
  if (selected.has("docs_search")) {
    selected.add("document_search");
  }
  return selected;
}

function compactDomainPackForMcp(pack) {
  return {
    pack_id: pack.pack_id,
    name: pack.name,
    description: pack.description,
    version: pack.version,
    status: pack.status,
    layers_available: (pack.layers_available ?? []).map((layer) => ({
      id: layer.id,
      layer: layer.layer,
      label: layer.label,
    })),
    artifacts_available: (pack.artifacts_available ?? []).map((artifact) => artifact.id),
    security_warnings: pack.security_warnings ?? createDomainPackSecurityWarnings(),
    last_updated: pack.last_updated,
  };
}

function compactDomainPackDetailForMcp(pack) {
  return {
    schema_version: pack.schema_version,
    pack_id: pack.pack_id,
    name: pack.name,
    description: pack.description,
    version: pack.version,
    status: pack.status,
    category: pack.category,
    layers_available: (pack.layers_available ?? []).map((layer) => ({
      id: layer.id,
      layer: layer.layer,
      label: layer.label,
      description: layer.description,
    })),
    artifacts_available: (pack.artifacts_available ?? []).map((artifact) => ({
      id: artifact.id,
      label: artifact.label,
      description: artifact.description,
    })),
    required_inputs: pack.required_inputs,
    optional_inputs: pack.optional_inputs,
    source_notes: (pack.source_notes ?? []).map((source) => ({
      source_ref: source.source_ref,
      label: source.label,
      url: source.url,
    })),
    benchmark_scenarios: (pack.benchmark_scenarios ?? []).map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      guardrails: scenario.guardrails,
    })),
    security_warnings: pack.security_warnings ?? createDomainPackSecurityWarnings(),
    last_updated: pack.last_updated,
  };
}

function normalizeDomainPackToolArgs(args = {}) {
  return {
    pack_id: args.pack_id ?? "tolling-management",
    regional_layer: args.regional_layer,
    agency_overlay: args.agency_overlay,
    customer_requirements: args.customer_requirements,
  };
}

function createDomainPackSecurityWarnings() {
  return [
    "No real PII, license plates, plate images, trip history, support transcripts, card data, or production secrets.",
    "Toll rates, fee amounts, notice windows, collections policy, and legal outcomes require customer-approved sources.",
    "Pack tools are allowlisted; portal chat must not execute arbitrary shell commands.",
  ];
}

function clampToolLimit(tokenBudget, defaultLimit) {
  const budget = Number(tokenBudget);
  if (!Number.isFinite(budget) || budget <= 0) {
    return defaultLimit;
  }
  return Math.max(4, Math.min(defaultLimit, Math.floor(budget / 180)));
}

function isToolEnabled(name, enabledTools) {
  const normalizedEnabledTools = normalizeEnabledTools(enabledTools);
  return normalizedEnabledTools === null || normalizedEnabledTools.has(name);
}

function createMemoryProfile(
  graph,
  documentIndex = { totals: { document_count: 0 } },
  policyReport = { violations: [] },
) {
  const nodeCounts = graph.summary?.node_types ?? {};
  const edgeCounts = graph.summary?.edge_types ?? {};
  const typedGraphReady =
    (edgeCounts[EDGE_TYPES.calls] ?? 0) > 0 &&
    ((edgeCounts[EDGE_TYPES.extends] ?? 0) > 0 || (edgeCounts[EDGE_TYPES.implements] ?? 0) > 0) &&
    (edgeCounts[EDGE_TYPES.testedBy] ?? 0) > 0;

  return {
    typed_graph_ready: typedGraphReady,
    node_counts: {
      repository: nodeCounts[NODE_TYPES.repository] ?? 0,
      files: nodeCounts[NODE_TYPES.file] ?? 0,
      classes: nodeCounts[NODE_TYPES.class] ?? 0,
      interfaces: nodeCounts[NODE_TYPES.interface] ?? 0,
      functions: nodeCounts[NODE_TYPES.function] ?? 0,
      methods: nodeCounts[NODE_TYPES.method] ?? 0,
      tests: nodeCounts[NODE_TYPES.test] ?? 0,
      documents: nodeCounts[NODE_TYPES.document] ?? 0,
      policies: nodeCounts[NODE_TYPES.policy] ?? 0,
    },
    edge_counts: {
      IMPORTS: edgeCounts[EDGE_TYPES.imports] ?? 0,
      CALLS: edgeCounts[EDGE_TYPES.calls] ?? 0,
      EXTENDS: edgeCounts[EDGE_TYPES.extends] ?? 0,
      IMPLEMENTS: edgeCounts[EDGE_TYPES.implements] ?? 0,
      TESTED_BY: edgeCounts[EDGE_TYPES.testedBy] ?? 0,
      VIOLATES_POLICY: edgeCounts[EDGE_TYPES.violatesPolicy] ?? 0,
    },
    document_memory_ready: (documentIndex.totals?.document_count ?? 0) > 0,
    policy_warnings: policyReport.violations?.length ?? 0,
  };
}

function createProjectOverviewWorkflow(documentIndex = { totals: { document_count: 0 } }, enabledTools) {
  const allowedTools = normalizeEnabledTools(enabledTools);
  const nextTools = filterEnabledTools(
    [
      "context_pack",
      "dependency_explain",
      "impact_analysis",
      (documentIndex.totals?.document_count ?? 0) > 0 ? "document_search" : null,
      "policy_check",
    ],
    allowedTools,
  );
  const guidanceParts = [];

  if (toolIsEnabled("context_pack", allowedTools)) {
    guidanceParts.push("Use context_pack for a concrete task.");
  }
  if (toolIsEnabled("dependency_explain", allowedTools)) {
    guidanceParts.push("Use dependency_explain for a file or symbol.");
  }
  if (toolIsEnabled("impact_analysis", allowedTools)) {
    guidanceParts.push("Use impact_analysis before risky edits.");
  }
  if (toolIsEnabled("policy_check", allowedTools)) {
    guidanceParts.push("Use policy_check to confirm boundary and governance posture.");
  }

  return {
    start_with: "project_overview",
    next_tools: nextTools,
    guidance: guidanceParts.join(" "),
  };
}

function createContextPackAgentContract(pack, enabledTools) {
  const evidence = pack.evidence_summary ?? {};
  const lowCoverage = Number(evidence.matched_task_token_pct ?? 0) < 35;
  const lowEvidence = Number(evidence.overall_evidence_score ?? 0) < 0.4;
  const thinTruncatedPack =
    Boolean(pack.truncated) &&
    (Number(evidence.matched_task_token_pct ?? 0) < 60 ||
      Number(evidence.overall_evidence_score ?? 0) < 0.65 ||
      pack.missing_context_warnings.length > 0);
  const shouldScanRepoWide =
    pack.relevant_files.length === 0 ||
    pack.relevant_symbols.length === 0 ||
    pack.confidence.overall < 0.45 ||
    pack.missing_context_warnings.length >= 3 ||
    thinTruncatedPack ||
    lowCoverage ||
    lowEvidence;
  const followupTools = filterEnabledTools([
    "dependency_explain",
    pack.relevant_documents.length === 0 ? "document_search" : null,
    pack.related_tests.length > 0 ? "impact_analysis" : null,
    pack.policies.length > 0 ? "policy_check" : null,
  ], normalizeEnabledTools(enabledTools));

  return {
    should_scan_repo_wide: shouldScanRepoWide,
    token_budget_applied: Boolean(pack.token_budget),
    truncated: Boolean(pack.truncated),
    primary_evidence_order: [
      "relevant_symbols",
      "call_paths",
      "graph_context.related_symbols",
      "relevant_files",
      "relevant_documents",
      "related_tests",
    ],
    followup_tools: followupTools,
  };
}

function dedupe(values) {
  return [...new Set(values)];
}

function filterEnabledTools(values, enabledTools) {
  return dedupe(values.filter((value) => toolIsEnabled(value, enabledTools)));
}

function toolIsEnabled(name, enabledTools) {
  return Boolean(name) && (enabledTools === null || enabledTools.has(name));
}
