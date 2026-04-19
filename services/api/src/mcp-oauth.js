import { createHash, randomBytes } from "node:crypto";

import { withServiceDatabase } from "./database.js";
import { createProviderAuthorizationRequest } from "./oidc-auth.js";
import { listConfiguredAuthProviders, normalizeBaseUrl } from "./provider-config.js";

const DEFAULT_SCOPE = "mcp:read";

export function buildMcpAuthorizationServerMetadata({ apiBaseUrl } = {}) {
  const issuer = resolveIssuer(apiBaseUrl);

  return {
    issuer,
    authorization_endpoint: new URL("/oauth/authorize", issuer).toString(),
    token_endpoint: new URL("/oauth/token", issuer).toString(),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [DEFAULT_SCOPE],
  };
}

export function buildMcpProtectedResourceMetadata({ apiBaseUrl, surface = "portal" } = {}) {
  const issuer = resolveIssuer(apiBaseUrl);

  return {
    resource: buildMcpEndpointUrl(apiBaseUrl, surface),
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: [DEFAULT_SCOPE],
  };
}

export function createMcpUnauthorizedResponse({ apiBaseUrl, surface = "portal" } = {}) {
  const metadataUrl = buildProtectedResourceMetadataUrl(apiBaseUrl, surface);
  return new Response(
    JSON.stringify(
      {
        error: "Unauthenticated request.",
      },
      null,
      2,
    ),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer realm="be-ai-heart-mcp", resource_metadata="${metadataUrl}"`,
      },
    },
  );
}

export async function createMcpAuthorizationRequest({
  serviceStorageRoot,
  apiBaseUrl,
  providerId,
  responseType = "code",
  surface = "portal",
  workspaceSlug,
  customerSlug,
  clientId,
  redirectUri,
  state,
  codeChallenge,
  codeChallengeMethod = "S256",
  scope = DEFAULT_SCOPE,
} = {}) {
  if (responseType !== "code") {
    throw new Error("Only response_type=code is supported.");
  }
  const safeRedirectUri = normalizeRedirectUri(redirectUri);
  if (!clientId || !redirectUri || !state || !codeChallenge) {
    throw new Error("client_id, redirect_uri, state, and code_challenge are required.");
  }
  if (codeChallengeMethod !== "S256") {
    throw new Error("Only S256 PKCE code challenges are supported.");
  }

  const resolvedProviderId = resolveMcpProviderId({
    apiBaseUrl,
    providerId,
    surface,
  });
  const transaction = await createMcpOAuthTransaction({
    serviceStorageRoot,
    providerId: resolvedProviderId,
    surface,
    clientId,
    redirectUri: safeRedirectUri,
    state,
    scope: scope || DEFAULT_SCOPE,
    codeChallenge,
    codeChallengeMethod,
  });

  const providerRequest = await createProviderAuthorizationRequest({
    serviceStorageRoot,
    providerId: resolvedProviderId,
    surface,
    workspaceSlug,
    customerSlug,
    returnTo: buildMcpCallbackUrl(apiBaseUrl, transaction.transaction_id),
    apiBaseUrl,
  });

  return {
    provider_id: resolvedProviderId,
    transaction_id: transaction.transaction_id,
    authorize_url: providerRequest.authorize_url,
  };
}

export async function completeMcpAuthorization({
  serviceStorageRoot,
  requestUrl,
} = {}) {
  const callbackUrl = toUrl(requestUrl);
  const transactionId = String(callbackUrl.searchParams.get("tx") ?? "").trim();
  if (!transactionId) {
    throw new Error("MCP OAuth callback is missing its transaction id.");
  }

  const transaction = await loadMcpOAuthTransaction({
    serviceStorageRoot,
    transactionId,
  });
  if (!transaction) {
    throw new Error("MCP OAuth transaction is missing or expired.");
  }

  const authError = callbackUrl.searchParams.get("auth_error") ?? callbackUrl.searchParams.get("error");
  if (authError) {
    return {
      redirect_url: appendRedirectParams(transaction.redirect_uri, {
        error: "access_denied",
        error_description:
          callbackUrl.searchParams.get("auth_error_description") ??
          callbackUrl.searchParams.get("error_description") ??
          authError,
        state: transaction.state,
      }),
    };
  }

  const sessionToken = String(callbackUrl.searchParams.get("session_token") ?? "").trim();
  if (!sessionToken) {
    throw new Error("MCP OAuth callback completed without issuing a BeHeart session token.");
  }

  const authorizationCode = await completeMcpOAuthTransaction({
    serviceStorageRoot,
    transactionId,
    sessionToken,
  });

  return {
    redirect_url: appendRedirectParams(transaction.redirect_uri, {
      code: authorizationCode,
      state: transaction.state,
    }),
  };
}

export async function exchangeMcpAuthorizationCode({
  serviceStorageRoot,
  code,
  clientId,
  redirectUri,
  codeVerifier,
} = {}) {
  if (!code || !clientId || !redirectUri || !codeVerifier) {
    throw new Error("code, client_id, redirect_uri, and code_verifier are required.");
  }
  const safeRedirectUri = normalizeRedirectUri(redirectUri);

  const transaction = await consumeMcpOAuthAuthorizationCode({
    serviceStorageRoot,
    authorizationCode: code,
    clientId,
    redirectUri: safeRedirectUri,
    codeVerifier,
  });
  if (!transaction) {
    throw new Error("Authorization code is invalid or expired.");
  }

  return {
    access_token: transaction.session_token,
    token_type: "Bearer",
    expires_in: secondsUntil(transaction.expires_at),
    scope: transaction.scope || DEFAULT_SCOPE,
  };
}

function resolveMcpProviderId({ apiBaseUrl, providerId, surface = "portal" } = {}) {
  const explicitProviderId = String(
    providerId ?? process.env.BE_AI_HEART_MCP_OAUTH_PROVIDER ?? "",
  ).trim();
  if (explicitProviderId) {
    return explicitProviderId;
  }

  const configured = listConfiguredAuthProviders({ apiBaseUrl, surface }).providers ?? [];
  if (configured.length === 0) {
    throw new Error("No hosted auth providers are configured for MCP login.");
  }

  return configured[0].id;
}

function resolveIssuer(apiBaseUrl) {
  return new URL(normalizeBaseUrl(apiBaseUrl ?? "http://127.0.0.1:4010")).origin;
}

function buildMcpEndpointUrl(apiBaseUrl, surface) {
  const baseUrl = normalizeBaseUrl(apiBaseUrl ?? "http://127.0.0.1:4010");
  const pathname = surface === "admin" ? "/api/admin/mcp" : "/api/mcp";
  return new URL(pathname, baseUrl).toString();
}

function buildProtectedResourceMetadataUrl(apiBaseUrl, surface) {
  const baseUrl = normalizeBaseUrl(apiBaseUrl ?? "http://127.0.0.1:4010");
  const pathname =
    surface === "admin"
      ? "/api/admin/.well-known/oauth-protected-resource"
      : "/.well-known/oauth-protected-resource";
  return new URL(pathname, baseUrl).toString();
}

function buildMcpCallbackUrl(apiBaseUrl, transactionId) {
  const baseUrl = normalizeBaseUrl(apiBaseUrl ?? "http://127.0.0.1:4010");
  const callbackUrl = new URL("/oauth/callback/mcp", baseUrl);
  callbackUrl.searchParams.set("tx", transactionId);
  return callbackUrl.toString();
}

async function createMcpOAuthTransaction({
  serviceStorageRoot,
  providerId,
  surface,
  clientId,
  redirectUri,
  state,
  scope,
  codeChallenge,
  codeChallengeMethod,
} = {}) {
  const createdAt = new Date().toISOString();
  const payload = {
    schema_version: 1,
    transaction_id: randomToken(),
    authorization_code: "",
    provider_id: String(providerId ?? "").trim(),
    surface: String(surface ?? "portal").trim(),
    client_id: String(clientId ?? "").trim(),
    redirect_uri: String(redirectUri ?? "").trim(),
    state: String(state ?? "").trim(),
    scope: String(scope ?? DEFAULT_SCOPE).trim(),
    code_challenge: String(codeChallenge ?? "").trim(),
    code_challenge_method: String(codeChallengeMethod ?? "S256").trim(),
    session_token: "",
    created_at: createdAt,
    expires_at: addMinutes(createdAt, 15),
    consumed_at: "",
  };
  if (
    !payload.provider_id ||
    !payload.client_id ||
    !payload.redirect_uri ||
    !payload.state ||
    !payload.code_challenge
  ) {
    throw new Error("MCP OAuth transaction fields are incomplete.");
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO mcp_oauth_transactions (
          transaction_id,
          authorization_code,
          provider_id,
          surface,
          client_id,
          redirect_uri,
          state,
          scope,
          code_challenge,
          code_challenge_method,
          session_token,
          created_at,
          expires_at,
          consumed_at,
          payload_json
        )
        VALUES (
          :transaction_id,
          NULL,
          :provider_id,
          :surface,
          :client_id,
          :redirect_uri,
          :state,
          :scope,
          :code_challenge,
          :code_challenge_method,
          NULL,
          :created_at,
          :expires_at,
          NULL,
          :payload_json
        )
      `)
      .run({
        transaction_id: payload.transaction_id,
        provider_id: payload.provider_id,
        surface: payload.surface,
        client_id: payload.client_id,
        redirect_uri: payload.redirect_uri,
        state: payload.state,
        scope: payload.scope,
        code_challenge: payload.code_challenge,
        code_challenge_method: payload.code_challenge_method,
        created_at: payload.created_at,
        expires_at: payload.expires_at,
        payload_json: JSON.stringify(payload),
      });
  });

  return payload;
}

