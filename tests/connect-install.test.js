import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";

import {
  buildInstallPlan,
  detectConnections,
} from "../packages/connect/src/index.js";
import { createConnectTestContext } from "./helpers/connect-test-context.js";

test("detectConnections marks Cursor as configured when .cursor/mcp.json contains heart-mcp", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const cursorConfigPath = path.join(repoRoot, ".cursor", "mcp.json");

  await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
  await fs.writeFile(
    cursorConfigPath,
    JSON.stringify(
      {
        mcpServers: {
          "heart-mcp": {
            command: "node",
            args: ["./bin/heart.js", "mcp", "serve", "--root", repoRoot],
          },
        },
      },
      null,
      2,
    ),
  );

  const result = await detectConnections({
    repoRoot,
    env,
    fetchImpl: async () => ({
      ok: false,
      async json() {
        return {};
      },
    }),
    execFileImpl: async () => ({ stdout: "", stderr: "" }),
  });

  const cursor = result.agents.find((agent) => agent.id === "cursor");

  assert.equal(cursor.configured, true);
  assert.equal(cursor.install_modes.includes("repo"), true);
});

test("buildInstallPlan returns a Continue repo-scope file plan", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const plan = await buildInstallPlan({
    client: "continue",
    scope: "repo",
    repoRoot,
    env,
  });

  assert.equal(plan.client, "continue");
  assert.equal(plan.scope, "repo");
  assert.match(
    plan.files_to_modify[0],
    /\.continue\/mcpServers\/heart-mcp\.json$/,
  );
});
