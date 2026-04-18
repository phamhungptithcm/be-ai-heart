import test from "node:test";
import assert from "node:assert/strict";

import { detectConnections } from "../packages/connect/src/index.js";

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
