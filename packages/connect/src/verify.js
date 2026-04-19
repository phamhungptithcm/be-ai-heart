import { spawn } from "node:child_process";
import readline from "node:readline";

import { detectClaudeCode } from "./agent-adapters/claude-code.js";
import { detectCline } from "./agent-adapters/cline.js";
import { detectCodex } from "./agent-adapters/codex.js";
import { detectCopilotCli } from "./agent-adapters/copilot-cli.js";
import { detectContinue } from "./agent-adapters/continue.js";
import { detectCursor } from "./agent-adapters/cursor.js";
import { detectVsCode } from "./agent-adapters/vscode.js";
import { detectWindsurf } from "./agent-adapters/windsurf.js";
import { detectConnections } from "./detect.js";
import {
  extractMcpRemoteUrl,
  isRemoteMcpEntry,
} from "./mcp-transport.js";

const HANDSHAKE_TIMEOUT_MS = 5_000;
const PROTOCOL_VERSION = "2025-06-18";

export async function verifyConnection({
  client,
  repoRoot,
  plan,
  env = process.env,
  spawnImpl = spawn,
  fetchImpl = globalThis.fetch,
  sessionToken = null,
} = {}) {
  const mcpEntry = plan?.mcp_entry ?? {};
  const report = {
    client,
    repo_root: repoRoot,
    transport: isRemoteMcpEntry(mcpEntry) ? "remote" : "stdio",
    config_status: "not_checked",
    spawn_status: isRemoteMcpEntry(mcpEntry) ? "not_applicable" : "ok",
    discovery_status: "not_checked",
    auth_status: "not_checked",
    initialize_status: "failed",
    tools_list_status: "failed",
    model_runtime_status: "not_checked",
    warnings: [],
    status: "failed",
  };
  const stderrChunks = [];

  const configVerification = await verifyInstalledClientConfig({
    client,
    repoRoot,
    plan,
    env,
  });
  if (configVerification.checked) {
    report.config_status = configVerification.ok ? "ok" : "failed";
    report.warnings.push(...configVerification.warnings);
  }

  try {
    if (isRemoteMcpEntry(mcpEntry)) {
      const remoteVerification = await verifyRemoteConnection({
        mcpEntry,
        fetchImpl,
        sessionToken,
      });
      report.discovery_status = remoteVerification.discovery_status;
      report.auth_status = remoteVerification.auth_status;
      report.initialize_status = remoteVerification.initialize_status;
      report.tools_list_status = remoteVerification.tools_list_status;
      report.warnings.push(...remoteVerification.warnings);
      report.status = remoteVerification.status;
      if (report.config_status === "failed") {
        report.status = "failed";
      }
      return report;
    }

    const child = spawnImpl(mcpEntry.command, normalizeArgs(mcpEntry.args), {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdout = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });
    const stdoutIterator = stdout[Symbol.asyncIterator]();

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });

    child.on("error", (error) => {
      stderrChunks.push(error.message);
    });

    try {
      writeMessage(child.stdin, {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: "heart-connect-verify",
            version: "0.1.0",
          },
        },
      });

      const initializeResponse = await readResponse(stdoutIterator, 1);
      if (initializeResponse.error) {
        throw new Error(initializeResponse.error.message ?? "Initialize failed.");
      }
      report.initialize_status = "ok";

      writeMessage(child.stdin, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
      writeMessage(child.stdin, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });

      const toolsResponse = await readResponse(stdoutIterator, 2);
      if (toolsResponse.error) {
        throw new Error(toolsResponse.error.message ?? "tools/list failed.");
      }
      report.discovery_status = "ok";
      report.auth_status = "ok";
      report.tools_list_status = "ok";
      report.status = "ready";
    } finally {
      stdout.close();
      child.stdin.end();
      await stopChildProcess(child);
    }
  } catch (error) {
    report.spawn_status = report.initialize_status === "failed" ? "failed" : "ok";
    report.warnings.push(error instanceof Error ? error.message : String(error));
    if (stderrChunks.length > 0) {
      report.warnings.push(stderrChunks.join("").trim());
    }
  }

  if (report.config_status === "failed") {
    report.status = "failed";
  }

  return report;
}

