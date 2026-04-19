import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";

import {
  runConnectDoctor,
  verifyConnection,
} from "../packages/connect/src/index.js";
import { createConnectTestContext } from "./helpers/connect-test-context.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");
const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

async function createTempRepoCopy(t) {
  const { repoRoot } = await createConnectTestContext(t);
  await fs.cp(fixtureRoot, repoRoot, { recursive: true });
  return repoRoot;
}

function createFakeMcpChild({ closeOnSigterm = false } = {}) {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.killed = false;
  child.killSignals = [];
  child.closed = false;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();

  let stdinBuffer = "";
  child.stdin = new Writable({
    write(chunk, encoding, callback) {
      stdinBuffer += Buffer.isBuffer(chunk) ? chunk.toString() : chunk.toString(encoding);
      let newlineIndex = stdinBuffer.indexOf("\n");

      while (newlineIndex !== -1) {
        const line = stdinBuffer.slice(0, newlineIndex);
        stdinBuffer = stdinBuffer.slice(newlineIndex + 1);

        if (line.length > 0) {
          const message = JSON.parse(line);
          if (message.method === "initialize") {
            child.stdout.write(
              `${JSON.stringify({
                jsonrpc: "2.0",
                id: message.id,
                result: {
                  protocolVersion: "2025-06-18",
                  capabilities: {},
                },
              })}\n`,
            );
          } else if (message.method === "tools/list") {
            child.stdout.write(
              `${JSON.stringify({
                jsonrpc: "2.0",
                id: message.id,
                result: { tools: [] },
              })}\n`,
            );
          }
        }

        newlineIndex = stdinBuffer.indexOf("\n");
      }

      callback();
    },
  });

  child.kill = (signal = "SIGTERM") => {
    child.killSignals.push(signal);
    child.killed = true;

    if (signal === "SIGTERM" && !closeOnSigterm) {
      return true;
    }

    queueMicrotask(() => {
      child.exitCode = signal === "SIGTERM" ? 0 : null;
      child.signalCode = signal === "SIGTERM" ? null : signal;
      child.closed = true;
      child.emit("close", child.exitCode, child.signalCode);
    });

    return true;
  };

  return child;
}

test("verifyConnection performs the stdio MCP handshake", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const plan = {
    mcp_entry: {
      command: "node",
      args: [cliPath, "mcp", "serve", "--root", repoRoot],
    },
  };

  const result = await verifyConnection({ client: "cursor", repoRoot, plan });

  assert.equal(result.status, "ready");
  assert.equal(result.initialize_status, "ok");
  assert.equal(result.tools_list_status, "ok");
});

test("runConnectDoctor forwards repo-root-aware detect options and reports partial status when detection returns warnings", async () => {
  const env = {
    HOME: "/tmp/doctor-home",
    USERPROFILE: "/tmp/doctor-home",
  };
  const fetchImpl = async () => ({ ok: true, async json() { return {}; } });
  const execFileImpl = async () => ({ stdout: "", stderr: "" });
  const detectAgentsImpl = async () => [];
  const detectModelsImpl = async () => [];
  const detectCalls = [];

  const result = await runConnectDoctor({
    repoRoot: "/tmp/doctor-repo",
    env,
    fetchImpl,
    execFileImpl,
    detectAgentsImpl,
    detectModelsImpl,
    detectImpl: async (options) => {
      detectCalls.push(options);
      return {
        repo_root: options.repoRoot,
        agents: [{ id: "cursor" }],
        models: [],
        warnings: ["Cursor config missing heart-mcp entry."],
      };
    },
  });

  assert.deepEqual(detectCalls, [
    {
      repoRoot: "/tmp/doctor-repo",
      env,
      fetchImpl,
      execFileImpl,
      detectAgentsImpl,
      detectModelsImpl,
    },
  ]);
  assert.equal(result.repo_root, "/tmp/doctor-repo");
  assert.equal(result.status, "partial");
  assert.deepEqual(result.warnings, [
    "Cursor config missing heart-mcp entry.",
  ]);
});

test("verifyConnection escalates to SIGKILL when the child ignores SIGTERM", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const fakeChild = createFakeMcpChild();
  const plan = {
    mcp_entry: {
      command: "node",
      args: [cliPath, "mcp", "serve", "--root", repoRoot],
    },
  };

  const result = await verifyConnection({
    client: "cursor",
    repoRoot,
    plan,
    spawnImpl: () => fakeChild,
  });

  assert.equal(result.status, "ready");
  assert.deepEqual(fakeChild.killSignals, ["SIGTERM", "SIGKILL"]);
  assert.equal(fakeChild.closed, true);
});

test("verifyConnection reports ready when a child exits after SIGTERM", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const fakeChild = createFakeMcpChild({ closeOnSigterm: true });
  const plan = {
    mcp_entry: {
      command: "node",
      args: [cliPath, "mcp", "serve", "--root", repoRoot],
    },
  };

  const result = await verifyConnection({
    client: "cursor",
    repoRoot,
    plan,
    spawnImpl: () => fakeChild,
  });

  assert.equal(result.status, "ready");
  assert.deepEqual(fakeChild.killSignals, ["SIGTERM"]);
  assert.equal(fakeChild.closed, true);
});