async function loadMcpOAuthTransaction({
  serviceStorageRoot,
  transactionId,
  authorizationCode,
} = {}) {
  await cleanupExpiredMcpOAuthTransactions({ serviceStorageRoot });
  if (!transactionId && !authorizationCode) {
    return null;
  }

  const payload = withServiceDatabase(serviceStorageRoot, (database) => {
    const row = transactionId
      ? database
          .prepare("SELECT payload_json FROM mcp_oauth_transactions WHERE transaction_id = ?")
          .get(String(transactionId))
      : database
          .prepare("SELECT payload_json FROM mcp_oauth_transactions WHERE authorization_code = ?")
          .get(String(authorizationCode));
    return parsePayload(row?.payload_json, null);
  });

  if (!payload) {
    return null;
  }

  if (payload.expires_at && payload.expires_at < new Date().toISOString()) {
    await deleteMcpOAuthTransaction({
      serviceStorageRoot,
      transactionId: payload.transaction_id,
    });
    return null;
  }

  return payload;
}

async function completeMcpOAuthTransaction({
  serviceStorageRoot,
  transactionId,
  sessionToken,
} = {}) {
  const transaction = await loadMcpOAuthTransaction({
    serviceStorageRoot,
    transactionId,
  });
  if (!transaction) {
    throw new Error("MCP OAuth transaction is missing or expired.");
  }

  const authorizationCode = randomToken();
  const nextPayload = {
    ...transaction,
    authorization_code: authorizationCode,
    session_token: String(sessionToken ?? "").trim(),
  };

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        UPDATE mcp_oauth_transactions
        SET authorization_code = :authorization_code,
            session_token = :session_token,
            payload_json = :payload_json
        WHERE transaction_id = :transaction_id
      `)
      .run({
        transaction_id: nextPayload.transaction_id,
        authorization_code: nextPayload.authorization_code,
        session_token: nextPayload.session_token,
        payload_json: JSON.stringify(nextPayload),
      });
  });

  return authorizationCode;
}

async function consumeMcpOAuthAuthorizationCode({
  serviceStorageRoot,
  authorizationCode,
  clientId,
  redirectUri,
  codeVerifier,
} = {}) {
  const transaction = await loadMcpOAuthTransaction({
    serviceStorageRoot,
    authorizationCode,
  });
  if (!transaction || transaction.consumed_at) {
    return null;
  }
  if (transaction.client_id !== String(clientId ?? "").trim()) {
    return null;
  }
  if (transaction.redirect_uri !== String(redirectUri ?? "").trim()) {
    return null;
  }
  if (!verifyPkce(transaction.code_challenge, codeVerifier)) {
    return null;
  }

  const consumedAt = new Date().toISOString();
  const nextPayload = {
    ...transaction,
    consumed_at: consumedAt,
  };

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        UPDATE mcp_oauth_transactions
        SET consumed_at = :consumed_at,
            payload_json = :payload_json
        WHERE transaction_id = :transaction_id
      `)
      .run({
        transaction_id: nextPayload.transaction_id,
        consumed_at: consumedAt,
        payload_json: JSON.stringify(nextPayload),
      });
  });

  return nextPayload;
}