async function verifyInstalledClientConfig({ client, repoRoot, plan, env }) {
  if (!plan?.config_locations) {
    return {
      checked: false,
      ok: true,
      warnings: [],
    };
  }

  let detectedClient = null;
  const remoteUrl = extractMcpRemoteUrl(plan?.mcp_entry);

  if (client === "cursor") {
    detectedClient = await detectCursor({ repoRoot, remoteUrl, env });
  } else if (client === "claude-code") {
    detectedClient = await detectClaudeCode({ repoRoot, remoteUrl, env });
  } else if (client === "codex") {
    detectedClient = await detectCodex({ repoRoot, remoteUrl, env });
  } else if (client === "windsurf") {
    detectedClient = await detectWindsurf({ repoRoot, remoteUrl, env });
  } else if (client === "cline") {
    detectedClient = await detectCline({ repoRoot, remoteUrl, env });
  } else if (client === "copilot-cli") {
    detectedClient = await detectCopilotCli({ repoRoot, remoteUrl, env });
  } else if (client === "vscode") {
    detectedClient = await detectVsCode({ repoRoot, remoteUrl, env });
  } else if (client === "continue") {
    detectedClient = await detectContinue({ repoRoot, remoteUrl, env });
  } else {
    return {
      checked: false,
      ok: true,
      warnings: [],
    };
  }

  if (detectedClient?.configured) {
    return {
      checked: true,
      ok: true,
      warnings: [],
    };
  }

  return {
    checked: true,
    ok: false,
    warnings: [
      remoteUrl
        ? `${client} is not configured for remote MCP URL ${remoteUrl}.`
        : `${client} is not configured for ${repoRoot}.`,
    ],
  };
}

async function verifyRemoteConnection({
  mcpEntry,
  fetchImpl = globalThis.fetch,
  sessionToken = null,
} = {}) {
  const remoteUrl = extractMcpRemoteUrl(mcpEntry);
  if (!remoteUrl) {
    throw new Error("Remote MCP verification requires a configured server URL.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("Remote MCP verification requires fetch support.");
  }

  const baseHeaders = {
    "Content-Type": "application/json",
  };
  if (sessionToken) {
    baseHeaders.Authorization = `Bearer ${sessionToken}`;
  }

  const initializeResponse = await fetchJsonRpcResponse(fetchImpl, remoteUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "heart-connect-verify",
        version: "0.1.0",
      },
    },
  }, baseHeaders);

  if (initializeResponse.response.status === 401) {
    if (sessionToken) {
      return {
        discovery_status: "ok",
        auth_status: "failed",
        initialize_status: "failed",
        tools_list_status: "failed",
        warnings: ["Remote MCP rejected the supplied bearer session token."],
        status: "failed",
      };
    }

    const discovery = await verifyRemoteAuthDiscovery(fetchImpl, initializeResponse.response);
    return {
      discovery_status: discovery.ok ? "ok" : "failed",
      auth_status: discovery.ok ? "needs_auth" : "failed",
      initialize_status: "not_checked",
      tools_list_status: "not_checked",
      warnings: discovery.warnings,
      status: discovery.ok ? "partial" : "failed",
    };
  }

  if (!initializeResponse.response.ok) {
    throw new Error(
      `Remote initialize request failed with status ${initializeResponse.response.status}.`,
    );
  }

  const initializePayload = await readJsonResponseBody(initializeResponse.response);
  if (initializePayload?.error) {
    throw new Error(initializePayload.error.message ?? "Remote initialize failed.");
  }

  await fetchJsonRpcNotification(fetchImpl, remoteUrl, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }, baseHeaders);

  const toolsResponse = await fetchJsonRpcResponse(fetchImpl, remoteUrl, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }, baseHeaders);
  if (!toolsResponse.response.ok) {
    throw new Error(
      `Remote tools/list request failed with status ${toolsResponse.response.status}.`,
    );
  }
  const toolsPayload = await readJsonResponseBody(toolsResponse.response);
  if (toolsPayload?.error) {
    throw new Error(toolsPayload.error.message ?? "Remote tools/list failed.");
  }

  return {
    discovery_status: "ok",
    auth_status: sessionToken ? "ok" : "not_required",
    initialize_status: "ok",
    tools_list_status: "ok",
    warnings: [],
    status: "ready",
  };
}

