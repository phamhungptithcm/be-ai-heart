import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import {
  startServiceHost,
  writeRepositoryProfileArtifactRecord,
} from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("portal benchmark launcher exposes workspace capability and publishes observed benchmark runs", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const serviceStorageRoot = path.join(workspaceRoot, "services", "api", "data");
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const generatedAt = new Date().toISOString();

  await fs.mkdir(path.join(repoRoot, "benchmarks", "scenarios"), { recursive: true });
  await fs.writeFile(
    path.join(repoRoot, "benchmarks", "scenarios", "login-audit-flow.json"),
    `${JSON.stringify(
      {
        id: "login-audit-flow",
        title: "Login audit flow",
        category: "document-aware-follow-up",
        description: "Compare baseline and assisted login audit changes.",
        repo: path.basename(repoRoot),
        task: {
          statement: "Update login audit flow using existing project memory.",
        },
        baseline: {
          tokens: 2000,
          minutes: 25,
          duplicates: 3,
          review_edits: 6,
          memory_refreshes: 4,
        },
        assisted: {
          tokens: 1400,
          minutes: 15,
          duplicates: 1,
          review_edits: 2,
          memory_refreshes: 1,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await writeRepositoryProfileArtifactRecord({
    serviceStorageRoot,
    profile: {
      schema_version: 1,
      profile_slug: "demo-customer",
      workspace_slug: "demo-customer",
      customer_slug: "demo-customer",
      repo: path.basename(repoRoot),
      generated_at: generatedAt,
      overview: {
        summary: "Demo repository profile",
        file_count: 12,
        symbol_count: 32,
        parser_engine: "tree-sitter",
        policy_warnings: 0,
        domain_count: 4,
        relationship_count: 18,
      },
      heart: {
        domain_count: 4,
        relationship_count: 18,
      },
      documents: {
        document_count: 2,
        decision_count: 1,
        requirement_count: 1,
        technical_count: 0,
      },
      cache: {
        status: "updated",
        scan_mode: "full",
      },
      diagrams: [],
    },
    workspaceMetadata: {
      benchmark_runner: {
        repo_root: repoRoot,
        connected_at: generatedAt,
        source: "test-fixture",
      },
    },
  });

  const upstreamServer = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const userMessage = String(payload?.messages?.[0]?.content ?? "");
    const isAssisted = userMessage.includes("assisted");

    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: `chatcmpl_${isAssisted ? "assisted" : "baseline"}`,
        object: "chat.completion",
        model: payload?.model ?? "gpt-5.4",
        usage: isAssisted
          ? {
              prompt_tokens: 110,
              completion_tokens: 40,
              total_tokens: 150,
            }
          : {
              prompt_tokens: 220,
              completion_tokens: 80,
              total_tokens: 300,
            },
      }),
    );
  });
  await new Promise((resolve) => upstreamServer.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstreamServer.address();
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamAddress.port}/v1`;

  const serviceHost = await startServiceHost({
    hostname: "127.0.0.1",
    port: 0,
    monorepoRoot: workspaceRoot,
    serviceStorageRoot,
    portalRoot,
    adminRoot,
  });
  const commandScriptPath = path.join(repoRoot, "scripts", "benchmark-launch-agent.mjs");
  await fs.mkdir(path.dirname(commandScriptPath), { recursive: true });
  await fs.writeFile(
    commandScriptPath,
    `const mode = process.env.BE_AI_HEART_BENCHMARK_MODE ?? "baseline";
const baseUrl = String(process.env.OPENAI_BASE_URL ?? "").replace(/\\/+$/, "");
for (let index = 0; index < 2; index += 1) {
  const response = await fetch(\`\${baseUrl}/chat/completions\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-openai-key",
    },
    body: JSON.stringify({
      model: "gpt-5.4",
      messages: [{ role: "user", content: \`\${mode}-request-\${index}\` }],
    }),
  });
  if (!response.ok) {
    throw new Error(\`Proxy request failed with status \${response.status}\`);
  }
  await response.json();
}
`,
    "utf8",
  );

  t.after(async () => {
    await new Promise((resolve) => serviceHost.server.close(resolve));
    await new Promise((resolve) => upstreamServer.close(resolve));
  });

  const capabilityResponse = await fetch(
    `${serviceHost.url}/api/benchmarks/runs?workspace=demo-customer`,
    {
      headers: {
        "x-be-ai-heart-session": "portal-demo-session",
      },
    },
  );
  assert.equal(capabilityResponse.status, 200);
  const capabilityPayload = await capabilityResponse.json();
  assert.equal(capabilityPayload.capability.runner_status, "ready");
  assert.equal(capabilityPayload.capability.can_launch_observed, true);
  assert.ok(
    capabilityPayload.capability.scenarios.some((scenario) => scenario.id === "login-audit-flow"),
  );

  const launchResponse = await fetch(
    `${serviceHost.url}/api/benchmarks/runs?workspace=demo-customer`,
    {
      method: "POST",
      headers: {
        "x-be-ai-heart-session": "portal-demo-session",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scenario: "login-audit-flow",
        measurement_mode: "observed",
        provider: "openai",
        model: "gpt-5.4",
        agent_client: "integration-test",
        upstream_base_url: upstreamBaseUrl,
        baseline_command: ["node", commandScriptPath],
        assisted_command: ["node", commandScriptPath],
        pricing: {
          input_cost_per_1m: 10,
          output_cost_per_1m: 20,
        },
      }),
    },
  );
  assert.equal(launchResponse.status, 202);
  const acceptedLaunch = await launchResponse.json();
  const launchId = acceptedLaunch.launch.launch_id;
  assert.ok(launchId);

  const completedLaunch = await waitFor(async () => {
    const response = await fetch(
      `${serviceHost.url}/api/benchmarks/runs/${launchId}?workspace=demo-customer`,
      {
        headers: {
          "x-be-ai-heart-session": "portal-demo-session",
        },
      },
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    return payload.launch?.status === "completed" ? payload.launch : null;
  });

  assert.equal(completedLaunch.measurement_mode, "observed");
  assert.equal(completedLaunch.baseline.summary.total_tokens, 600);
  assert.equal(completedLaunch.assisted.summary.total_tokens, 300);
  assert.equal(completedLaunch.live.provisional_metrics.token_savings_pct, 50);
  assert.ok(completedLaunch.report.report_id);
  assert.equal(completedLaunch.report.metrics.token_savings_pct, 50);

  const reportResponse = await fetch(`${serviceHost.url}/api/benchmarks/${completedLaunch.report.report_id}`, {
    headers: {
      "x-be-ai-heart-session": "portal-demo-session",
    },
  });
  assert.equal(reportResponse.status, 200);
  const reportPayload = await reportResponse.json();
  assert.equal(reportPayload.report_id, completedLaunch.report.report_id);
  assert.equal(reportPayload.metrics.token_savings_pct, 50);
});

async function waitFor(check, { attempts = 60, intervalMs = 100 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await check();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for benchmark launch to finish.");
}
