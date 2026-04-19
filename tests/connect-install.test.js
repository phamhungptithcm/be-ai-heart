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

const workspaceCliPath = path.resolve("packages/cli/bin/heart.js");

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

test("detectConnections marks Cursor as configured when .cursor/mcp.json contains a remote heart-mcp URL", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const cursorConfigPath = path.join(repoRoot, ".cursor", "mcp.json");

  await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
  await fs.writeFile(
    cursorConfigPath,
    JSON.stringify(
      {
        mcpServers: {
          "heart-mcp": {
            url: "https://beheart.example.com/api/mcp",
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
});

test("detectConnections marks Codex as configured when codex mcp list returns a matching heart-mcp entry", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const result = await detectConnections({
    repoRoot,
    env,
    fetchImpl: async () => ({
      ok: false,
      async json() {
        return {};
      },
    }),
    execFileImpl: async (command) => {
      if (command === "codex") {
        return {
          stdout: JSON.stringify([
            {
              name: "heart-mcp",
              enabled: true,
              transport: {
                type: "stdio",
                command: "node",
                args: ["./bin/heart.js", "mcp", "serve", "--root", repoRoot],
              },
            },
          ]),
          stderr: "",
        };
      }

      return { stdout: "", stderr: "" };
    },
  });

  const codex = result.agents.find((agent) => agent.id === "codex");

  assert.equal(codex.configured, true);
  assert.equal(codex.install_modes.includes("user"), true);
});

test("detectConnections marks VS Code as configured when .vscode/mcp.json contains heart-mcp", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const vscodeConfigPath = path.join(repoRoot, ".vscode", "mcp.json");

  await fs.mkdir(path.dirname(vscodeConfigPath), { recursive: true });
  await fs.writeFile(
    vscodeConfigPath,
    JSON.stringify(
      {
        servers: {
          "heart-mcp": {
            type: "stdio",
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

  const vscode = result.agents.find((agent) => agent.id === "vscode");

  assert.equal(vscode.configured, true);
  assert.equal(vscode.install_modes.includes("repo"), true);
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

test("buildInstallPlan points generated MCP entries at the current workspace CLI", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const expectedRepoCliPath = path.resolve(repoRoot, "packages/cli/bin/heart.js");
  const plans = await Promise.all([
    buildInstallPlan({
      client: "cursor",
      scope: "repo",
      repoRoot,
      env,
    }),
    buildInstallPlan({
      client: "claude-code",
      scope: "repo",
      repoRoot,
      env,
    }),
    buildInstallPlan({
      client: "continue",
      scope: "repo",
      repoRoot,
      env,
    }),
  ]);

  const cliArgs = [
    plans[0].mcp_entry.args,
    plans[1].mcp_entry.args,
    plans[2].mcp_entry.mcpServers[0].args,
  ];

  for (const args of cliArgs) {
    assert.equal(path.isAbsolute(args[0]), true);
    assert.equal(args[0], workspaceCliPath);
    assert.notEqual(args[0], expectedRepoCliPath);
  }
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

test("buildInstallPlan returns a Codex user-scope exec plan", async (t) => {
  const { repoRoot, env, homeRoot } = await createConnectTestContext(t);

  const plan = await buildInstallPlan({
    client: "codex",
    scope: "user",
    repoRoot,
    env,
  });

  assert.equal(plan.client, "codex");
  assert.equal(plan.scope, "user");
  assert.equal(plan.target_file, path.join(homeRoot, ".codex", "config.toml"));
  assert.deepEqual(plan.exec.args.slice(0, 3), ["mcp", "add", "heart-mcp"]);
});

test("buildInstallPlan returns a remote Codex user-scope exec plan", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const plan = await buildInstallPlan({
    client: "codex",
    scope: "user",
    repoRoot,
    env,
    remoteUrl: "https://beheart.example.com/api/mcp",
  });

  assert.equal(plan.mcp_entry.type, "http");
  assert.equal(plan.mcp_entry.url, "https://beheart.example.com/api/mcp");
  assert.deepEqual(plan.exec.args, [
    "mcp",
    "add",
    "heart-mcp",
    "--url",
    "https://beheart.example.com/api/mcp",
  ]);
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

test("buildInstallPlan returns a remote Continue repo-scope file plan", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const plan = await buildInstallPlan({
    client: "continue",
    scope: "repo",
    repoRoot,
    env,
    remoteUrl: "https://beheart.example.com/api/mcp",
  });

  assert.equal(plan.mcp_entry.mcpServers[0].type, "streamable-http");
  assert.equal(plan.mcp_entry.mcpServers[0].url, "https://beheart.example.com/api/mcp");
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

test("installConnection writes Cursor repo remote config", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const result = await installConnection({
    client: "cursor",
    scope: "repo",
    repoRoot,
    env,
    remoteUrl: "https://beheart.example.com/api/mcp",
    verifyImpl: async () => ({ status: "partial", warnings: [] }),
  });

  const payload = JSON.parse(
    await fs.readFile(path.join(repoRoot, ".cursor", "mcp.json"), "utf8"),
  );

  assert.equal(payload.mcpServers["heart-mcp"].url, "https://beheart.example.com/api/mcp");
  assert.equal(result.status, "partial");
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

test("installConnection shells out to Codex CLI for a remote MCP URL", async () => {
  const execFileCalls = [];

  await installConnection({
    client: "codex",
    scope: "user",
    repoRoot: "/tmp/repo",
    remoteUrl: "https://beheart.example.com/api/mcp",
    env: {
      HOME: "/tmp/home",
      USERPROFILE: "/tmp/home",
    },
    execFileImpl: async (command, args) => {
      execFileCalls.push({ command, args });
      return { stdout: "", stderr: "" };
    },
    verifyImpl: async () => ({ status: "partial", warnings: [] }),
  });

  assert.equal(execFileCalls[0].command, "codex");
  assert.deepEqual(execFileCalls[0].args, [
    "mcp",
    "add",
    "heart-mcp",
    "--url",
    "https://beheart.example.com/api/mcp",
  ]);
});

test("installConnection shells out to Codex CLI", async (t) => {
  const execFileCalls = [];

  await installConnection({
    client: "codex",
    scope: "user",
    repoRoot: "/tmp/repo",
    env: {
      HOME: "/tmp/home",
      USERPROFILE: "/tmp/home",
    },
    execFileImpl: async (command, args) => {
      execFileCalls.push({ command, args });
      return { stdout: "", stderr: "" };
    },
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  assert.equal(execFileCalls[0].command, "codex");
  assert.deepEqual(execFileCalls[0].args.slice(0, 3), ["mcp", "add", "heart-mcp"]);
});

test("installConnection writes Windsurf user config", async (t) => {
  const { repoRoot, env, homeRoot } = await createConnectTestContext(t);

  const result = await installConnection({
    client: "windsurf",
    scope: "user",
    repoRoot,
    env,
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  const payload = JSON.parse(
    await fs.readFile(path.join(homeRoot, ".codeium", "windsurf", "mcp_config.json"), "utf8"),
  );

  assert.equal(payload.mcpServers["heart-mcp"].args.includes("--root"), true);
  assert.equal(result.status, "ready");
});

test("installConnection writes Cline user config", async (t) => {
  const { repoRoot, env, homeRoot } = await createConnectTestContext(t);

  const result = await installConnection({
    client: "cline",
    scope: "user",
    repoRoot,
    env,
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  const payload = JSON.parse(
    await fs.readFile(path.join(homeRoot, ".cline", "data", "settings", "cline_mcp_settings.json"), "utf8"),
  );

  assert.equal(payload.mcpServers["heart-mcp"].disabled, false);
  assert.equal(payload.mcpServers["heart-mcp"].args.includes("--root"), true);
  assert.equal(result.status, "ready");
});

test("installConnection writes GitHub Copilot CLI user config", async (t) => {
  const { repoRoot, env, homeRoot } = await createConnectTestContext(t);

  const result = await installConnection({
    client: "copilot-cli",
    scope: "user",
    repoRoot,
    env,
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  const payload = JSON.parse(
    await fs.readFile(path.join(homeRoot, ".copilot", "mcp-config.json"), "utf8"),
  );

  assert.equal(payload.mcpServers["heart-mcp"].type, "local");
  assert.deepEqual(payload.mcpServers["heart-mcp"].tools, ["*"]);
  assert.equal(result.status, "ready");
});

test("installConnection writes VS Code repo config", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const result = await installConnection({
    client: "vscode",
    scope: "repo",
    repoRoot,
    env,
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  const payload = JSON.parse(
    await fs.readFile(path.join(repoRoot, ".vscode", "mcp.json"), "utf8"),
  );

  assert.equal(payload.servers["heart-mcp"].type, "stdio");
  assert.equal(payload.servers["heart-mcp"].args.includes("--root"), true);
  assert.equal(result.status, "ready");
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

test("buildInstallPlan resolves Continue managed model names from detected runtime inventories", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const plan = await buildInstallPlan({
    client: "continue",
    scope: "user",
    repoRoot,
    env,
    modelRuntime: "ollama",
    detectedModelsByRuntime: {
      ollama: ["deepseek-coder:6.7b", "qwen3.5-coder:latest"],
    },
  });

  assert.equal(plan.model_binding, "ollama");
  assert.equal(plan.resolved_model_name, "deepseek-coder:6.7b");
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

test("installConnection rolls back Cursor config when verification fails", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const cursorConfigPath = path.join(repoRoot, ".cursor", "mcp.json");
  const originalConfig = JSON.stringify(
    {
      mcpServers: {
        existing: {
          command: "node",
          args: ["--version"],
        },
      },
    },
    null,
    2,
  );

  await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
  await fs.writeFile(cursorConfigPath, originalConfig, "utf8");

  const result = await installConnection({
    client: "cursor",
    scope: "repo",
    repoRoot,
    env,
    verifyImpl: async () => ({
      status: "failed",
      warnings: ["host config mismatch"],
    }),
  });

  assert.equal(result.status, "failed");
  assert.equal(await fs.readFile(cursorConfigPath, "utf8"), originalConfig);
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
