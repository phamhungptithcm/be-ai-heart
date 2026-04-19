import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import { buildWorkspaceState } from "../packages/core/src/index.js";
import {
  generateDiagramBundle,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../packages/diagram-generator/src/index.js";
import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import { startMockOidcProvider, startServiceHost } from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("service host exposes an authenticated hosted MCP subset for portal sessions", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const serviceStorageRoot = path.join(workspaceRoot, "services", "api", "data");
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot,
    portalRoot,
    adminRoot,
    apiBaseUrl: "http://127.0.0.1:4010",
  });

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
  ]);

  const workspaceState = await buildWorkspaceState(repoRoot);
  const bundle = generateDiagramBundle({
    workspaceState,
    task: "improve login audit flow",
  });
  const artifacts = await writeDiagramBundle(repoRoot, bundle);

  await syncRepositoryProfile({
    repoRoot,
    workspaceState,
    bundle,
    artifacts,
    slug: "demo-customer",
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  });

  const initializeResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-be-ai-heart-session": "portal-demo-session",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "portal-mcp-test",
            version: "0.1.0",
          },
        },
      }),
    }),
    config,
  );
  const initializePayload = await initializeResponse.json();

  assert.equal(initializeResponse.status, 200);
  assert.equal(initializePayload.result.protocolVersion, "2025-06-18");

  const listResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-be-ai-heart-session": "portal-demo-session",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    }),
    config,
  );
  const listPayload = await listResponse.json();

  assert.equal(listResponse.status, 200);
  assert.deepEqual(
    listPayload.result.tools.map((tool) => tool.name),
    ["project_overview", "document_search", "context_pack"],
  );

  const callResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-be-ai-heart-session": "portal-demo-session",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "project_overview",
          arguments: {
            profile_slug: "demo-customer",
          },
        },
      }),
    }),
    config,
  );
  const callPayload = await callResponse.json();

  assert.equal(callResponse.status, 200);
  assert.equal(callPayload.result.isError, false);
  assert.equal(callPayload.result.structuredContent.repo, "sample-repo");
  assert.equal(callPayload.result.structuredContent.profile_slug, "demo-customer");
  assert.match(callPayload.result.structuredContent.summary, /Indexed/);
});

