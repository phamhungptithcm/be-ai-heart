import { findRelevantDocuments } from "../../../packages/document-ingest/src/index.js";
import { createToolCallResult } from "../../../packages/mcp-server/src/index.js";
import { loadAccessibleRepositoryView } from "./access.js";

const HOSTED_PROTOCOL_VERSION = "2025-06-18";

export function createHostedMcpToolRegistry() {
  return [
    {
      name: "project_overview",
      description: "Summarize a published repository profile visible to the authenticated workspace session.",
      inputSchema: {
        type: "object",
        properties: {
          profile_slug: {
            type: "string",
            description: "Optional repository profile slug. Defaults to the current workspace profile.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "document_search",
      description: "Search synced project documents for the current workspace profile.",
      inputSchema: {
        type: "object",
        properties: {
          profile_slug: {
            type: "string",
            description: "Optional repository profile slug. Defaults to the current workspace profile.",
          },
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
      name: "context_pack",
      description: "Compile a hosted read-only context pack from published repository and document artifacts.",
      inputSchema: {
        type: "object",
        properties: {
          profile_slug: {
            type: "string",
            description: "Optional repository profile slug. Defaults to the current workspace profile.",
          },
          task: {
            type: "string",
            description: "Concrete task or question to optimize hosted context for.",
          },
        },
        required: ["task"],
        additionalProperties: false,
      },
    },
  ];
}

export function createHostedMcpSuccessResponse(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

export function createHostedMcpErrorResponse(id, code, message) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

export async function handleHostedMcpMessage({
  message,
  serviceStorageRoot,
  surface,
  actorSlug,
  defaultProfileSlug,
} = {}) {
  if (message === null || typeof message !== "object" || message.jsonrpc !== "2.0") {
    return createHostedMcpErrorResponse(message?.id ?? null, -32600, "Invalid Request");
  }

  if (typeof message.method !== "string") {
    return createHostedMcpErrorResponse(message?.id ?? null, -32600, "Invalid Request");
  }

  if (message.method === "initialize") {
    return createHostedMcpSuccessResponse(message.id, {
      protocolVersion: HOSTED_PROTOCOL_VERSION,
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: "heart-mcp-hosted",
        version: "0.1.0",
      },
      instructions:
        "Use the hosted BeHeart MCP tools for published repository summaries and synced document context. Local graph-only tools are intentionally unavailable here.",
    });
  }

  if (message.method === "tools/list") {
    return createHostedMcpSuccessResponse(message.id, {
      tools: createHostedMcpToolRegistry(),
    });
  }

  if (message.method === "tools/call") {
    try {
      const name = readString(message.params?.name, "Tool name is required.");
      const args = readArgumentsObject(message.params?.arguments);
      const payload = await handleHostedToolCall({
        name,
        args,
        serviceStorageRoot,
        surface,
        actorSlug,
        defaultProfileSlug,
      });
      return createHostedMcpSuccessResponse(message.id, createToolCallResult(payload));
    } catch (error) {
      return createHostedMcpErrorResponse(
        message.id,
        -32000,
        error instanceof Error ? error.message : "Hosted MCP tool call failed.",
      );
    }
  }

  return createHostedMcpErrorResponse(message.id, -32601, `Method not found: ${message.method}`);
}

async function handleHostedToolCall({
  name,
  args,
  serviceStorageRoot,
  surface,
  actorSlug,
  defaultProfileSlug,
}) {
  const profileSlug = sanitizeSlug(args.profile_slug ?? defaultProfileSlug ?? "");
  const repositoryView = await loadRepositoryView({
    serviceStorageRoot,
    surface,
    actorSlug,
    profileSlug,
  });

  if (name === "project_overview") {
    return {
      profile_slug: repositoryView.profile.profile_slug,
      workspace_slug: repositoryView.profile.workspace_slug ?? repositoryView.profile.profile_slug,
      customer_slug: repositoryView.profile.customer_slug ?? repositoryView.profile.profile_slug,
      repo: repositoryView.profile.repo,
      ...repositoryView.profile.overview,
    };
  }

  if (name === "document_search") {
    const query = readString(args.query, "Document query is required.");
    return {
      profile_slug: repositoryView.profile.profile_slug,
      query,
      matches: findRelevantDocuments(toHostedDocumentIndex(repositoryView), query, 8),
    };
  }

  if (name === "context_pack") {
    const task = readString(args.task, "Context-pack task is required.");
    const matches = findRelevantDocuments(toHostedDocumentIndex(repositoryView), task, 8);

    return {
      task,
      profile_slug: repositoryView.profile.profile_slug,
      summary: repositoryView.profile.overview.summary,
      relevant_documents: matches,
      relevant_files: [],
      relevant_symbols: [],
      reuse_candidates: [],
      policies: [],
      risks: [
        "Hosted MCP currently uses published repository profiles and synced documents only.",
        "Local graph-only tools such as symbol lookup, dependency explain, and impact analysis are unavailable in hosted mode.",
      ],
      open_questions:
        matches.length === 0
          ? ["No synced documents matched this hosted task. Re-run local sync or use local MCP for graph-level context."]
          : [],
    };
  }

  throw new Error(`Hosted MCP tool '${name}' is not available.`);
}

async function loadRepositoryView({ serviceStorageRoot, surface, actorSlug, profileSlug }) {
  if (!profileSlug) {
    throw new Error("profile_slug is required for hosted MCP until a workspace profile is selected.");
  }

  const repositoryView = await loadAccessibleRepositoryView({
    serviceStorageRoot,
    surface,
    actorSlug,
    profileSlug,
  });

  if (!repositoryView?.profile) {
    throw new Error(`Hosted repository profile '${profileSlug}' is not available for this session.`);
  }

  return repositoryView;
}

function toHostedDocumentIndex(repositoryView) {
  return {
    totals:
      repositoryView.documents?.totals ?? {
        document_count: repositoryView.documents?.documents?.length ?? 0,
      },
    documents: repositoryView.documents?.documents ?? [],
  };
}

function readString(value, message) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }

  return value;
}

function readArgumentsObject(value) {
  if (value === undefined) {
    return {};
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tool arguments must be an object when provided.");
  }

  return value;
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
