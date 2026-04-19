import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";

import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import {
  loadAgentRunCapture,
  writeAgentRunRecord,
} from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("service host OpenAI-compatible proxy forwards requests and persists observed usage", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });
  const upstreamServer = http.createServer(async (req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/v1/chat/completions");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: "chatcmpl_123",
        object: "chat.completion",
        model: "gpt-5.4",
        usage: {
          prompt_tokens: 120,
          completion_tokens: 30,
          total_tokens: 150,
          prompt_tokens_details: {
            cached_tokens: 20,
          },
          completion_tokens_details: {
            reasoning_tokens: 5,
          },
        },
      }),
    );
  });
  await new Promise((resolve) => upstreamServer.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstreamServer.address();

  t.after(() => {
    upstreamServer.close();
  });

  await writeAgentRunRecord({
    serviceStorageRoot: config.serviceStorageRoot,
    run: {
      run_id: "run-observed-usage",
      profile_slug: "sample-repo",
      workspace_slug: "sample-repo",
      customer_slug: "sample-repo",
      repo: "sample-repo",
      scenario_id: "login-audit-flow",
      mode: "baseline",
      status: "running",
      provider: "openai",
      model: "gpt-5.4",
      upstream_base_url: `http://127.0.0.1:${upstreamAddress.port}/v1`,
      pricing: {
        input_cost_per_1m: 10,
        cached_input_cost_per_1m: 5,
        output_cost_per_1m: 20,
      },
    },
  });

  const response = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/proxy/openai/runs/run-observed-usage/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-openai-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        messages: [{ role: "user", content: "hello" }],
      }),
    }),
    config,
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.id, "chatcmpl_123");

  const capture = await loadAgentRunCapture({
    serviceStorageRoot: config.serviceStorageRoot,
    runId: "run-observed-usage",
  });

  assert.equal(capture.run.run_id, "run-observed-usage");
  assert.equal(capture.summary.measurement_mode, "observed");
  assert.equal(capture.summary.total_tokens, 150);
  assert.equal(capture.summary.prompt_tokens, 120);
  assert.equal(capture.summary.completion_tokens, 30);
  assert.equal(capture.summary.cached_input_tokens, 20);
  assert.equal(capture.summary.reasoning_tokens, 5);
  assert.equal(capture.summary.token_cost_usd, 0.0017);
  assert.equal(capture.summary.observed_call_count, 1);
  assert.equal(capture.summary.traced_call_count, 1);
  assert.equal(capture.llm_calls.length, 1);
  assert.equal(capture.llm_calls[0].request_kind, "chat_completions");
  assert.equal(capture.llm_calls[0].path, "/chat/completions");
  assert.equal(capture.llm_calls[0].cost_usd, 0.0017);
  assert.ok(capture.llm_calls[0].request_hash.length > 10);
  assert.equal(capture.llm_calls[0].payload?.request_body, undefined);
  assert.equal(capture.llm_calls[0].payload?.response_body, undefined);
});
