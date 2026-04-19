import { findRelevantDocuments } from "../../document-ingest/src/index.js";
import { compileContextPack } from "../../context-compiler/src/index.js";
import {
  createDependencyExplanation,
  createImpactAnalysis,
  createProjectOverview,
  searchSymbols,
} from "../../graph/src/index.js";
import { evaluatePolicyViolations } from "../../policy-engine/src/index.js";

export function createToolRegistry() {
  return [
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
  ];
}

export function handleToolCall({
  name,
  args = {},
  graph,
  documentIndex = { documents: [], totals: { document_count: 0 } },
  heartModel = { domains: [], links: [], summary: { relationship_count: 0 } },
  scanResult = graph.scanResult,
  policyReport,
}) {
  switch (name) {
    case "project_overview":
      return createProjectOverview(
        graph,
        policyReport ?? evaluatePolicyViolations(scanResult),
        documentIndex,
        heartModel,
      );
    case "symbol_lookup":
      return {
        query: args.query ?? "",
        matches: searchSymbols(graph, args.query ?? ""),
      };
    case "dependency_explain":
      return createDependencyExplanation(graph, args.target ?? "");
    case "context_pack":
      return compileContextPack({
        task: args.task ?? "",
        graph,
        documentIndex,
        heartModel,
        policyReport: policyReport ?? evaluatePolicyViolations(scanResult),
      });
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
