import { createPublicKey, verify as verifySignature } from "node:crypto";
import { replaceActorMemberships, upsertActor } from "./access.js";
import { issueWorkspaceSession } from "./session.js";

const JSON_WEB_KEY_SET_CACHE = new Map();
const OPENID_CONFIGURATION_CACHE = new Map();

export async function issueProviderWorkspaceSession({
  serviceStorageRoot,
  surface,
  idToken,
  workspaceSlug,
  customerSlug,
  providerConfig,
} = {}) {
  if (!idToken) {
    throw new Error("idToken is required.");
  }

  const config = resolveProviderConfig(providerConfig);
  const verified = await verifyProviderToken({
    idToken,
    providerConfig: config,
  });
  const requestedWorkspaceSlug = normalizeOptionalSlug(workspaceSlug);
  const requestedCustomerSlug = normalizeOptionalSlug(customerSlug);
  const actor = mapClaimsToActor({
    claims: verified.claims,
    surface,
    providerConfig: config,
    customerSlug: requestedCustomerSlug,
  });
  if (surface === "admin" && actor.role !== "owner") {
    throw new Error("Provider identity is not allowed to open an admin session.");
  }
  const memberships = mapClaimsToMemberships({
    claims: verified.claims,
    actorSlug: actor.actor_slug,
    providerConfig: config,
  });

  await upsertActor({
    serviceStorageRoot,
    actor,
  });
  await replaceActorMemberships({
    serviceStorageRoot,
    actorSlug: actor.actor_slug,
    memberships,
  });

  const session = await issueWorkspaceSession({
    serviceStorageRoot,
    actorSlug: actor.actor_slug,
    surface,
    workspaceSlug:
      requestedWorkspaceSlug ??
      memberships[0]?.workspace_slug ??
      deriveWorkspaceSlugFromClaims(verified.claims, config) ??
      "",
    customerSlug: requestedCustomerSlug ?? actor.customer_slug,
    metadata: {
      provider: {
        name: config.providerName,
        issuer: config.issuer,
        subject: String(verified.claims.sub ?? ""),
      },
    },
  });

  return {
    actor,
    memberships,
    claims: verified.claims,
    session,
  };
}

export async function verifyProviderToken({ idToken, providerConfig } = {}) {
  const config = resolveProviderConfig(providerConfig);
  const token = String(idToken ?? "").trim();
  if (!token) {
    throw new Error("Provider token is required.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid JWT format.");
  }

  const header = JSON.parse(decodeBase64UrlToString(encodedHeader));
  const claims = JSON.parse(decodeBase64UrlToString(encodedPayload));
  if (header.alg !== "RS256") {
    throw new Error(`Unsupported JWT algorithm: ${header.alg ?? "unknown"}`);
  }

  validateClaims(claims, config);
  const jwks = await loadJsonWebKeySet(config);
  const jwk = selectJsonWebKey(jwks, header);
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const valid = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8"),
    publicKey,
    decodeBase64UrlToBuffer(encodedSignature),
  );
  if (!valid) {
    throw new Error("Provider token signature is invalid.");
  }

  return {
    header,
    claims,
  };
}

export function resolveProviderConfig(overrides = {}) {
  const issuer = overrides.issuer ?? process.env.BE_AI_HEART_OIDC_ISSUER ?? "";
  const providerName =
    overrides.providerName ??
    process.env.BE_AI_HEART_AUTH_PROVIDER_NAME ??
    (issuer ? new URL(issuer).hostname : "oidc");
  const audience =
    overrides.audience ??
    process.env.BE_AI_HEART_OIDC_AUDIENCE ??
    process.env.BE_AI_HEART_OIDC_CLIENT_ID ??
    "";

  return {
    providerName,
    issuer,
    audience,
    jwksUrl: overrides.jwksUrl ?? process.env.BE_AI_HEART_OIDC_JWKS_URL ?? "",
    openIdConfigurationUrl:
      overrides.openIdConfigurationUrl ?? process.env.BE_AI_HEART_OIDC_OPENID_CONFIG_URL ?? "",
    actorClaim: overrides.actorClaim ?? process.env.BE_AI_HEART_OIDC_ACTOR_CLAIM ?? "preferred_username",
    customerClaim: overrides.customerClaim ?? process.env.BE_AI_HEART_OIDC_CUSTOMER_CLAIM ?? "be_ai_heart_customer_slug",
    workspaceClaim:
      overrides.workspaceClaim ?? process.env.BE_AI_HEART_OIDC_WORKSPACES_CLAIM ?? "be_ai_heart_workspaces",
    roleClaim: overrides.roleClaim ?? process.env.BE_AI_HEART_OIDC_ROLE_CLAIM ?? "roles",
    emailClaim: overrides.emailClaim ?? process.env.BE_AI_HEART_OIDC_EMAIL_CLAIM ?? "email",
  };
}

