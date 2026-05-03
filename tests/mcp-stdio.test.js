import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");

test("MCP stdio server completes initialize, list, and call flow", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  await fs.rm(path.join(fixtureRoot, "heart.config.yaml"), { force: true });
  const child = spawn("node", [cliPath, "mcp", "serve", "--root", fixtureRoot], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const output = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  });
  t.after(() => {
    output.close();
    child.kill();
  });

  const iterator = output[Symbol.asyncIterator]();
  const nextMessage = async () => {
    const result = await iterator.next();
    if (result.done) {
      throw new Error("MCP server closed stdout before sending the expected response.");
    }

    return JSON.parse(result.value);
  };

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "heart-test-client",
          version: "0.1.0",
        },
      },
    })}\n`,
  );

  const initializeResponse = await nextMessage();
  assert.equal(initializeResponse.result.protocolVersion, "2025-06-18");

  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);

  const toolsResponse = await nextMessage();
  assert.equal(toolsResponse.result.tools.length, 8);
  assert.equal(toolsResponse.result.tools[3].name, "context_pack");

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "context_pack",
        arguments: {
          task: "improve login audit flow",
        },
      },
    })}\n`,
  );

  const callResponse = await nextMessage();
  assert.equal(callResponse.result.isError, false);
  assert.equal(callResponse.result.structuredContent.task, "improve login audit flow");
  assert.ok(callResponse.result.structuredContent.relevant_symbols.length >= 1);

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "project_overview",
        arguments: {},
      },
    })}\n`,
  );

  const overviewResponse = await nextMessage();
  assert.equal(overviewResponse.result.isError, false);
  assert.equal(overviewResponse.result.structuredContent.readiness.schema_version, 1);
  assert.equal(overviewResponse.result.structuredContent.readiness.config_status, "missing");
  assert.equal(overviewResponse.result.structuredContent.readiness.generated_noise_exclusion.status, "ready");

  output.close();
  child.kill();
});

test("MCP stdio server enforces mcp.enabled_tools for list and call", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  await fs.writeFile(
    path.join(fixtureRoot, "heart.config.yaml"),
    `mcp:
  enabled_tools:
    - project_overview
    - context_pack
`,
    "utf8",
  );

  const child = spawn("node", [cliPath, "mcp", "serve", "--root", fixtureRoot], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const output = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  });
  t.after(() => {
    output.close();
    child.kill();
  });
  const iterator = output[Symbol.asyncIterator]();
  const nextMessage = async () => {
    const result = await iterator.next();
    if (result.done) {
      throw new Error("MCP server closed stdout before sending the expected response.");
    }

    return JSON.parse(result.value);
  };

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "heart-test-client",
          version: "0.1.0",
        },
      },
    })}\n`,
  );
  await nextMessage();

  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);

  const toolsResponse = await nextMessage();
  assert.deepEqual(
    toolsResponse.result.tools.map((tool) => tool.name),
    ["project_overview", "context_pack"],
  );

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "dependency_explain",
        arguments: {
          target: "src/auth/login.ts",
        },
      },
    })}\n`,
  );

  const callResponse = await nextMessage();
  assert.equal(callResponse.error.code, -32000);
  assert.match(callResponse.error.message, /disabled by mcp.enabled_tools/);

  output.close();
  child.kill();
});
