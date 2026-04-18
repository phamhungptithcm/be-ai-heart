import readline from "node:readline";
import { buildWorkspaceState } from "../../core/src/index.js";
import { createToolCallResult, createToolRegistry, handleToolCall } from "./tools.js";

const SUPPORTED_PROTOCOL_VERSION = "2025-06-18";

export function createStdioMcpServer({
  repoRoot,
  stdin,
  stdout,
  stderr,
  buildState = buildWorkspaceState,
} = {}) {
  const state = {
    repoRoot,
    initialized: false,
    ready: false,
    stdin,
    stdout,
    stderr,
    buildState,
  };

  return {
    async start() {
      const input = readline.createInterface({
        input: state.stdin,
        crlfDelay: Infinity,
      });

      for await (const rawLine of input) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }

        let decoded;
        try {
          decoded = JSON.parse(line);
        } catch {
          writeMessage(state.stdout, createErrorResponse(null, -32700, "Parse error"));
          continue;
        }

        const responses = await handleEnvelope(state, decoded);
        if (responses.length === 0) {
          continue;
        }

        writeMessage(state.stdout, responses.length === 1 ? responses[0] : responses);
      }
    },
  };
}

export async function startStdioServer({
  repoRoot,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const server = createStdioMcpServer({
    repoRoot,
    stdin,
    stdout,
    stderr,
  });

  await server.start();
}

async function handleEnvelope(state, envelope) {
  if (Array.isArray(envelope)) {
    const nestedResponses = await Promise.all(envelope.map((message) => handleMessage(state, message)));
    return nestedResponses.filter(Boolean);
  }

  const response = await handleMessage(state, envelope);
  return response ? [response] : [];
}

async function handleMessage(state, message) {
  if (message === null || typeof message !== "object" || message.jsonrpc !== "2.0") {
    return createErrorResponse(message?.id ?? null, -32600, "Invalid Request");
  }

  if (!("method" in message)) {
    return null;
  }

  if (!("id" in message)) {
    return handleNotification(state, message);
  }

  try {
    return await handleRequest(state, message);
  } catch (error) {
    return createErrorResponse(message.id, -32000, error instanceof Error ? error.message : "Internal error");
  }
}

function handleNotification(state, message) {
  if (message.method === "notifications/initialized") {
    state.ready = true;
  }

  return null;
}

async function handleRequest(state, message) {
  switch (message.method) {
    case "initialize":
      state.initialized = true;
      return createSuccessResponse(message.id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSION,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: "heart-mcp",
          version: "0.1.0",
        },
        instructions:
          "Use the be-ai-heart tools to inspect repo structure, compile task-specific context, and check policy risks before generating code.",
      });
    case "ping":
      return createSuccessResponse(message.id, {});
    case "tools/list":
      ensureReadyForOperations(state);
      return createSuccessResponse(message.id, {
        tools: createToolRegistry(),
      });
    case "tools/call":
      ensureReadyForOperations(state);
      return createSuccessResponse(message.id, await handleToolRequest(state, message.params ?? {}));
    default:
      return createErrorResponse(message.id, -32601, `Method not found: ${message.method}`);
  }
}

async function handleToolRequest(state, params) {
  const name = readString(params.name, "Tool name is required.");
  const argumentsObject = readArgumentsObject(params.arguments);
  const workspaceState = await state.buildState(state.repoRoot);
  const payload = handleToolCall({
    name,
    args: argumentsObject,
    graph: workspaceState.graph,
    documentIndex: workspaceState.documentIndex,
    scanResult: workspaceState.scanResult,
    policyReport: workspaceState.policyReport,
  });

  return createToolCallResult(payload);
}

function ensureReadyForOperations(state) {
  if (!state.initialized) {
    throw new Error("Server has not completed initialize.");
  }

  if (!state.ready) {
    throw new Error("Server is waiting for notifications/initialized.");
  }
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

function createSuccessResponse(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function createErrorResponse(id, code, message) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

function writeMessage(stdout, payload) {
  stdout.write(`${JSON.stringify(payload)}\n`);
}
