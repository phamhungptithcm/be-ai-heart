import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  handleServiceHttpRequest,
  resolveHttpConfig,
} from "../services/api/src/http.js";
import {
  listAuditEvents,
  listRequestTraces,
  writeAgentRunRecord,
  writeAuditEvent,
  writeRequestTrace,
} from "../services/api/src/index.js";
import { resolveBillingProviderAdapter } from "../services/api/src/provider-adapters.js";
import { assertProductionHttpConfig } from "../services/api/src/runtime-config.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("tracked release benchmark artifacts do not expose local paths or secret-like values", () => {
  const trackedFiles = execFileSync("git", ["ls-files", ".heart/benchmarks"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const forbidden = [
    /\/Users\//,
    /\/home\//,
    /\/private\//,
    /local_manifest_path/,
    /\bsk-[A-Za-z0-9_-]{8,}/,
    /\bsk_[A-Za-z0-9_-]{8,}/,
    /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i,
    /\b(?:api_key|password|secret|token)=\S+/i,
  ];

  for (const file of trackedFiles) {
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(content, pattern, `${file} matched ${pattern}`);
    }
  }
});

test("production API config fails closed on missing or unsafe env", (t) => {
  const previousEnv = captureEnv([
    "NODE_ENV",
    "BE_AI_HEART_RUNTIME_ENV",
    "BE_AI_HEART_API_BASE_URL",
    "BE_AI_HEART_WEBSITE_BASE_URL",
    "BE_AI_HEART_PORTAL_BASE_URL",
    "BE_AI_HEART_ADMIN_BASE_URL",
    "BE_AI_HEART_SERVICE_STORAGE_BACKEND",
    "BE_AI_HEART_POSTGRES_URL",
    "BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH",
    "BE_AI_HEART_DEFAULT_PORTAL_SESSION",
    "BE_AI_HEART_DEFAULT_ADMIN_SESSION",
    "BE_AI_HEART_AUTH0_ISSUER",
    "BE_AI_HEART_AUTH0_CLIENT_ID",
    "BE_AI_HEART_AUTH0_CLIENT_SECRET",
    "BE_AI_HEART_PORTAL_SECRET_KEY",
    "BE_AI_HEART_LLM_PROXY_SHARED_SECRET",
    "BE_AI_HEART_LLM_PROXY_ALLOWED_ORIGINS",
  ]);
  t.after(() => restoreEnv(previousEnv));

  process.env.BE_AI_HEART_RUNTIME_ENV = "production";
  assert.throws(
    () => assertProductionHttpConfig({ localDemoAuth: true }, process.env),
    /Production API configuration is incomplete/,
  );

  Object.assign(process.env, {
    BE_AI_HEART_API_BASE_URL: "https://api.example.test",
    BE_AI_HEART_WEBSITE_BASE_URL: "https://www.example.test",
    BE_AI_HEART_PORTAL_BASE_URL: "https://portal.example.test",
    BE_AI_HEART_ADMIN_BASE_URL: "https://admin.example.test",
    BE_AI_HEART_SERVICE_STORAGE_BACKEND: "postgres",
    BE_AI_HEART_POSTGRES_URL: "postgres://beheart_app:replace-me@example.test:5432/beheart",
    BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH: "0",
    BE_AI_HEART_AUTH0_ISSUER: "https://auth.example.test",
    BE_AI_HEART_AUTH0_CLIENT_ID: "beheart",
    BE_AI_HEART_AUTH0_CLIENT_SECRET: "replace-with-real-secret",
    BE_AI_HEART_PORTAL_SECRET_KEY: "x".repeat(32),
    BE_AI_HEART_LLM_PROXY_SHARED_SECRET: "y".repeat(32),
    BE_AI_HEART_LLM_PROXY_ALLOWED_ORIGINS: "https://api.openai.com",
  });
  delete process.env.BE_AI_HEART_DEFAULT_PORTAL_SESSION;
  delete process.env.BE_AI_HEART_DEFAULT_ADMIN_SESSION;

  assert.equal(assertProductionHttpConfig({ localDemoAuth: false }, process.env).status, "ready");

  process.env.BE_AI_HEART_DEFAULT_ADMIN_SESSION = "admin-owner-session";
  assert.throws(
    () => assertProductionHttpConfig({ localDemoAuth: false }, process.env),
    /DEFAULT_ADMIN_SESSION/,
  );
});