test("service hosted MCP rejects unauthenticated requests", async (t) => {
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
    new Request("http://127.0.0.1:4010/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    }),
    config,
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.match(payload.error, /unauthenticated/i);
  assert.match(
    response.headers.get("www-authenticate") ?? "",
    /resource_metadata=/i,
  );
});

test("service hosted MCP publishes OAuth discovery and exchanges an authorization code for a bearer token", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const serviceStorageRoot = path.join(workspaceRoot, "services", "api", "data");
  const previousEnv = captureEnv([
    "BE_AI_HEART_AUTH0_ISSUER",
    "BE_AI_HEART_AUTH0_CLIENT_ID",
    "BE_AI_HEART_AUTH0_CLIENT_SECRET",
    "BE_AI_HEART_AUTH0_AUDIENCE",
    "BE_AI_HEART_API_BASE_URL",
    "BE_AI_HEART_PORTAL_BASE_URL",
    "BE_AI_HEART_SERVICE_STORAGE_ROOT",
    "BE_AI_HEART_MCP_OAUTH_PROVIDER",
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
    monorepoRoot: workspaceRoot,
    serviceStorageRoot,
    portalRoot,
    adminRoot,
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
  });

  process.env.BE_AI_HEART_AUTH0_ISSUER = mockProvider.issuer;
  process.env.BE_AI_HEART_AUTH0_CLIENT_ID = "beheart-test-web";
  process.env.BE_AI_HEART_AUTH0_CLIENT_SECRET = "beheart-test-secret";
  process.env.BE_AI_HEART_AUTH0_AUDIENCE = "beheart-test-web";
  process.env.BE_AI_HEART_API_BASE_URL = serviceHost.url;
  process.env.BE_AI_HEART_PORTAL_BASE_URL = "http://127.0.0.1:3001";
  process.env.BE_AI_HEART_SERVICE_STORAGE_ROOT = serviceStorageRoot;
  process.env.BE_AI_HEART_MCP_OAUTH_PROVIDER = "auth0";

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
  ]);

  const workspaceState = await buildWorkspaceState(repoRoot);
  const bundle = generateDiagramBundle({
    workspaceState,
    task: "improve login audit flow",
  });
  const artifacts = await writeDiagramBundle(repoRoot, bundle);

  await syncRepositoryProfile({
    repoRoot,
    workspaceState,
    bundle,
    artifacts,
    slug: "demo-customer",
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  });

  const protectedResourceResponse = await fetch(
    new URL("/.well-known/oauth-protected-resource", serviceHost.url),
    {
      headers: {
        Accept: "application/json",
      },
    },
  );
  const protectedResourcePayload = await protectedResourceResponse.json();

  assert.equal(protectedResourceResponse.status, 200);
  assert.equal(protectedResourcePayload.resource, `${serviceHost.url}/api/mcp`);
  assert.ok(protectedResourcePayload.authorization_servers.includes(new URL(serviceHost.url).origin));

  const authServerResponse = await fetch(
    new URL("/.well-known/oauth-authorization-server", serviceHost.url),
    {
      headers: {
        Accept: "application/json",
      },
    },
  );
  const authServerPayload = await authServerResponse.json();

  assert.equal(authServerResponse.status, 200);
  assert.equal(authServerPayload.authorization_endpoint, `${serviceHost.url}/oauth/authorize`);
  assert.equal(authServerPayload.token_endpoint, `${serviceHost.url}/oauth/token`);

  const codeVerifier = "beheart-pkce-verifier";
  const authorizeUrl = new URL("/oauth/authorize", serviceHost.url);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", "codex-cli");
  authorizeUrl.searchParams.set("redirect_uri", "http://127.0.0.1:7777/callback");
  authorizeUrl.searchParams.set("state", "codex-state");
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", toPkceChallenge(codeVerifier));
  authorizeUrl.searchParams.set("scope", "mcp:read");

  const authorizeResponse = await fetch(authorizeUrl, { redirect: "manual" });
  const providerAuthorizeLocation = authorizeResponse.headers.get("location");

  assert.equal(authorizeResponse.status, 302);
  assert.ok(providerAuthorizeLocation);

  const approvedAuthorizeUrl = new URL(providerAuthorizeLocation);
  approvedAuthorizeUrl.searchParams.set("approve", "1");
  const providerResponse = await fetch(approvedAuthorizeUrl, { redirect: "manual" });
  const providerCallbackLocation = providerResponse.headers.get("location");

  assert.equal(providerResponse.status, 302);
  assert.ok(providerCallbackLocation);

  const serviceCallbackResponse = await fetch(providerCallbackLocation, { redirect: "manual" });
  const mcpCallbackLocation = serviceCallbackResponse.headers.get("location");

  assert.equal(serviceCallbackResponse.status, 302);
  assert.ok(mcpCallbackLocation);
  assert.match(mcpCallbackLocation, /session_token=/);

  const clientCallbackResponse = await fetch(mcpCallbackLocation, { redirect: "manual" });
  const clientRedirectLocation = clientCallbackResponse.headers.get("location");

  assert.equal(clientCallbackResponse.status, 302);
  assert.ok(clientRedirectLocation);

  const clientRedirectUrl = new URL(clientRedirectLocation);
  assert.equal(clientRedirectUrl.searchParams.get("state"), "codex-state");
  assert.ok(clientRedirectUrl.searchParams.get("code"));

  const tokenResponse = await fetch(new URL("/oauth/token", serviceHost.url), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: "codex-cli",
      redirect_uri: "http://127.0.0.1:7777/callback",
      code: clientRedirectUrl.searchParams.get("code"),
      code_verifier: codeVerifier,
    }),
  });
  const tokenPayload = await tokenResponse.json();

  assert.equal(tokenResponse.status, 200);
  assert.equal(tokenPayload.token_type, "Bearer");
  assert.ok(tokenPayload.access_token);

  const listResponse = await fetch(new URL("/api/mcp", serviceHost.url), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${tokenPayload.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }),
  });
  const listPayload = await listResponse.json();

  assert.equal(listResponse.status, 200);
  assert.deepEqual(
    listPayload.result.tools.map((tool) => tool.name),
    ["project_overview", "document_search", "context_pack"],
  );
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

function toPkceChallenge(value) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest()
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
