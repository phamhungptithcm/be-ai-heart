import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  runHostedAuthSmoke,
  startMockOidcProvider,
  startServiceHost,
} from "../services/api/src/index.js";

test("hosted auth smoke completes auth0 and clerk callback flow through the standalone API host", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-hosted-auth-test-"));
  const serviceStorageRoot = path.join(tempRoot, "services", "api", "data");
  const monorepoRoot = process.cwd();
  const previousEnv = captureEnv([
    "BE_AI_HEART_AUTH0_ISSUER",
    "BE_AI_HEART_AUTH0_CLIENT_ID",
    "BE_AI_HEART_AUTH0_CLIENT_SECRET",
    "BE_AI_HEART_AUTH0_AUDIENCE",
    "BE_AI_HEART_CLERK_OIDC_ISSUER",
    "BE_AI_HEART_CLERK_CLIENT_ID",
    "BE_AI_HEART_CLERK_CLIENT_SECRET",
    "BE_AI_HEART_CLERK_AUDIENCE",
    "BE_AI_HEART_PORTAL_BASE_URL",
    "BE_AI_HEART_SERVICE_STORAGE_ROOT",
    "BE_AI_HEART_API_BASE_URL",
  ]);

  const mockProvider = await startMockOidcProvider({
    port: 0,
    clientId: "beheart-test-web",
    clientSecret: "beheart-test-secret",
    customerSlug: "demo-customer",
    workspaces: ["demo-customer"],
    roles: ["customer"],
  });
  const serviceHost = await startServiceHost({
    hostname: "127.0.0.1",
    port: 0,
    monorepoRoot,
    serviceStorageRoot,
    portalRoot: path.join(monorepoRoot, "apps", "portal"),
    adminRoot: path.join(monorepoRoot, "apps", "admin"),
  });

  t.after(async () => {
    restoreEnv(previousEnv);
    await new Promise((resolve, reject) => {
      serviceHost.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await mockProvider.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  process.env.BE_AI_HEART_AUTH0_ISSUER = mockProvider.issuer;
  process.env.BE_AI_HEART_AUTH0_CLIENT_ID = "beheart-test-web";
  process.env.BE_AI_HEART_AUTH0_CLIENT_SECRET = "beheart-test-secret";
  process.env.BE_AI_HEART_AUTH0_AUDIENCE = "beheart-test-web";
  process.env.BE_AI_HEART_CLERK_OIDC_ISSUER = mockProvider.issuer;
  process.env.BE_AI_HEART_CLERK_CLIENT_ID = "beheart-test-web";
  process.env.BE_AI_HEART_CLERK_CLIENT_SECRET = "beheart-test-secret";
  process.env.BE_AI_HEART_CLERK_AUDIENCE = "beheart-test-web";
  process.env.BE_AI_HEART_PORTAL_BASE_URL = "http://127.0.0.1:3001";
  process.env.BE_AI_HEART_SERVICE_STORAGE_ROOT = serviceStorageRoot;
  process.env.BE_AI_HEART_API_BASE_URL = serviceHost.url;

  for (const providerId of ["auth0", "clerk"]) {
    const result = await runHostedAuthSmoke({
      apiBaseUrl: serviceHost.url,
      providerId,
      returnTo: "http://127.0.0.1:3001/auth/complete",
    });

    assert.equal(result.provider_id, providerId);
    assert.equal(result.actor?.email, "demo@example.com");
    assert.match(result.actor?.actor_slug ?? "", /^[a-z0-9-]+$/);
    assert.equal(result.session?.customer_slug, "demo-customer");
    assert.equal(result.session?.workspace_slug, "demo-customer");
    assert.match(result.completion_url, /session_token=/);
  }
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
