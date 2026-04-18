import test from "node:test";
import assert from "node:assert/strict";

import { detectConnections } from "../packages/connect/src/index.js";

test("detectConnections returns a stable empty inventory when nothing is detected", async () => {
  const result = await detectConnections({
    repoRoot: "/tmp/demo-repo",
    detectAgentsImpl: async () => [],
    detectModelsImpl: async () => [],
  });

  assert.deepEqual(result, {
    repo_root: "/tmp/demo-repo",
    agents: [],
    models: [],
    warnings: [],
    recommendations: [],
  });
});

test("detectConnections normalizes falsey and malformed detector output to empty arrays", async () => {
  const result = await detectConnections({
    repoRoot: "/tmp/demo-repo",
    detectAgentsImpl: async () => undefined,
    detectModelsImpl: async () => ({ detected: true }),
  });

  assert.deepEqual(result, {
    repo_root: "/tmp/demo-repo",
    agents: [],
    models: [],
    warnings: [],
    recommendations: [],
  });
});
