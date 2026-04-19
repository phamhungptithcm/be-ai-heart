import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");

test("MCP stdio server completes initialize, list, and call flow", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const child = spawn("node", [cliPath, "mcp", "serve", "--root", fixtureRoot], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const output = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
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
  assert.equal(toolsResponse.result.tools.length, 7);
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

  output.close();
  child.kill();
});
