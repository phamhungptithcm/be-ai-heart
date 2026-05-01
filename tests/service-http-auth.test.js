import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import { issueWorkspaceSession } from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("service auth provider registry does not expose oauth client secrets", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const previousEnv = captureEnv([
    "BE_AI_HEART_AUTH0_ISSUER",
    "BE_AI_HEART_AUTH0_CLIENT_ID",
    "BE_AI_HEART_AUTH0_CLIENT_SECRET",
    "BE_AI_HEART_API_BASE_URL",
    "BE_AI_HEART_PORTAL_BASE_URL",
  ]);

  process.env.BE_AI_HEART_AUTH0_ISSUER = "https://auth.example.test";
  process.env.BE_AI_HEART_AUTH0_CLIENT_ID = "be-ai-heart-web";
  process.env.BE_AI_HEART_AUTH0_CLIENT_SECRET = "super-secret-value";
  process.env.BE_AI_HEART_API_BASE_URL = "http://127.0.0.1:4010";
  process.env.BE_AI_HEART_PORTAL_BASE_URL = "http://127.0.0.1:3001";

  t.after(() => {
    restoreEnv(previousEnv);
  });

  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
  });

  const response = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/auth/providers?surface=portal"),
    config,
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.ok(payload.providers.length >= 1);
  const auth0 = payload.providers.find((provider) => provider.id === "auth0");
  assert.ok(auth0);
  assert.equal("oauth" in auth0, false);
  assert.equal(auth0.provider_config.issuer, "https://auth.example.test");
});

test("service auth session exchange rejects custom provider config over HTTP", async (t) => {
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

  const response = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/session/provider", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id_token: "dummy-provider-token",
        provider_config: {
          issuer: "https://evil.example.test",
        },
      }),
    }),
    config,
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error, /provider_config/i);
});

test("service host rejects oversized intake payloads with 413", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
    requestLimits: {
      publicIntake: 256,
    },
  });

  const response = await handleServiceHttpRequest(
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
        message: "x".repeat(1024),
        source_page: "/book-demo",
      }),
    }),
    config,
  );
  const payload = await response.json();

  assert.equal(response.status, 413);
  assert.match(payload.error, /too large/i);
});

test("service host rate limits repeated public intake submissions from the same client", async (t) => {
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
  const intakePayload = {
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
  };

  const firstResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify(intakePayload),
    }),
    config,
  );
  const secondResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        ...intakePayload,
        work_email: "alex+2@example.com",
      }),
    }),
    config,
  );
  const payload = await secondResponse.json();

  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 429);
  assert.match(payload.error, /rate limit exceeded/i);
  assert.equal(secondResponse.headers.get("retry-after"), "60");
});

test("service host keeps rate limits durable across fresh HTTP config instances", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const baseOptions = {
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
  };
  const configA = resolveHttpConfig(baseOptions);
  const configB = resolveHttpConfig(baseOptions);
  const intakePayload = {
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
  };

  const firstResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.44",
      },
      body: JSON.stringify(intakePayload),
    }),
    configA,
  );
  const secondResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.44",
      },
      body: JSON.stringify({
        ...intakePayload,
        work_email: "alex+second@example.com",
      }),
    }),
    configB,
  );

  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 429);
});

test("service host isolates durable rate limits by configured namespace", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const baseOptions = {
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
    rateLimits: {
      namespace: "tenant-a",
      "public-intake": {
        windowMs: 60 * 1000,
        max: 1,
      },
    },
  };
  const configA = resolveHttpConfig(baseOptions);
  const configB = resolveHttpConfig({
    ...baseOptions,
    rateLimits: {
      ...baseOptions.rateLimits,
      namespace: "tenant-b",
    },
  });
  const intakePayload = {
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
  };

  const firstResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.77",
      },
      body: JSON.stringify(intakePayload),
    }),
    configA,
  );
  const secondResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/public/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.77",
      },
      body: JSON.stringify({
        ...intakePayload,
        work_email: "alex+namespace@example.com",
      }),
    }),
    configB,
  );

  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 201);
});

