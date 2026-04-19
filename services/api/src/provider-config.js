const DEFAULT_LOCAL_BASE_URLS = Object.freeze({
  website: "http://127.0.0.1:3000",
  portal: "http://127.0.0.1:3001",
  admin: "http://127.0.0.1:3002",
  api: "http://127.0.0.1:4010",
});

export function listConfiguredAuthProviders({
  apiBaseUrl,
  surface = "portal",
  returnTo,
} = {}) {
  const providers = buildConfiguredAuthProviders({ apiBaseUrl, surface, returnTo }).map(
    toPublicProviderDefinition,
  );

  return {
    providers,
    surface: sanitizeSlug(surface || "portal"),
    api_base_url: normalizeBaseUrl(apiBaseUrl ?? process.env.BE_AI_HEART_API_BASE_URL ?? DEFAULT_LOCAL_BASE_URLS.api),
  };
}

export function resolveHostedAuthProvider(
  providerId,
  {
    apiBaseUrl,
    surface = "portal",
    returnTo,
  } = {},
) {
  const safeProviderId = sanitizeSlug(providerId ?? "");
  const providers = buildConfiguredAuthProviders({
    apiBaseUrl,
    surface,
    returnTo,
  });
  const provider = providers.find((entry) => entry.id === safeProviderId);
  if (!provider) {
    throw new Error(`Auth provider is not configured: ${providerId}`);
  }

  return provider;
}

function buildConfiguredAuthProviders({ apiBaseUrl, surface = "portal", returnTo } = {}) {
  return [
    buildAuth0ProviderDefinition({ apiBaseUrl, surface, returnTo }),
    buildClerkProviderDefinition({ apiBaseUrl, surface, returnTo }),
    buildGenericOidcProviderDefinition({ apiBaseUrl, surface, returnTo }),
  ].filter((provider) => provider.enabled);
}

export function resolveSurfaceBaseUrls() {
  return {
    website: normalizeBaseUrl(
      process.env.BE_AI_HEART_WEBSITE_BASE_URL ?? DEFAULT_LOCAL_BASE_URLS.website,
    ),
    portal: normalizeBaseUrl(
      process.env.BE_AI_HEART_PORTAL_BASE_URL ?? DEFAULT_LOCAL_BASE_URLS.portal,
    ),
    admin: normalizeBaseUrl(
      process.env.BE_AI_HEART_ADMIN_BASE_URL ?? DEFAULT_LOCAL_BASE_URLS.admin,
    ),
    api: normalizeBaseUrl(
      process.env.BE_AI_HEART_API_BASE_URL ?? DEFAULT_LOCAL_BASE_URLS.api,
    ),
  };
}

export function resolveAllowedReturnTo({
  surface = "portal",
  returnTo,
} = {}) {
  const baseUrls = resolveSurfaceBaseUrls();
  const safeSurface = sanitizeSlug(surface || "portal");
  const fallbackBaseUrl =
    safeSurface === "admin" ? baseUrls.admin : safeSurface === "website" ? baseUrls.website : baseUrls.portal;
  const fallbackPath = safeSurface === "admin" ? "/auth/complete" : "/auth/complete";
  const fallbackUrl = new URL(fallbackPath, fallbackBaseUrl).toString();

  const requestedReturnTo = String(returnTo ?? "").trim();
  if (!requestedReturnTo) {
    return fallbackUrl;
  }

  let candidateUrl;
  try {
    candidateUrl = new URL(requestedReturnTo, fallbackBaseUrl);
  } catch {
    return fallbackUrl;
  }

  const allowedOrigins = new Set(Object.values(baseUrls).map((value) => new URL(value).origin));
  if (!allowedOrigins.has(candidateUrl.origin)) {
    return fallbackUrl;
  }

  return candidateUrl.toString();
}

export function normalizeBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  return raw.endsWith("/") ? raw : `${raw}/`;
}

function buildAuth0ProviderDefinition({ apiBaseUrl, surface, returnTo } = {}) {
  const issuer = process.env.BE_AI_HEART_AUTH0_ISSUER ?? "";
  const clientId = process.env.BE_AI_HEART_AUTH0_CLIENT_ID ?? "";
  const clientSecret = process.env.BE_AI_HEART_AUTH0_CLIENT_SECRET ?? "";
  const audience =
    process.env.BE_AI_HEART_AUTH0_AUDIENCE ??
    process.env.BE_AI_HEART_OIDC_AUDIENCE ??
    "";

  return createProviderDefinition({
    id: "auth0",
    label: "Continue with Auth0",
    description: "Universal Login via Auth0 authorization code flow.",
    kind: "oidc",
    enabled: Boolean(issuer && clientId),
    issuer,
    clientId,
    clientSecret,
    audience,
    scope: process.env.BE_AI_HEART_AUTH0_SCOPE ?? "openid profile email",
    actorClaim: process.env.BE_AI_HEART_AUTH0_ACTOR_CLAIM ?? "email",
    customerClaim: process.env.BE_AI_HEART_AUTH0_CUSTOMER_CLAIM ?? "be_ai_heart_customer_slug",
    workspaceClaim: process.env.BE_AI_HEART_AUTH0_WORKSPACE_CLAIM ?? "be_ai_heart_workspaces",
    roleClaim: process.env.BE_AI_HEART_AUTH0_ROLE_CLAIM ?? "roles",
    emailClaim: process.env.BE_AI_HEART_AUTH0_EMAIL_CLAIM ?? "email",
    apiBaseUrl,
    surface,
    returnTo,
  });
}