test("request traces and audit events redact query tokens, keys, and local paths", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const storageRoot = path.join(path.dirname(repoRoot), "services", "api", "data");

  await writeRequestTrace({
    serviceStorageRoot: storageRoot,
    trace: {
      trace_id: "trace-redaction-check",
      path: "/api/session",
      status_code: 401,
      metadata: {
        query: "?session=raw-session-token&api_key=sk-test-redaction-token&safe=ok",
        local_path: "/Users/example/private/repo",
      },
    },
  });
  await writeAuditEvent({
    serviceStorageRoot: storageRoot,
    event: {
      event_id: "audit-redaction-check",
      action: "security.redaction_check",
      metadata: {
        session_token: "raw-session-token",
        nested: {
          password: "plain-text-password",
          note: "path /Users/example/private/repo",
        },
      },
    },
  });

  const traces = await listRequestTraces({ serviceStorageRoot: storageRoot, limit: 20 });
  const audits = await listAuditEvents({ serviceStorageRoot: storageRoot, limit: 20 });
  const traceText = JSON.stringify(traces.find((entry) => entry.trace_id === "trace-redaction-check"));
  const auditText = JSON.stringify(audits.find((entry) => entry.event_id === "audit-redaction-check"));

  assert.doesNotMatch(traceText, /raw-session-token|sk-test-redaction-token|\/Users\//);
  assert.doesNotMatch(auditText, /raw-session-token|plain-text-password|\/Users\//);
  assert.match(traceText, /\[redacted\]|\[local-path\]/);
  assert.match(auditText, /\[redacted\]|\[local-path\]/);
});

test("LLM proxy requires configured token and upstream allowlist when enabled", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    llmProxy: {
      sharedSecret: "proxy-secret-value-with-enough-length",
      allowedOrigins: ["https://api.openai.com"],
    },
  });
  await writeAgentRunRecord({
    serviceStorageRoot: config.serviceStorageRoot,
    run: {
      run_id: "run-proxy-gate",
      profile_slug: "sample-repo",
      workspace_slug: "sample-repo",
      customer_slug: "sample-repo",
      repo: "sample-repo",
      provider: "openai",
      model: "gpt-5.4",
      upstream_base_url: "https://api.openai.com/v1",
    },
  });

  const unauthorized = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/proxy/openai/runs/run-proxy-gate/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "gpt-5.4", messages: [] }),
    }),
    config,
  );
  assert.equal(unauthorized.status, 401);

  await writeAgentRunRecord({
    serviceStorageRoot: config.serviceStorageRoot,
    run: {
      run_id: "run-proxy-denied-upstream",
      profile_slug: "sample-repo",
      workspace_slug: "sample-repo",
      customer_slug: "sample-repo",
      repo: "sample-repo",
      provider: "openai",
      model: "gpt-5.4",
      upstream_base_url: "https://evil.example.test/v1",
    },
  });
  const denied = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/proxy/openai/runs/run-proxy-denied-upstream/v1/chat/completions", {
      method: "POST",
      headers: {
        "x-be-ai-heart-proxy-token": "proxy-secret-value-with-enough-length",
      },
      body: JSON.stringify({ model: "gpt-5.4", messages: [] }),
    }),
    config,
  );
  assert.equal(denied.status, 403);
});

test("billing adapter gates paid release when live mode lacks Stripe", (t) => {
  const previousEnv = captureEnv([
    "BE_AI_HEART_BILLING_MODE",
    "BE_AI_HEART_REQUIRE_LIVE_BILLING",
    "BE_AI_HEART_STRIPE_SECRET_KEY",
    "STRIPE_SECRET_KEY",
  ]);
  t.after(() => restoreEnv(previousEnv));

  process.env.BE_AI_HEART_BILLING_MODE = "live";
  delete process.env.BE_AI_HEART_STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  const blocked = resolveBillingProviderAdapter();
  assert.equal(blocked.provider_mode, "misconfigured");
  assert.equal(blocked.release_gate, "missing_stripe_secret");

  process.env.BE_AI_HEART_STRIPE_SECRET_KEY = "stripe-secret-placeholder";
  const ready = resolveBillingProviderAdapter();
  assert.equal(ready.provider_mode, "configured");
  assert.equal(ready.paid_public_release_ready, true);
});

function captureEnv(names) {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

function restoreEnv(snapshot) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}