test("cookie-backed write routes require an allowed origin and matching CSRF token", async (t) => {
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

  const sessionResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-be-ai-heart-session": "portal-demo-session",
      },
      body: JSON.stringify({}),
    }),
    config,
  );
  const sessionPayload = await sessionResponse.json();
  const sessionCookie = extractCookieHeader(sessionResponse.headers.get("set-cookie"));

  assert.equal(sessionResponse.status, 201);
  assert.ok(sessionCookie);
  assert.ok(sessionPayload.session?.csrf_token);

  const requestBody = {
    profile_slug: "cookie-auth-workspace",
    title: "Auth hardening notes",
    body: "Need to land CSRF validation for browser-authenticated writes.",
  };
  const missingCsrfResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/documents/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:3001",
        Cookie: sessionCookie,
      },
      body: JSON.stringify(requestBody),
    }),
    config,
  );
  const disallowedOriginResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/documents/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example.test",
        Cookie: sessionCookie,
        "x-be-ai-heart-csrf": sessionPayload.session.csrf_token,
      },
      body: JSON.stringify(requestBody),
    }),
    config,
  );
  const validResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/documents/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:3001",
        Cookie: sessionCookie,
        "x-be-ai-heart-csrf": sessionPayload.session.csrf_token,
      },
      body: JSON.stringify(requestBody),
    }),
    config,
  );

  assert.equal(missingCsrfResponse.status, 403);
  assert.equal(disallowedOriginResponse.status, 403);
  assert.equal(validResponse.status, 201);
});

test("admin session registry redacts session material and requires CSRF for cookie-backed revocation", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const serviceStorageRoot = path.join(workspaceRoot, "services", "api", "data");
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot,
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
  });
  const sessionFamilyId = "family-redaction-check";
  const portalSession = await issueWorkspaceSession({
    serviceStorageRoot,
    actorSlug: "demo-customer",
    surface: "portal",
    customerSlug: "demo-customer",
    sessionFamilyId,
    localDemoAuth: true,
  });

  const listResponse = await handleServiceHttpRequest(
    new Request(
      `http://127.0.0.1:4010/api/admin/sessions?session_family_id=${sessionFamilyId}&customer_id=${portalSession.customer_id}`,
      {
        headers: {
          "x-be-ai-heart-session": "admin-owner-session",
        },
      },
    ),
    config,
  );
  const listPayload = await listResponse.json();

  assert.equal(listResponse.status, 200);
  assert.equal(listPayload.sessions.length, 1);
  assert.equal(listPayload.sessions[0].session_token, "");
  assert.equal(listPayload.sessions[0].csrf_token, "");
  assert.equal(listPayload.sessions[0].customer_id, portalSession.customer_id);

  const adminSessionResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-be-ai-heart-session": "admin-owner-session",
      },
      body: JSON.stringify({}),
    }),
    config,
  );
  const adminSessionPayload = await adminSessionResponse.json();
  const adminSessionCookie = extractCookieHeader(adminSessionResponse.headers.get("set-cookie"));

  assert.equal(adminSessionResponse.status, 201);
  assert.ok(adminSessionCookie);
  assert.ok(adminSessionPayload.session?.csrf_token);

  const blockedRevokeResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminSessionCookie,
      },
      body: JSON.stringify({
        session_family_id: sessionFamilyId,
      }),
    }),
    config,
  );
  const revokeResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:3002",
        Cookie: adminSessionCookie,
        "x-be-ai-heart-csrf": adminSessionPayload.session.csrf_token,
      },
      body: JSON.stringify({
        session_family_id: sessionFamilyId,
        reason: "incident-response",
      }),
    }),
    config,
  );
  const revokePayload = await revokeResponse.json();

  assert.equal(blockedRevokeResponse.status, 403);
  assert.equal(revokeResponse.status, 200);
  assert.equal(revokePayload.revoked_count, 1);

  const revokedSessionResponse = await handleServiceHttpRequest(
    new Request(`http://127.0.0.1:4010/api/session?session=${portalSession.session_token}`),
    config,
  );
  const revokedSessionPayload = await revokedSessionResponse.json();

  assert.equal(revokedSessionResponse.status, 200);
  assert.equal(revokedSessionPayload.session, null);
});

function captureEnv(keys) {
  return new Map(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const [key, value] of snapshot.entries()) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

function extractCookieHeader(setCookieHeader) {
  return String(setCookieHeader ?? "").split(";")[0];
}
