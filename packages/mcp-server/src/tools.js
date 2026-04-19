import { findRelevantDocuments } from "../../document-ingest/src/index.js";
import { compileContextPack } from "../../context-compiler/src/index.js";
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
      name: "policy_check",
      description: "Evaluate current source files against lightweight repository policies.",
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
  enabledTools,
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
        memory_profile: createMemoryProfile(graph, documentIndex, resolvedPolicyReport),
        agent_workflow: createProjectOverviewWorkflow(documentIndex),
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
        agent_contract: createContextPackAgentContract(pack),
      };
    }
    case "impact_analysis":
      return createImpactAnalysis(graph, args.target ?? "");
    case "document_search":
      return {
        query: args.query ?? "",
        matches: findRelevantDocuments(documentIndex, args.query ?? "", 8),
      };
    case "policy_check":
      return policyReport ?? evaluatePolicyViolations(scanResult);
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

function normalizeEnabledTools(enabledTools) {
  if (!Array.isArray(enabledTools)) {
    return null;
  }

  return new Set(enabledTools);
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

function createProjectOverviewWorkflow(documentIndex = { totals: { document_count: 0 } }) {
  const nextTools = [
    "context_pack",
    "dependency_explain",
    "impact_analysis",
  ];

  if ((documentIndex.totals?.document_count ?? 0) > 0) {
    nextTools.push("document_search");
  }

  nextTools.push("policy_check");

  return {
    start_with: "project_overview",
    next_tools: nextTools,
    guidance:
      "Use context_pack for a concrete task, dependency_explain for a file or symbol, and impact_analysis before risky edits.",
  };
}

function createContextPackAgentContract(pack) {
  const shouldScanRepoWide =
    pack.relevant_files.length === 0 ||
    pack.relevant_symbols.length === 0 ||
    pack.confidence.overall < 0.45 ||
    pack.missing_context_warnings.length >= 3;
  const followupTools = dedupe([
    "dependency_explain",
    pack.relevant_documents.length === 0 ? "document_search" : null,
    pack.related_tests.length > 0 ? "impact_analysis" : null,
    pack.policies.length > 0 ? "policy_check" : null,
  ].filter(Boolean));

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
