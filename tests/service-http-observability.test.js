import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";

import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("admin observability and audit routes expose hosted traces, metrics, alerts, and exports", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
    rateLimits: {
      "public-intake": {
        windowMs: 60 * 1000,
        max: 1,
      },
    },
  });

  const adminHeaders = {
    "x-be-ai-heart-session": "admin-owner-session",
  };
  const intakePayload = {
    intake_kind: "demo",
    full_name: "Morgan Buyer",
    work_email: "morgan@example.com",
    company: "Example Labs",
    role: "Engineering Manager",
    team_size: 12,
    repo_count: 4,
    primary_goal: "Reduce AI token spend while keeping architecture clean.",
    message: "Need a benchmark-driven pilot repo.",
    source_page: "/book-demo",
  };

  const adminSessionResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/session", {
      headers: adminHeaders,
    }),
    config,
  );
  const firstIntakeResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "198.51.100.24",
      },
      body: JSON.stringify(intakePayload),
    }),
    config,
  );
  const secondIntakeResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "198.51.100.24",
      },
      body: JSON.stringify({
        ...intakePayload,
        work_email: "morgan+2@example.com",
      }),
    }),
    config,
  );

  assert.equal(adminSessionResponse.status, 200);
  assert.equal(firstIntakeResponse.status, 201);
  assert.equal(secondIntakeResponse.status, 429);

  const requestsResponse = await handleServiceHttpRequest(
    new Request(
      "http://127.0.0.1:4010/api/admin/observability/requests?route_kind=public-intake&min_status_code=200&max_status_code=499",
      {
        headers: adminHeaders,
      },
    ),
    config,
  );
  const metricsResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/observability/metrics?window_minutes=60", {
      headers: adminHeaders,
    }),
    config,
  );
  const alertsResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/observability/alerts?window_minutes=60", {
      headers: adminHeaders,
    }),
    config,
  );
  const auditExportResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/audit/events?format=ndjson&q=rate_limit", {
      headers: adminHeaders,
    }),
    config,
  );
  const prometheusResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/metrics?window_minutes=60"),
    config,
  );

  assert.equal(requestsResponse.status, 200);
  assert.equal(metricsResponse.status, 200);
  assert.equal(alertsResponse.status, 200);
  assert.equal(auditExportResponse.status, 200);
  assert.equal(prometheusResponse.status, 200);

  const requestsPayload = await requestsResponse.json();
  const metricsPayload = await metricsResponse.json();
  const alertsPayload = await alertsResponse.json();
  const auditExport = await auditExportResponse.text();
  const prometheusText = await prometheusResponse.text();

  assert.ok(requestsPayload.requests.length >= 2);
  assert.ok(requestsPayload.requests.some((entry) => entry.status_code === 201));
  assert.ok(requestsPayload.requests.some((entry) => entry.status_code === 429));
  assert.ok(metricsPayload.total_requests >= 3);
  assert.ok(metricsPayload.rate_limited_requests >= 1);
  assert.ok(
    alertsPayload.alerts.some((entry) => entry.code === "rate_limit_pressure"),
  );
  assert.match(auditExport, /rate_limit\.exceeded/);
  assert.match(prometheusText, /be_ai_heart_http_requests_total/);
  assert.match(prometheusText, /be_ai_heart_http_requests_rate_limited/);
});

test("admin observability export route lists queued exports and flushes them to the configured sink", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const previousEnv = new Map([
    ["BE_AI_HEART_OBSERVABILITY_EXPORT_URL", process.env.BE_AI_HEART_OBSERVABILITY_EXPORT_URL],
    ["BE_AI_HEART_OBSERVABILITY_EXPORT_AUTH_TOKEN", process.env.BE_AI_HEART_OBSERVABILITY_EXPORT_AUTH_TOKEN],
  ]);
  const deliveries = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    deliveries.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const exportUrl = `http://127.0.0.1:${server.address().port}/ingest`;

  process.env.BE_AI_HEART_OBSERVABILITY_EXPORT_URL = exportUrl;
  process.env.BE_AI_HEART_OBSERVABILITY_EXPORT_AUTH_TOKEN = "Bearer test-token";

  t.after(async () => {
    server.close();
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
  });
  const adminHeaders = {
    "x-be-ai-heart-session": "admin-owner-session",
  };

  await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/session", {
      headers: adminHeaders,
    }),
    config,
  );
  await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intake_kind: "trial",
        full_name: "Casey Buyer",
        work_email: "casey@example.com",
        company: "Example Labs",
        role: "Staff Engineer",
        team_size: 8,
        repo_count: 2,
        primary_goal: "Stabilize project memory across AI coding sessions.",
        message: "Need observability export coverage for the hosted lane.",
        source_page: "/start-trial",
      }),
    }),
    config,
  );

  const pendingResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/observability/exports?status=pending", {
      headers: adminHeaders,
    }),
    config,
  );
  const pendingPayload = await pendingResponse.json();

  assert.equal(pendingResponse.status, 200);
  assert.ok(pendingPayload.exports.length >= 2);
  assert.ok(pendingPayload.exports.some((entry) => entry.category === "audit_event"));
  assert.ok(pendingPayload.exports.some((entry) => entry.category === "request_trace"));

  const flushResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/observability/exports?window_minutes=60", {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        include_snapshots: true,
        limit: 50,
      }),
    }),
    config,
  );
  const flushPayload = await flushResponse.json();

  assert.equal(flushResponse.status, 200);
  assert.ok(flushPayload.delivery.attempted >= 2);
  assert.ok(flushPayload.delivery.delivered >= 2);
  assert.ok(deliveries.length >= 2);
  assert.ok(deliveries.some((entry) => entry.category === "traffic_summary"));
  assert.ok(deliveries.some((entry) => entry.category === "alerts_snapshot"));

  const deliveredResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/observability/exports?status=delivered", {
      headers: adminHeaders,
    }),
    config,
  );
  const deliveredPayload = await deliveredResponse.json();

  assert.equal(deliveredResponse.status, 200);
  assert.ok(deliveredPayload.exports.length >= 2);
});
