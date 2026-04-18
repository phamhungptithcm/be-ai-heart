import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";

import { detectConnections } from "../packages/connect/src/index.js";
import { createConnectTestContext } from "./helpers/connect-test-context.js";

function jsonResponse(payload, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    },
  };
}

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

test("detectConnections includes Ollama models and running status", async () => {
  const fetchImpl = async (url) => {
    if (url === "http://127.0.0.1:11434/api/tags") {
      return jsonResponse({
        models: [
          {
            name: "qwen3.5-coder:latest",
            model: "qwen3.5-coder:latest",
          },
        ],
      });
    }

    if (url === "http://127.0.0.1:11434/api/ps") {
      return jsonResponse({
        models: [
          {
            name: "qwen3.5-coder:latest",
            model: "qwen3.5-coder:latest",
          },
        ],
      });
    }

    throw new Error(`unexpected url: ${url}`);
  };

  const result = await detectConnections({
    repoRoot: "/tmp/demo-repo",
    fetchImpl,
    detectAgentsImpl: async () => [],
  });

  assert.equal(result.models[0].id, "ollama");
  assert.equal(result.models[0].running, true);
  assert.deepEqual(result.models[0].models_detected, [
    "qwen3.5-coder:latest",
  ]);
});

test("detectConnections keeps Ollama running when ps probing fails", async () => {
  const fetchImpl = async (url) => {
    if (url === "http://127.0.0.1:11434/api/tags") {
      return jsonResponse({
        models: [
          {
            name: "qwen3.5-coder:latest",
            model: "qwen3.5-coder:latest",
          },
        ],
      });
    }

    if (url === "http://127.0.0.1:11434/api/ps") {
      throw new Error("ps unavailable");
    }

    throw new Error(`unexpected url: ${url}`);
  };

  const result = await detectConnections({
    repoRoot: "/tmp/demo-repo",
    fetchImpl,
    detectAgentsImpl: async () => [],
  });

  assert.equal(result.models[0].id, "ollama");
  assert.equal(result.models[0].running, true);
  assert.deepEqual(result.models[0].models_detected, [
    "qwen3.5-coder:latest",
  ]);
});

test("detectConnections includes LM Studio when the OpenAI-compatible endpoint responds", async () => {
  const fetchImpl = async (url) => {
    if (url === "http://127.0.0.1:11434/api/tags") {
      throw new Error("ollama offline");
    }

    if (url === "http://127.0.0.1:1234/v1/models") {
      return jsonResponse({
        data: [{ id: "qwen2.5-coder-7b-instruct" }],
      });
    }

    throw new Error(`unexpected url: ${url}`);
  };

  const result = await detectConnections({
    repoRoot: "/tmp/demo-repo",
    fetchImpl,
    detectAgentsImpl: async () => [],
  });

  assert.equal(result.models[0].id, "lm-studio");
  assert.equal(result.models[0].running, true);
  assert.deepEqual(result.models[0].models_detected, [
    "qwen2.5-coder-7b-instruct",
  ]);
});

test("detectConnections does not report Cursor or Claude Code as detected when CLI probing is unavailable and no config exists", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const result = await detectConnections({
    repoRoot,
    env,
    fetchImpl: async () => jsonResponse({}, false),
  });

  const cursor = result.agents.find((agent) => agent.id === "cursor");
  const claudeCode = result.agents.find((agent) => agent.id === "claude-code");

  assert.equal(cursor.detected, false);
  assert.equal(claudeCode, undefined);
});

test("detectConnections does not count Cursor config for another repo as configured", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const cursorConfigPath = path.join(repoRoot, ".cursor", "mcp.json");

  await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
  await fs.writeFile(
    cursorConfigPath,
    JSON.stringify({
      mcpServers: {
        "heart-mcp": {
          args: ["/tmp/heart.js", "mcp", "serve", "--root", "/tmp/other-repo"],
        },
      },
    }),
  );

  const result = await detectConnections({
    repoRoot,
    env,
    fetchImpl: async () => jsonResponse({}, false),
    execFileImpl: async () => ({ stdout: "", stderr: "" }),
  });

  const cursor = result.agents.find((agent) => agent.id === "cursor");
  assert.equal(cursor.configured, false);
});

