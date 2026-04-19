import { spawn } from "node:child_process";
import readline from "node:readline";

import { detectConnections } from "./detect.js";

const HANDSHAKE_TIMEOUT_MS = 5_000;
const PROTOCOL_VERSION = "2025-06-18";

export async function verifyConnection({ client, repoRoot, plan, spawnImpl = spawn } = {}) {
  const report = {
    client,
    repo_root: repoRoot,
    config_status: "ok",
    spawn_status: "ok",
    initialize_status: "failed",
    tools_list_status: "failed",
    model_runtime_status: "not_checked",
    warnings: [],
    status: "failed",
  };

  const mcpEntry = plan?.mcp_entry ?? {};
  const stderrChunks = [];

  try {
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

  return report;
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
