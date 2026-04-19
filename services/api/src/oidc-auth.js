import { createHash, randomBytes } from "node:crypto";

import { createAuthTransaction, consumeAuthTransaction, loadAuthTransaction } from "./auth-transactions.js";
import { issueProviderWorkspaceSession } from "./auth-provider.js";
import {
  normalizeBaseUrl,
  resolveAllowedReturnTo,
  resolveHostedAuthProvider,
  resolveSurfaceBaseUrls,
} from "./provider-config.js";

export async function createProviderAuthorizationRequest({
  serviceStorageRoot,
  providerId,
  surface = "portal",
  workspaceSlug,
  customerSlug,
  returnTo,
  apiBaseUrl,
} = {}) {
  const provider = resolveHostedAuthProvider(providerId, {
    apiBaseUrl,
    surface,
    returnTo,
  });
  const metadata = await loadOpenIdMetadata(provider);
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomCodeVerifier();
  const codeChallenge = toBase64Url(
    createHash("sha256").update(codeVerifier, "utf8").digest(),
  );
  const redirectUri = buildCallbackUrl(provider.id, apiBaseUrl);
  const resolvedReturnTo = resolveAllowedReturnTo({
    surface,
    returnTo: returnTo ?? provider.return_to,
  });

  await createAuthTransaction({
    serviceStorageRoot,
    state,
    providerId: provider.id,
    surface,
    returnTo: resolvedReturnTo,
    workspaceSlug,
    customerSlug,
    redirectUri,
    nonce,
    codeVerifier,
    metadata: {
      provider_id: provider.id,
      scope: provider.oauth.scope,
    },
  });

  const authorizeUrl = new URL(metadata.authorization_endpoint);
  authorizeUrl.searchParams.set("client_id", provider.oauth.client_id);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", provider.oauth.scope || "openid profile email");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  if (provider.provider_config.audience) {
    authorizeUrl.searchParams.set("audience", provider.provider_config.audience);
  }

  return {
    provider,
    authorize_url: authorizeUrl.toString(),
    state,
    return_to: resolvedReturnTo,
  };
}

export async function completeProviderAuthorization({
  serviceStorageRoot,
  providerId,
  requestUrl,
  apiBaseUrl,
} = {}) {
  const callbackUrl = toUrl(requestUrl);
  const error = callbackUrl.searchParams.get("error");
  const errorDescription = callbackUrl.searchParams.get("error_description");
  const state = callbackUrl.searchParams.get("state");

  const transaction = await loadAuthTransaction({
    serviceStorageRoot,
    state,
    providerId,
  });
  if (!transaction) {
    throw new Error("Provider auth transaction is missing or expired.");
  }

  if (error) {
    return {
      redirect_url: appendRedirectParams(transaction.return_to, {
        auth_error: error,
        auth_error_description: errorDescription ?? "",
      }),
      session: null,
      provider: resolveHostedAuthProvider(providerId, {
        apiBaseUrl,
        surface: transaction.surface,
        returnTo: transaction.return_to,
      }),
    };
  }

  const authorizationCode = callbackUrl.searchParams.get("code");
  if (!authorizationCode) {
    throw new Error("Authorization code is missing from callback.");
  }

  const provider = resolveHostedAuthProvider(providerId, {
    apiBaseUrl,
    surface: transaction.surface,
    returnTo: transaction.return_to,
  });
  const metadata = await loadOpenIdMetadata(provider);
  const tokenPayload = await exchangeAuthorizationCode({
    provider,
    metadata,
    code: authorizationCode,
    redirectUri: transaction.redirect_uri,
    codeVerifier: transaction.code_verifier,
  });
  const idToken = String(tokenPayload.id_token ?? "").trim();
  if (!idToken) {
    throw new Error("Provider token exchange did not return an id_token.");
  }

  const result = await issueProviderWorkspaceSession({
    serviceStorageRoot,
    surface: transaction.surface,
    idToken,
    workspaceSlug: transaction.workspace_slug,
    customerSlug: transaction.customer_slug,
    providerConfig: provider.provider_config,
  });

  await consumeAuthTransaction({
    serviceStorageRoot,
    state: transaction.state,
    providerId,
  });

  return {
    provider,
    transaction,
    session: result.session,
    actor: result.actor,
    redirect_url: appendRedirectParams(transaction.return_to, {
      session_token: result.session.session_token,
      workspace_slug: result.session.workspace_slug ?? "",
      customer_slug: result.session.customer_slug ?? "",
      actor_slug: result.actor.actor_slug ?? "",
      auth_provider: provider.id,
      surface: transaction.surface,
    }),
  };
}

export function buildDefaultPortalAuthLinks({ apiBaseUrl } = {}) {
  const baseUrls = resolveSurfaceBaseUrls();
  const resolvedApiBaseUrl = normalizeBaseUrl(apiBaseUrl ?? baseUrls.api);
  const returnTo = new URL("/auth/complete", baseUrls.portal).toString();

  return {
    sign_in_url: new URL(
      `/api/auth/providers?surface=portal&return_to=${encodeURIComponent(returnTo)}`,
      resolvedApiBaseUrl,
    ).toString(),
    portal_return_to: returnTo,
  };
}

async function loadOpenIdMetadata(provider) {
  const openIdConfigurationUrl =
    provider.provider_config.openIdConfigurationUrl ??
    process.env[`BE_AI_HEART_${provider.id.toUpperCase()}_OPENID_CONFIG_URL`] ??
    `${String(provider.provider_config.issuer ?? "").replace(/\/+$/, "")}/.well-known/openid-configuration`;
  if (!openIdConfigurationUrl || !provider.provider_config.issuer) {
    throw new Error(`OIDC issuer is not configured for provider ${provider.id}.`);
  }

  const response = await fetch(openIdConfigurationUrl, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to load OpenID configuration for ${provider.id}: ${response.status}`);
  }

  return response.json();
}

async function exchangeAuthorizationCode({
  provider,
  metadata,
  code,
  redirectUri,
  codeVerifier,
} = {}) {
  const tokenEndpoint = String(metadata?.token_endpoint ?? "").trim();
  if (!tokenEndpoint) {
    throw new Error(`OIDC token endpoint is missing for provider ${provider.id}.`);
  }

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", provider.oauth.client_id);
  body.set("redirect_uri", redirectUri);
  body.set("code", code);
  body.set("code_verifier", codeVerifier);
  if (provider.oauth.client_secret) {
    body.set("client_secret", provider.oauth.client_secret);
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error_description ||
        payload?.error ||
        `Provider code exchange failed with status ${response.status}.`,
    );
  }

  return payload;
}

function buildCallbackUrl(providerId, apiBaseUrl) {
  const resolvedApiBaseUrl = normalizeBaseUrl(
    apiBaseUrl ?? process.env.BE_AI_HEART_API_BASE_URL ?? resolveSurfaceBaseUrls().api,
  );
  return new URL(`/auth/callback/${sanitizeSlug(providerId)}`, resolvedApiBaseUrl).toString();
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
  if (value instanceof URL) {
    return new URL(value.toString());
  }

  return new URL(
    String(value ?? ""),
    process.env.BE_AI_HEART_PORTAL_BASE_URL ?? resolveSurfaceBaseUrls().portal,
  );
}

function randomToken() {
  return toBase64Url(randomBytes(32));
}

function randomCodeVerifier() {
  return toBase64Url(randomBytes(64));
}

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