function buildClerkProviderDefinition({ apiBaseUrl, surface, returnTo } = {}) {
  const issuer =
    process.env.BE_AI_HEART_CLERK_OIDC_ISSUER ??
    process.env.BE_AI_HEART_CLERK_ISSUER ??
    "";
  const clientId = process.env.BE_AI_HEART_CLERK_CLIENT_ID ?? "";
  const clientSecret = process.env.BE_AI_HEART_CLERK_CLIENT_SECRET ?? "";

  return createProviderDefinition({
    id: "clerk",
    label: "Continue with Clerk",
    description: "Clerk OAuth/OIDC login for portal access.",
    kind: "oidc",
    enabled: Boolean(issuer && clientId),
    issuer,
    clientId,
    clientSecret,
    audience: process.env.BE_AI_HEART_CLERK_AUDIENCE ?? clientId,
    scope: process.env.BE_AI_HEART_CLERK_SCOPE ?? "openid profile email",
    actorClaim: process.env.BE_AI_HEART_CLERK_ACTOR_CLAIM ?? "email",
    customerClaim: process.env.BE_AI_HEART_CLERK_CUSTOMER_CLAIM ?? "be_ai_heart_customer_slug",
    workspaceClaim: process.env.BE_AI_HEART_CLERK_WORKSPACE_CLAIM ?? "be_ai_heart_workspaces",
    roleClaim: process.env.BE_AI_HEART_CLERK_ROLE_CLAIM ?? "roles",
    emailClaim: process.env.BE_AI_HEART_CLERK_EMAIL_CLAIM ?? "email",
    apiBaseUrl,
    surface,
    returnTo,
  });
}

function buildGenericOidcProviderDefinition({ apiBaseUrl, surface, returnTo } = {}) {
  const issuer = process.env.BE_AI_HEART_OIDC_ISSUER ?? "";
  const clientId = process.env.BE_AI_HEART_OIDC_CLIENT_ID ?? process.env.BE_AI_HEART_OIDC_AUDIENCE ?? "";
  const clientSecret = process.env.BE_AI_HEART_OIDC_CLIENT_SECRET ?? "";

  return createProviderDefinition({
    id: "oidc",
    label: "Continue with OIDC",
    description: "Generic enterprise OIDC provider.",
    kind: "oidc",
    enabled: Boolean(issuer && clientId),
    issuer,
    clientId,
    clientSecret,
    audience: process.env.BE_AI_HEART_OIDC_AUDIENCE ?? clientId,
    scope: process.env.BE_AI_HEART_OIDC_SCOPE ?? "openid profile email",
    actorClaim: process.env.BE_AI_HEART_OIDC_ACTOR_CLAIM ?? "preferred_username",
    customerClaim: process.env.BE_AI_HEART_OIDC_CUSTOMER_CLAIM ?? "be_ai_heart_customer_slug",
    workspaceClaim: process.env.BE_AI_HEART_OIDC_WORKSPACES_CLAIM ?? "be_ai_heart_workspaces",
    roleClaim: process.env.BE_AI_HEART_OIDC_ROLE_CLAIM ?? "roles",
    emailClaim: process.env.BE_AI_HEART_OIDC_EMAIL_CLAIM ?? "email",
    apiBaseUrl,
    surface,
    returnTo,
  });
}

function createProviderDefinition({
  id,
  label,
  description,
  kind,
  enabled,
  issuer,
  clientId,
  clientSecret,
  audience,
  scope,
  actorClaim,
  customerClaim,
  workspaceClaim,
  roleClaim,
  emailClaim,
  apiBaseUrl,
  surface,
  returnTo,
} = {}) {
  const safeId = sanitizeSlug(id ?? "");
  const baseUrls = resolveSurfaceBaseUrls();
  const resolvedApiBaseUrl = normalizeBaseUrl(apiBaseUrl ?? baseUrls.api);
  const resolvedReturnTo = resolveAllowedReturnTo({
    surface,
    returnTo,
  });

  return {
    id: safeId,
    label: String(label ?? safeId),
    description: String(description ?? ""),
    kind: kind ?? "oidc",
    enabled: Boolean(enabled),
    authorize_url: new URL(
      `/auth/authorize/${safeId}?surface=${encodeURIComponent(sanitizeSlug(surface || "portal"))}&return_to=${encodeURIComponent(resolvedReturnTo)}`,
      resolvedApiBaseUrl,
    ).toString(),
    provider_config: {
      providerName: safeId,
      issuer: String(issuer ?? "").trim(),
      audience: String(audience ?? "").trim(),
      actorClaim,
      customerClaim,
      workspaceClaim,
      roleClaim,
      emailClaim,
    },
    oauth: {
      client_id: String(clientId ?? "").trim(),
      client_secret: String(clientSecret ?? "").trim(),
      scope: String(scope ?? "openid profile email").trim(),
    },
    return_to: resolvedReturnTo,
  };
}

function toPublicProviderDefinition(provider) {
  return {
    id: provider.id,
    label: provider.label,
    description: provider.description,
    kind: provider.kind,
    enabled: provider.enabled,
    authorize_url: provider.authorize_url,
    provider_config: {
      ...provider.provider_config,
    },
    return_to: provider.return_to,
  };
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
