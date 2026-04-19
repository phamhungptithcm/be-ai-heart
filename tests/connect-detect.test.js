import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildInstallPlan,
  detectConnections,
  doctorConnections,
  installConnection,
  verifyConnection,
} from "../packages/connect/src/index.js";

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
    recommendations: ["heart connect install --client cursor --scope repo --root /tmp/demo-repo"],
  });
});

test("doctorConnections reports binary readiness and next actions", async () => {
  const result = await doctorConnections({
    repoRoot: "/tmp/demo-repo",
    binaryPath: "/tmp/demo-repo/packages/cli/bin/heart.js",
    detectAgentsImpl: async () => [],
    detectModelsImpl: async () => [],
  });

  assert.equal(result.repo_root, "/tmp/demo-repo");
  assert.equal(result.heart_binary.available, true);
  assert.equal(result.inventory.agents.length, 0);
  assert.ok(result.actions.length >= 1);
});

test("detectConnections includes Ollama and LM Studio runtimes when local endpoints respond", async () => {
  const fetchImpl = async (url) => {
    if (String(url) === "http://127.0.0.1:11434/api/tags") {
      return createJsonResponse({
        models: [{ name: "qwen3.5-coder:latest" }],
      });
    }

    if (String(url) === "http://127.0.0.1:11434/api/ps") {
      return createJsonResponse({
        models: [{ name: "qwen3.5-coder:latest" }],
      });
    }

    if (String(url) === "http://127.0.0.1:1234/v1/models") {
      return createJsonResponse({
        data: [{ id: "deepseek-coder-6.7b" }],
      });
    }

    throw new Error(`unexpected url: ${url}`);
  };

  const result = await detectConnections({
    repoRoot: "/tmp/demo-repo",
    detectAgentsImpl: async () => [],
    fetchImpl,
  });

  assert.deepEqual(
    result.models.map((model) => model.id),
    ["lm-studio", "ollama"],
  );
  assert.equal(result.models[0].running, true);
  assert.ok(result.recommendations.length >= 1);
});

test("buildInstallPlan returns a repo-scoped cursor plan with MCP entry", async (t) => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-connect-plan-"));
  t.after(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true });
  });

  const plan = await buildInstallPlan({
    client: "cursor",
    scope: "repo",
    repoRoot,
  });

  assert.equal(plan.client, "cursor");
  assert.equal(plan.scope, "repo");
  assert.equal(plan.config_path, path.join(repoRoot, ".cursor", "mcp.json"));
  assert.equal(plan.mcp_entry.command, "node");
  assert.deepEqual(plan.mcp_entry.args.slice(-2), ["--root", repoRoot]);
});

test("installConnection writes config and verifyConnection completes a real MCP handshake", async (t) => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-connect-install-"));
  const homeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-connect-home-"));

  t.after(async () => {
    await fs.rm(repoRoot, { recursive: true, force: true });
    await fs.rm(homeRoot, { recursive: true, force: true });
  });

  const installResult = await installConnection({
    client: "cursor",
    scope: "repo",
    repoRoot,
    env: {
      ...process.env,
      HOME: homeRoot,
      USERPROFILE: homeRoot,
    },
  });

  assert.equal(installResult.status, "ready");
  assert.equal(installResult.verification.status, "ready");

  const configPath = path.join(repoRoot, ".cursor", "mcp.json");
  const raw = await fs.readFile(configPath, "utf8");
  const config = JSON.parse(raw);
  assert.ok(config.mcpServers?.["heart-mcp"]);

  const verification = await verifyConnection({
    client: "cursor",
    repoRoot,
    env: {
      ...process.env,
      HOME: homeRoot,
      USERPROFILE: homeRoot,
    },
  });

  assert.equal(verification.status, "ready");
  assert.equal(verification.tools_list_status, "ready");
});

function createJsonResponse(payload) {
  return {
    ok: true,
    async json() {
      return payload;
    },
  };
}