test("detectConnections does not count Cursor CLI output alone as configured for this repo", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);

  const result = await detectConnections({
    repoRoot,
    env,
    fetchImpl: async () => jsonResponse({}, false),
    execFileImpl: async () => ({ stdout: "heart-mcp\n", stderr: "" }),
  });

  const cursor = result.agents.find((agent) => agent.id === "cursor");
  assert.equal(cursor.detected, true);
  assert.equal(cursor.configured, false);
});

test("detectConnections does not count Cursor config without repo affinity as configured", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const cursorConfigPath = path.join(repoRoot, ".cursor", "mcp.json");

  await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
  await fs.writeFile(
    cursorConfigPath,
    JSON.stringify({
      mcpServers: {
        "heart-mcp": {
          command: "node",
          args: ["/tmp/heart.js", "mcp", "serve"],
        },
      },
    }),
  );

  const result = await detectConnections({
    repoRoot,
    env,
    fetchImpl: async () => jsonResponse({}, false),
    execFileImpl: async () => {
      const error = new Error("not found");
      error.code = "ENOENT";
      throw error;
    },
  });

  const cursor = result.agents.find((agent) => agent.id === "cursor");
  assert.equal(cursor.configured, false);
});

test("detectConnections does not count malformed Continue config as configured", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const continueConfigPath = path.join(
    repoRoot,
    ".continue",
    "mcpServers",
    "heart-mcp.json",
  );

  await fs.mkdir(path.dirname(continueConfigPath), { recursive: true });
  await fs.writeFile(continueConfigPath, "{not-json");

  const result = await detectConnections({
    repoRoot,
    env,
    fetchImpl: async () => jsonResponse({}, false),
    execFileImpl: async () => ({ stdout: "", stderr: "" }),
  });

  const continueAgent = result.agents.find((agent) => agent.id === "continue");
  assert.equal(continueAgent.configured, false);
});

test("detectConnections does not count Continue config for another repo as configured", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const continueConfigPath = path.join(
    repoRoot,
    ".continue",
    "mcpServers",
    "heart-mcp.json",
  );

  await fs.mkdir(path.dirname(continueConfigPath), { recursive: true });
  await fs.writeFile(
    continueConfigPath,
    JSON.stringify({
      mcpServers: [
        {
          name: "heart-mcp",
          command: "node",
          args: ["/tmp/heart.js", "mcp", "serve", "--root", "/tmp/other-repo"],
        },
      ],
    }),
  );

  const result = await detectConnections({
    repoRoot,
    env,
    fetchImpl: async () => jsonResponse({}, false),
    execFileImpl: async () => {
      const error = new Error("not found");
      error.code = "ENOENT";
      throw error;
    },
  });

  const continueAgent = result.agents.find((agent) => agent.id === "continue");
  assert.equal(continueAgent.configured, false);
});

test("detectConnections detects Claude Code from config file evidence when CLI probing fails", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const claudeConfigPath = path.join(repoRoot, ".mcp.json");

  await fs.writeFile(
    claudeConfigPath,
    JSON.stringify({
      mcpServers: {
        "heart-mcp": {
          command: "node",
          args: ["/tmp/heart.js", "mcp", "serve", "--root", repoRoot],
        },
      },
    }),
  );

  const result = await detectConnections({
    repoRoot,
    env,
    fetchImpl: async () => jsonResponse({}, false),
    execFileImpl: async () => {
      const error = new Error("not found");
      error.code = "ENOENT";
      throw error;
    },
  });

  const claudeCode = result.agents.find((agent) => agent.id === "claude-code");
  assert.equal(claudeCode.detected, true);
  assert.equal(claudeCode.configured, true);
});

test("detectConnections detects Claude Code as configured when CLI is available and repo config is valid", async (t) => {
  const { repoRoot, env } = await createConnectTestContext(t);
  const claudeConfigPath = path.join(repoRoot, ".mcp.json");

  await fs.writeFile(
    claudeConfigPath,
    JSON.stringify({
      mcpServers: {
        "heart-mcp": {
          command: "node",
          args: ["/tmp/heart.js", "mcp", "serve", "--root", repoRoot],
        },
      },
    }),
  );

  const result = await detectConnections({
    repoRoot,
    env,
    fetchImpl: async () => jsonResponse({}, false),
    execFileImpl: async () => ({ stdout: "heart-mcp\n", stderr: "" }),
  });

  const claudeCode = result.agents.find((agent) => agent.id === "claude-code");
  assert.equal(claudeCode.detected, true);
  assert.equal(claudeCode.configured, true);
});
