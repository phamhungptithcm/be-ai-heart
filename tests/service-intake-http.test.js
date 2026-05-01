import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("service host accepts public website intake submissions and exposes admin intake summary", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
  });

  const intakeResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intake_kind: "demo",
        full_name: "Alex Buyer",
        work_email: "alex@example.com",
        company: "Example Labs",
        role: "Engineering Manager",
        team_size: 14,
        repo_count: 6,
        primary_goal: "Reduce AI token spend while keeping architecture clean.",
        message: "Need one guided pilot repository and a benchmark readout.",
        source_page: "/book-demo",
      }),
    }),
    config,
  );

  assert.equal(intakeResponse.status, 201);
  const intakePayload = await intakeResponse.json();
  assert.equal(intakePayload.intake_kind, "demo");
  assert.equal(intakePayload.source_page, "/book-demo");
  assert.match(intakePayload.request_id, /^intake-demo-/);

  const adminResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/intake", {
      headers: {
        "x-be-ai-heart-session": "admin-owner-session",
      },
    }),
    config,
  );

  assert.equal(adminResponse.status, 200);
  const adminPayload = await adminResponse.json();
  assert.equal(adminPayload.requests.length, 1);
  assert.equal(adminPayload.summary.total_count, 1);
  assert.equal(adminPayload.summary.demo_count, 1);
  assert.equal(adminPayload.summary.trial_count, 0);
  assert.equal(adminPayload.requests[0].work_email, "alex@example.com");
});

test("service host rejects invalid public intake submissions", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });

  const response = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intake_kind: "trial",
        full_name: "Trial User",
        work_email: "invalid-email",
        company: "Example Labs",
        role: "Staff Engineer",
        team_size: 3,
        repo_count: 1,
        primary_goal: "Prove one pilot repo.",
        message: "Want to test CLI and portal.",
        source_page: "/start-trial",
      }),
    }),
    config,
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.error, /work_email/i);
});

test("service host allows loopback website origins during local intake submissions", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });

  const response = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:3110",
      },
    }),
    config,
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:3110");
});