async function cleanupExpiredMcpOAuthTransactions({ serviceStorageRoot } = {}) {
  const now = new Date().toISOString();
  withServiceDatabase(serviceStorageRoot, (database) => {
    database.prepare("DELETE FROM mcp_oauth_transactions WHERE expires_at < ?").run(now);
  });
}

async function deleteMcpOAuthTransaction({ serviceStorageRoot, transactionId } = {}) {
  if (!transactionId) {
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database.prepare("DELETE FROM mcp_oauth_transactions WHERE transaction_id = ?").run(String(transactionId));
  });
}

function verifyPkce(expectedCodeChallenge, codeVerifier) {
  const calculated = toBase64Url(
    createHash("sha256").update(String(codeVerifier ?? ""), "utf8").digest(),
  );
  return calculated === String(expectedCodeChallenge ?? "").trim();
}

function secondsUntil(expiresAt) {
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
}

function appendRedirectParams(target, params) {
  const url = toUrl(target);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function toUrl(value) {
  return value instanceof URL ? new URL(value.toString()) : new URL(String(value ?? ""));
}

function normalizeRedirectUri(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("redirect_uri must use http or https.");
    }

    return parsed.toString();
  } catch {
    throw new Error("redirect_uri must be an absolute http or https URL.");
  }
}

function addMinutes(isoTime, minutes) {
  const date = new Date(isoTime);
  date.setMinutes(date.getMinutes() + Number(minutes || 0));
  return date.toISOString();
}

function randomToken() {
  return toBase64Url(randomBytes(32));
}

function toBase64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parsePayload(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