async function verifyRemoteAuthDiscovery(fetchImpl, response) {
  const warnings = [];
  const resourceMetadataUrl = readResourceMetadataUrl(response);
  if (!resourceMetadataUrl) {
    warnings.push("Remote MCP denied the request without exposing OAuth resource metadata.");
    return { ok: false, warnings };
  }

  const metadataResponse = await fetchImpl(resourceMetadataUrl, {
    method: "GET",
  });
  if (!metadataResponse.ok) {
    warnings.push(`Remote MCP resource metadata request failed with ${metadataResponse.status}.`);
    return { ok: false, warnings };
  }

  const metadata = await readJsonResponseBody(metadataResponse);
  const authorizationServer = metadata?.authorization_servers?.[0];
  if (!authorizationServer) {
    warnings.push("Remote MCP resource metadata is missing authorization_servers.");
    return { ok: false, warnings };
  }

  const authMetadataUrl = new URL("/.well-known/oauth-authorization-server", authorizationServer).toString();
  const authMetadataResponse = await fetchImpl(authMetadataUrl, {
    method: "GET",
  });
  if (!authMetadataResponse.ok) {
    warnings.push(`Remote MCP authorization metadata request failed with ${authMetadataResponse.status}.`);
    return { ok: false, warnings };
  }

  await readJsonResponseBody(authMetadataResponse);
  warnings.push("Remote MCP requires OAuth login before initialize/tools/list can be verified.");
  return { ok: true, warnings };
}

export async function runConnectDoctor(options = {}) {
  const detectImpl = options.detectImpl ?? detectConnections;
  const repoRoot = options.repoRoot ?? process.cwd();
  const detection = await detectImpl({
    repoRoot,
    env: options.env,
    fetchImpl: options.fetchImpl,
    execFileImpl: options.execFileImpl,
    detectAgentsImpl: options.detectAgentsImpl,
    detectModelsImpl: options.detectModelsImpl,
  });
  const warnings = Array.isArray(detection?.warnings)
    ? [...detection.warnings]
    : [];

  return {
    repo_root: detection?.repo_root ?? repoRoot,
    agents: Array.isArray(detection?.agents) ? detection.agents : [],
    models: Array.isArray(detection?.models) ? detection.models : [],
    warnings,
    status: warnings.length === 0 ? "ready" : "partial",
  };
}

function normalizeArgs(args) {
  if (!Array.isArray(args)) {
    return [];
  }

  return args.map((arg) => String(arg));
}

function writeMessage(stdin, payload) {
  stdin.write(`${JSON.stringify(payload)}\n`);
}

async function fetchJsonRpcResponse(fetchImpl, remoteUrl, payload, headers) {
  const response = await withTimeout(
    fetchImpl(remoteUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }),
    "Timed out waiting for remote MCP response.",
  );

  return { response };
}

async function fetchJsonRpcNotification(fetchImpl, remoteUrl, payload, headers) {
  const response = await fetchJsonRpcResponse(fetchImpl, remoteUrl, payload, headers);
  if (!response.response.ok && response.response.status !== 202) {
    throw new Error(
      `Remote MCP notification failed with status ${response.response.status}.`,
    );
  }
}

async function readJsonResponseBody(response) {
  if (response.status === 202) {
    return null;
  }

  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  return JSON.parse(text);
}

function readResourceMetadataUrl(response) {
  const header = response.headers.get("www-authenticate");
  if (!header) {
    return null;
  }

  const match = header.match(/resource_metadata="([^"]+)"/i);
  return match?.[1] ?? null;
}

async function readResponse(stdoutIterator, expectedId) {
  while (true) {
    const result = await withTimeout(
      stdoutIterator.next(),
      `Timed out waiting for MCP response ${expectedId}.`,
    );

    if (result.done) {
      throw new Error("MCP server closed stdout before completing verification.");
    }

    const message = JSON.parse(result.value);
    if (Array.isArray(message)) {
      const nestedMatch = message.find((entry) => entry?.id === expectedId);
      if (nestedMatch) {
        return nestedMatch;
      }
      continue;
    }

    if (message?.id === expectedId) {
      return message;
    }
  }
}

async function stopChildProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const closedAfterTerm = await terminateChildProcess(child, "SIGTERM");
  if (closedAfterTerm) {
    return;
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const closedAfterKill = await terminateChildProcess(child, "SIGKILL");
  if (!closedAfterKill) {
    throw new Error("Timed out waiting for MCP verification process to exit.");
  }
}

async function terminateChildProcess(child, signal) {
  const closePromise = new Promise((resolve) => {
    child.once("close", resolve);
  });

  child.kill(signal);

  try {
    await withTimeout(
      closePromise,
      `Timed out waiting for MCP verification process to exit after ${signal}.`,
    );
    return true;
  } catch {
    return false;
  }
}

function withTimeout(promise, message) {
  let timeoutId;

  return Promise.race([
    promise.finally(() => {
      clearTimeout(timeoutId);
    }),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(message));
      }, HANDSHAKE_TIMEOUT_MS);
    }),
  ]);
}
