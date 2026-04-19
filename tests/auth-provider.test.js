import test from "node:test";
import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import {
  issueProviderWorkspaceSession,
  resolveRequestAuthContext,
  upsertWorkspaceIdentity,
} from "../services/api/src/index.js";

test("OIDC provider token exchange issues a scoped workspace session", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-oidc-"));
  const serviceStorageRoot = path.join(tempRoot, "services", "api", "data");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const publicJwk = publicKey.export({
    format: "jwk",
  });
  const jwksUrl = "https://auth.example.test/jwks";
  const jwks = {
    keys: [
      {
        ...publicJwk,
        kid: "test-key",
        alg: "RS256",
        use: "sig",
      },
    ],
  };

  const previousFetch = global.fetch;
  global.fetch = async (input) => {
    const url = String(input);
    if (url === jwksUrl) {
      return Response.json(jwks, { status: 200 });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  };
  t.after(async () => {
    global.fetch = previousFetch;
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const issuer = "https://auth.example.test";
  const token = createJwt({
    issuer,
    audience: "be-ai-heart-cli",
    claims: {
      sub: "provider-user-123",
      email: "alpha@customer-alpha.dev",
      preferred_username: "customer-alpha",
      be_ai_heart_customer_slug: "customer-alpha",
      be_ai_heart_workspaces: ["alpha-workspace"],
      roles: ["customer"],
    },
    privateKey,
  });

  await upsertWorkspaceIdentity({
    serviceStorageRoot,
    workspaceSlug: "alpha-workspace",
    customerSlug: "customer-alpha",
    profileSlug: "alpha-workspace",
    repo: "sample-repo",
    displayName: "Alpha Workspace",
    source: "test-seed",
  });

  const result = await issueProviderWorkspaceSession({
    serviceStorageRoot,
    surface: "portal",
    idToken: token,
    providerConfig: {
      issuer,
      audience: "be-ai-heart-cli",
      jwksUrl,
    },
  });
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot,
    surface: "portal",
    request: {
      nextUrl: new URL(`http://localhost/api/session?session=${result.session.session_token}`),
      headers: new Headers(),
    },
  });

  assert.equal(result.actor.actor_slug, "customer-alpha");
  assert.equal(result.actor.customer_slug, "customer-alpha");
  assert.equal(result.memberships.length, 1);
  assert.equal(result.memberships[0].workspace_slug, "alpha-workspace");
  assert.equal(authContext.actor_slug, "customer-alpha");
  assert.equal(authContext.workspace_slug, "alpha-workspace");
  assert.equal(authContext.customer_slug, "customer-alpha");
});

test("OIDC provider token exchange ignores blank workspace and customer overrides", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-oidc-"));
  const serviceStorageRoot = path.join(tempRoot, "services", "api", "data");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const publicJwk = publicKey.export({
    format: "jwk",
  });
  const jwksUrl = "https://auth.example.test/jwks-blank-overrides";
  const jwks = {
    keys: [
      {
        ...publicJwk,
        kid: "blank-override-key",
        alg: "RS256",
        use: "sig",
      },
    ],
  };

  const previousFetch = global.fetch;
  global.fetch = async (input) => {
    const url = String(input);
    if (url === jwksUrl) {
      return Response.json(jwks, { status: 200 });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  };
  t.after(async () => {
    global.fetch = previousFetch;
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const issuer = "https://auth.example.test";
  const token = createJwt({
      issuer,
      audience: "be-ai-heart-cli",
      claims: {
      sub: "provider-user-123",
      email: "alpha@customer-alpha.dev",
      preferred_username: "customer-alpha",
      be_ai_heart_customer_slug: "customer-alpha",
      be_ai_heart_workspaces: ["alpha-workspace"],
      roles: ["customer"],
    },
    privateKey,
    keyId: "blank-override-key",
  });

  await upsertWorkspaceIdentity({
    serviceStorageRoot,
    workspaceSlug: "alpha-workspace",
    customerSlug: "customer-alpha",
    profileSlug: "alpha-workspace",
    repo: "sample-repo",
    displayName: "Alpha Workspace",
    source: "test-seed",
  });

  const result = await issueProviderWorkspaceSession({
    serviceStorageRoot,
    surface: "portal",
    idToken: token,
    workspaceSlug: "",
    customerSlug: "",
    providerConfig: {
      issuer,
      audience: "be-ai-heart-cli",
      jwksUrl,
    },
  });

  assert.equal(result.actor.customer_slug, "customer-alpha");
  assert.equal(result.session.workspace_slug, "alpha-workspace");
  assert.equal(result.session.customer_slug, "customer-alpha");
});

function createJwt({ issuer, audience, claims, privateKey, keyId = "test-key" }) {
  const header = {
    alg: "RS256",
    kid: keyId,
    typ: "JWT",
  };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuer,
    aud: audience,
    iat: nowSeconds,
    exp: nowSeconds + 60 * 60,
    ...claims,
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();
  const signature = signer.sign(privateKey);

  return `${encodedHeader}.${encodedPayload}.${encodeBase64Url(signature)}`;
}

function encodeBase64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