async function loadJsonWebKeySet(config) {
  const jwksUrl = await resolveJwksUrl(config);
  if (JSON_WEB_KEY_SET_CACHE.has(jwksUrl)) {
    return JSON_WEB_KEY_SET_CACHE.get(jwksUrl);
  }

  const response = await fetch(jwksUrl, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to load JWKS from ${jwksUrl}: ${response.status}`);
  }

  const payload = await response.json();
  JSON_WEB_KEY_SET_CACHE.set(jwksUrl, payload);
  return payload;
}

async function resolveJwksUrl(config) {
  if (config.jwksUrl) {
    return config.jwksUrl;
  }

  const openIdConfigurationUrl =
    config.openIdConfigurationUrl ||
    `${String(config.issuer ?? "").replace(/\/+$/, "")}/.well-known/openid-configuration`;
  if (OPENID_CONFIGURATION_CACHE.has(openIdConfigurationUrl)) {
    return OPENID_CONFIGURATION_CACHE.get(openIdConfigurationUrl);
  }

  const response = await fetch(openIdConfigurationUrl, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to load OpenID configuration from ${openIdConfigurationUrl}: ${response.status}`);
  }

  const payload = await response.json();
  const jwksUrl = String(payload.jwks_uri ?? "").trim();
  if (!jwksUrl) {
    throw new Error("OpenID configuration did not contain jwks_uri.");
  }

  OPENID_CONFIGURATION_CACHE.set(openIdConfigurationUrl, jwksUrl);
  return jwksUrl;
}

function selectJsonWebKey(jwks, header) {
  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  const match =
    keys.find((key) => key.kid === header.kid && key.kty === "RSA") ??
    keys.find((key) => key.kty === "RSA");
  if (!match) {
    throw new Error("No matching RSA key found in JWKS.");
  }

  return {
    ...match,
    ext: true,
  };
}

function validateClaims(claims, config) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (config.issuer && claims.iss !== config.issuer) {
    throw new Error("Provider token issuer did not match expected issuer.");
  }

  if (config.audience) {
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(config.audience)) {
      throw new Error("Provider token audience did not match expected audience.");
    }
  }

  if (claims.exp && Number(claims.exp) < nowSeconds) {
    throw new Error("Provider token is expired.");
  }

  if (claims.nbf && Number(claims.nbf) > nowSeconds) {
    throw new Error("Provider token is not yet valid.");
  }
}

function mapClaimsToActor({ claims, surface, providerConfig, customerSlug } = {}) {
  const roles = extractRoles(claims, providerConfig.roleClaim);
  const role = roles.some((entry) => ["owner", "admin", "be-ai-heart:owner"].includes(entry))
    ? "owner"
    : "customer";
  const actorSlug = sanitizeSlug(
    claims.be_ai_heart_actor_slug ??
      claims[providerConfig.actorClaim] ??
      claims[providerConfig.emailClaim] ??
      claims.sub ??
      `${providerConfig.providerName}-actor`,
  );
  const derivedCustomerSlug = sanitizeSlug(
    customerSlug ??
      claims[providerConfig.customerClaim] ??
      deriveCustomerSlugFromEmail(claims[providerConfig.emailClaim]) ??
      actorSlug,
  );
  const workspaceScopes = normalizeArray(claims[providerConfig.workspaceClaim]).map((value) => sanitizeSlug(value));

  return {
    actor_slug: actorSlug,
    surface: surface ?? "portal",
    role,
    access_mode: role === "owner" ? "all" : "memberships",
    customer_slug: derivedCustomerSlug,
    workspace_scopes: workspaceScopes,
    auth_provider: providerConfig.providerName,
    provider_subject: String(claims.sub ?? ""),
    email: String(claims[providerConfig.emailClaim] ?? ""),
  };
}

function mapClaimsToMemberships({ claims, actorSlug, providerConfig } = {}) {
  return normalizeArray(claims[providerConfig.workspaceClaim]).map((workspaceSlug) => ({
    actor_slug: actorSlug,
    workspace_slug: sanitizeSlug(workspaceSlug),
    source: providerConfig.providerName,
  }));
}

function deriveWorkspaceSlugFromClaims(claims, providerConfig) {
  return sanitizeSlug(normalizeArray(claims[providerConfig.workspaceClaim])[0] ?? "");
}

function deriveCustomerSlugFromEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    return "";
  }

  const domain = email.split("@")[1];
  return sanitizeSlug(domain.replace(/\.[a-z0-9]+$/i, ""));
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function extractRoles(claims, roleClaim) {
  const directRoles = normalizeArray(claims?.[roleClaim]);
  if (directRoles.length > 0) {
    return directRoles.map((entry) => String(entry).trim().toLowerCase());
  }

  return normalizeArray(claims?.role).map((entry) => String(entry).trim().toLowerCase());
}

function decodeBase64UrlToString(value) {
  return decodeBase64UrlToBuffer(value).toString("utf8");
}

function decodeBase64UrlToBuffer(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64");
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeOptionalSlug(value) {
  const sanitized = sanitizeSlug(value);
  return sanitized || undefined;
}
