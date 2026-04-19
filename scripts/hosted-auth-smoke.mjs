import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  runHostedAuthSmoke,
  startMockOidcProvider,
  startServiceHost,
} from "../services/api/src/index.js";

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-hosted-auth-"));
  const monorepoRoot = process.cwd();
  const serviceStorageRoot = path.join(tempRoot, "services", "api", "data");
  const portalBaseUrl = process.env.BE_AI_HEART_PORTAL_BASE_URL ?? "http://127.0.0.1:3001";
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
    "BE_AI_HEART_SERVICE_STORAGE_BACKEND",
    "BE_AI_HEART_API_BASE_URL",
  ]);

  let mockProvider;
  let serviceHost;
  try {
    mockProvider = await startMockOidcProvider({
      port: 0,
      clientId: "beheart-hosted-web",
      clientSecret: "beheart-local-secret",
      customerSlug: "demo-customer",
      workspaces: ["demo-customer"],
      roles: ["customer"],
    });

    process.env.BE_AI_HEART_AUTH0_ISSUER = mockProvider.issuer;
    process.env.BE_AI_HEART_AUTH0_CLIENT_ID = "beheart-hosted-web";
    process.env.BE_AI_HEART_AUTH0_CLIENT_SECRET = "beheart-local-secret";
    process.env.BE_AI_HEART_AUTH0_AUDIENCE = "beheart-hosted-web";
    process.env.BE_AI_HEART_CLERK_OIDC_ISSUER = mockProvider.issuer;
    process.env.BE_AI_HEART_CLERK_CLIENT_ID = "beheart-hosted-web";
    process.env.BE_AI_HEART_CLERK_CLIENT_SECRET = "beheart-local-secret";
    process.env.BE_AI_HEART_CLERK_AUDIENCE = "beheart-hosted-web";
    process.env.BE_AI_HEART_PORTAL_BASE_URL = portalBaseUrl;
    process.env.BE_AI_HEART_SERVICE_STORAGE_ROOT = serviceStorageRoot;
    process.env.BE_AI_HEART_SERVICE_STORAGE_BACKEND = "sqlite";

    serviceHost = await startServiceHost({
      hostname: "127.0.0.1",
      port: 0,
      monorepoRoot,
      serviceStorageRoot,
      portalRoot: path.join(monorepoRoot, "apps", "portal"),
      adminRoot: path.join(monorepoRoot, "apps", "admin"),
    });

    process.env.BE_AI_HEART_API_BASE_URL = serviceHost.url;
    const flows = [];
    for (const providerId of ["auth0", "clerk"]) {
      const result = await runHostedAuthSmoke({
        apiBaseUrl: serviceHost.url,
        providerId,
        returnTo: new URL("/auth/complete", portalBaseUrl).toString(),
      });
      flows.push({
        provider_id: result.provider_id,
        surface: result.surface,
        actor_slug: result.actor?.actor_slug ?? "",
        customer_slug: result.session?.customer_slug ?? "",
        workspace_slug: result.session?.workspace_slug ?? "",
        completion_url: result.completion_url,
      });
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          status: "ok",
          mock_provider: mockProvider.issuer,
          api_base_url: serviceHost.url,
          flows,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    restoreEnv(previousEnv);
    if (serviceHost?.server) {
      await new Promise((resolve, reject) => {
        serviceHost.server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
    if (mockProvider?.close) {
      await mockProvider.close();
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

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

main().catch((error) => {
  process.stderr.write(`${error?.message || "Hosted auth smoke failed."}\n`);
  process.exitCode = 1;
});
