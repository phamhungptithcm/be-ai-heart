import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

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

test("runConnectDoctor reports partial status when detection returns warnings", async () => {
  const result = await runConnectDoctor({
    repoRoot: "/tmp/doctor-repo",
    detectImpl: async () => ({
      repo_root: "/tmp/doctor-repo",
      agents: [{ id: "cursor" }],
      models: [],
      warnings: ["Cursor config missing heart-mcp entry."],
    }),
  });

  assert.equal(result.status, "partial");
  assert.deepEqual(result.warnings, [
    "Cursor config missing heart-mcp entry.",
  ]);
});
