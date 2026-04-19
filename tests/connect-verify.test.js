import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";

import {
  buildInstallPlan,
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

function createJsonResponse(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
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

test("runConnectDoctor defaults repoRoot to cwd when omitted", async () => {
  const cwd = process.cwd();
  const detectCalls = [];

  const result = await runConnectDoctor({
    detectImpl: async (options) => {
      detectCalls.push(options);
      return {
        repo_root: options.repoRoot,
        agents: [],
        models: [],
        warnings: [],
      };
    },
  });

  assert.deepEqual(detectCalls, [
    {
      repoRoot: cwd,
      env: undefined,
      fetchImpl: undefined,
      execFileImpl: undefined,
      detectAgentsImpl: undefined,
      detectModelsImpl: undefined,
    },
  ]);
  assert.equal(result.repo_root, cwd);
  assert.equal(result.status, "ready");
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

test("verifyConnection fails host-aware validation when the configured client entry is missing", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  await fs.cp(fixtureRoot, repoRoot, { recursive: true });
  const fakeChild = createFakeMcpChild({ closeOnSigterm: true });
  const plan = await buildInstallPlan({
    client: "cursor",
    scope: "repo",
    repoRoot,
    env,
  });

  const result = await verifyConnection({
    client: "cursor",
    repoRoot,
    plan,
    env,
    spawnImpl: () => fakeChild,
  });

  assert.equal(result.initialize_status, "ok");
  assert.equal(result.tools_list_status, "ok");
  assert.equal(result.config_status, "failed");
  assert.equal(result.status, "failed");
  assert.ok(result.warnings.some((warning) => /not configured/i.test(warning)));
});

test("verifyConnection reports partial for remote MCP when OAuth discovery is available but no session token is provided", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const remoteUrl = "https://beheart.example.com/api/mcp";
  const metadataUrl = "https://beheart.example.com/.well-known/oauth-protected-resource";
  const cursorConfigPath = path.join(repoRoot, ".cursor", "mcp.json");

  await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
  await fs.writeFile(
    cursorConfigPath,
    JSON.stringify(
      {
        mcpServers: {
          "heart-mcp": {
            url: remoteUrl,
          },
        },
      },
      null,
      2,
    ),
  );

  const result = await verifyConnection({
    client: "cursor",
    repoRoot,
    env,
    plan: {
      config_locations: {
        repo: cursorConfigPath,
      },
      mcp_entry: {
        url: remoteUrl,
      },
    },
    fetchImpl: async (url, options = {}) => {
      if (url === remoteUrl) {
        return createJsonResponse(
          401,
          { error: "Unauthenticated request." },
          {
            "WWW-Authenticate": `Bearer realm="be-ai-heart-mcp", resource_metadata="${metadataUrl}"`,
          },
        );
      }

      if (url === metadataUrl) {
        return createJsonResponse(200, {
          resource: remoteUrl,
          authorization_servers: ["https://beheart.example.com"],
        });
      }

      if (url === "https://beheart.example.com/.well-known/oauth-authorization-server") {
        return createJsonResponse(200, {
          issuer: "https://beheart.example.com",
          authorization_endpoint: "https://beheart.example.com/oauth/authorize",
          token_endpoint: "https://beheart.example.com/oauth/token",
        });
      }

      throw new Error(`Unexpected fetch: ${url} ${options.method ?? "GET"}`);
    },
  });

  assert.equal(result.transport, "remote");
  assert.equal(result.status, "partial");
  assert.equal(result.config_status, "ok");
  assert.equal(result.discovery_status, "ok");
  assert.equal(result.auth_status, "needs_auth");
  assert.equal(result.initialize_status, "not_checked");
  assert.equal(result.tools_list_status, "not_checked");
});

test("verifyConnection performs remote initialize and tools/list when a session token is supplied", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const remoteUrl = "https://beheart.example.com/api/mcp";
  const cursorConfigPath = path.join(repoRoot, ".cursor", "mcp.json");
  const seenAuthHeaders = [];

  await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
  await fs.writeFile(
    cursorConfigPath,
    JSON.stringify(
      {
        mcpServers: {
          "heart-mcp": {
            url: remoteUrl,
          },
        },
      },
      null,
      2,
    ),
  );

  const result = await verifyConnection({
    client: "cursor",
    repoRoot,
    env,
    sessionToken: "session-token",
    plan: {
      config_locations: {
        repo: cursorConfigPath,
      },
      mcp_entry: {
        url: remoteUrl,
      },
    },
    fetchImpl: async (url, options = {}) => {
      seenAuthHeaders.push(options.headers?.Authorization ?? null);
      const payload = JSON.parse(options.body);

      if (url !== remoteUrl) {
        throw new Error(`Unexpected fetch URL: ${url}`);
      }

      if (payload.method === "initialize") {
        return createJsonResponse(200, {
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: {},
          },
        });
      }

      if (payload.method === "notifications/initialized") {
        return new Response(null, { status: 202 });
      }

      if (payload.method === "tools/list") {
        return createJsonResponse(200, {
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            tools: [],
          },
        });
      }

      throw new Error(`Unexpected remote MCP method: ${payload.method}`);
    },
  });

  assert.equal(result.transport, "remote");
  assert.equal(result.status, "ready");
  assert.equal(result.config_status, "ok");
  assert.equal(result.discovery_status, "ok");
  assert.equal(result.auth_status, "ok");
  assert.equal(result.initialize_status, "ok");
  assert.equal(result.tools_list_status, "ok");
  assert.deepEqual(seenAuthHeaders, [
    "Bearer session-token",
    "Bearer session-token",
    "Bearer session-token",
  ]);
});

test("verifyConnection fails remote validation when the configured client entry is missing", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const remoteUrl = "https://beheart.example.com/api/mcp";

  const result = await verifyConnection({
    client: "cursor",
    repoRoot,
    env,
    sessionToken: "session-token",
    plan: {
      config_locations: {
        repo: path.join(repoRoot, ".cursor", "mcp.json"),
      },
      mcp_entry: {
        url: remoteUrl,
      },
    },
    fetchImpl: async (_url, options = {}) => {
      const payload = JSON.parse(options.body);

      if (payload.method === "initialize") {
        return createJsonResponse(200, {
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: {},
          },
        });
      }

      if (payload.method === "notifications/initialized") {
        return new Response(null, { status: 202 });
      }

      return createJsonResponse(200, {
        jsonrpc: "2.0",
        id: payload.id,
        result: {
          tools: [],
        },
      });
    },
  });

  assert.equal(result.config_status, "failed");
  assert.equal(result.status, "failed");
  assert.ok(result.warnings.some((warning) => /remote MCP URL/i.test(warning)));
});
