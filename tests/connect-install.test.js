import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";

import {
  buildInstallPlan,
  detectConnections,
  installConnection,
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

test("buildInstallPlan uses an absolute CLI path in generated MCP entries", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const cursorPlan = await buildInstallPlan({
    client: "cursor",
    scope: "repo",
    repoRoot,
    env,
  });

  assert.equal(path.isAbsolute(cursorPlan.mcp_entry.args[0]), true);
  assert.equal(
    cursorPlan.mcp_entry.args[0],
    path.resolve(repoRoot, "packages/cli/bin/heart.js"),
  );
});

test("buildInstallPlan maps Claude Code repo scope to project scope and correct config locations", async (t) => {
  const { repoRoot, env, homeRoot } = await createConnectTestContext(t);

  const plan = await buildInstallPlan({
    client: "claude-code",
    scope: "repo",
    repoRoot,
    env,
  });

  assert.equal(plan.client, "claude-code");
  assert.equal(plan.scope, "repo");
  assert.deepEqual(plan.args.slice(-2), ["--scope", "project"]);
  assert.equal(plan.config_locations.repo, path.join(repoRoot, ".mcp.json"));
  assert.equal(plan.config_locations.user, path.join(homeRoot, ".claude.json"));
});

test("buildInstallPlan warns when model binding is unsupported for Cursor", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const plan = await buildInstallPlan({
    client: "cursor",
    scope: "repo",
    repoRoot,
    env,
    modelRuntime: "ollama:qwen3",
  });

  assert.equal(plan.model_binding, null);
  assert.match(plan.warnings[0], /ignored/i);
});

test("buildInstallPlan warns when model binding is unsupported for Claude Code", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const plan = await buildInstallPlan({
    client: "claude-code",
    scope: "user",
    repoRoot,
    env,
    modelRuntime: "ollama:qwen3",
  });

  assert.equal(plan.model_binding, null);
  assert.match(plan.warnings[0], /ignored/i);
});

test("installConnection writes Cursor repo config", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const result = await installConnection({
    client: "cursor",
    scope: "repo",
    repoRoot,
    env,
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  const payload = JSON.parse(
    await fs.readFile(path.join(repoRoot, ".cursor", "mcp.json"), "utf8"),
  );

  assert.equal(payload.mcpServers["heart-mcp"].args.includes("--root"), true);
  assert.equal(result.status, "ready");
});

test("installConnection shells out to Claude Code CLI", async (t) => {
  const { repoRoot } = await createConnectTestContext(t);
  const execFileCalls = [];

  await installConnection({
    client: "claude-code",
    scope: "repo",
    repoRoot: "/tmp/repo",
    execFileImpl: async (command, args) => {
      execFileCalls.push({ command, args });
      return { stdout: "", stderr: "" };
    },
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  assert.equal(execFileCalls[0].command, "claude");
  assert.deepEqual(execFileCalls[0].args.slice(0, 2), ["mcp", "add-json"]);
});

test("installConnection creates a managed Continue config for Ollama only when the user config is absent", async (t) => {
  const { repoRoot, env, homeRoot } = await createConnectTestContext(t);

  const result = await installConnection({
    client: "continue",
    scope: "user",
    repoRoot,
    env,
    model: "ollama",
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  const configText = await fs.readFile(
    path.join(homeRoot, ".continue", "config.yaml"),
    "utf8",
  );

  assert.match(configText, /provider: ollama/);
  assert.match(configText, /model: qwen3.5-coder:latest/);
  assert.equal(result.status, "ready");
});

test("installConnection fails deterministically and preserves malformed existing Cursor config", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const cursorConfigPath = path.join(repoRoot, ".cursor", "mcp.json");
  const malformedConfig = "{ invalid json";

  await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
  await fs.writeFile(cursorConfigPath, malformedConfig);

  await assert.rejects(
    installConnection({
      client: "cursor",
      scope: "repo",
      repoRoot,
      env,
      verifyImpl: async () => ({ status: "ready", warnings: [] }),
    }),
    /existing Cursor config.*invalid json/i,
  );

  assert.equal(await fs.readFile(cursorConfigPath, "utf8"), malformedConfig);
});

test("buildInstallPlan does not claim unmanaged Continue config.yaml will be modified", async (t) => {
  const { repoRoot, env, homeRoot } = await createConnectTestContext(t);
  const continueConfigPath = path.join(homeRoot, ".continue", "config.yaml");

  await fs.mkdir(path.dirname(continueConfigPath), { recursive: true });
  await fs.writeFile(continueConfigPath, "name: User Config\nmodels: []\n");

  const plan = await buildInstallPlan({
    client: "continue",
    scope: "user",
    repoRoot,
    env,
    modelRuntime: "ollama",
  });

  assert.equal(plan.files_to_modify.includes(continueConfigPath), false);
  assert.equal(plan.files_to_backup.includes(continueConfigPath), false);
  assert.match(plan.warnings.at(-1), /not BeHeart-managed/i);
});

test("installConnection preserves header-prefixed Continue config with user edits", async (t) => {
  const { repoRoot, env, homeRoot } = await createConnectTestContext(t);
  const continueConfigPath = path.join(homeRoot, ".continue", "config.yaml");
  const existingConfig = [
    "name: BeHeart Local Config",
    "version: 1",
    "models:",
    "  - name: qwen3.5-coder:latest",
    "    provider: ollama",
    "    model: qwen3.5-coder:latest",
    "extra: keep-me",
    "",
  ].join("\n");

  await fs.mkdir(path.dirname(continueConfigPath), { recursive: true });
  await fs.writeFile(continueConfigPath, existingConfig);

  const result = await installConnection({
    client: "continue",
    scope: "user",
    repoRoot,
    env,
    model: "ollama",
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  assert.equal(await fs.readFile(continueConfigPath, "utf8"), existingConfig);
  assert.match(
    result.warnings.join("\n"),
    /user edits|skipping managed model config/i,
  );
});

test("installConnection fails deterministically for user scope without a home path", async (t) => {
  const { repoRoot } = await createConnectTestContext(t);

  await assert.rejects(
    installConnection({
      client: "continue",
      scope: "user",
      repoRoot,
      env: {},
      model: "ollama",
      verifyImpl: async () => ({ status: "ready", warnings: [] }),
    }),
    /home path.*HOME.*USERPROFILE/i,
  );
});
