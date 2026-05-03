export function resolveRuntimeEnvironment(env = process.env) {
  const explicit = String(env.BE_AI_HEART_RUNTIME_ENV ?? env.BE_AI_HEART_ENV ?? "").trim().toLowerCase();
  const nodeEnv = String(env.NODE_ENV ?? "").trim().toLowerCase();
  const value = explicit || nodeEnv || "development";
  return {
    value,
    production: value === "production",
  };
}

export function assertProductionHttpConfig(config = {}, env = process.env) {
  const runtime = resolveRuntimeEnvironment(env);
  if (!runtime.production) {
    return {
      schema_version: 1,
      status: "skipped",
      runtime_environment: runtime.value,
      issues: [],
    };
  }

  const issues = [];
  requirePublicUrl(issues, "BE_AI_HEART_API_BASE_URL", env.BE_AI_HEART_API_BASE_URL);
  requirePublicUrl(issues, "BE_AI_HEART_WEBSITE_BASE_URL", env.BE_AI_HEART_WEBSITE_BASE_URL);
  requirePublicUrl(issues, "BE_AI_HEART_PORTAL_BASE_URL", env.BE_AI_HEART_PORTAL_BASE_URL);
  requirePublicUrl(issues, "BE_AI_HEART_ADMIN_BASE_URL", env.BE_AI_HEART_ADMIN_BASE_URL);

  if (String(env.BE_AI_HEART_SERVICE_STORAGE_BACKEND ?? "").trim().toLowerCase() !== "postgres") {
    issues.push("BE_AI_HEART_SERVICE_STORAGE_BACKEND must be postgres in production.");
  }
  if (!String(env.BE_AI_HEART_POSTGRES_URL ?? "").trim()) {
    issues.push("BE_AI_HEART_POSTGRES_URL is required in production.");
  }
  if (config.localDemoAuth || truthy(env.BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH)) {
    issues.push("BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH must be disabled in production.");
  }
  if (String(env.BE_AI_HEART_DEFAULT_PORTAL_SESSION ?? "").trim()) {
    issues.push("BE_AI_HEART_DEFAULT_PORTAL_SESSION must be unset in production.");
  }
  if (String(env.BE_AI_HEART_DEFAULT_ADMIN_SESSION ?? "").trim()) {
    issues.push("BE_AI_HEART_DEFAULT_ADMIN_SESSION must be unset in production.");
  }
  if (!hasConfiguredAuthProvider(env)) {
    issues.push("At least one hosted OIDC provider must be configured in production.");
  }
  if (String(env.BE_AI_HEART_PORTAL_SECRET_KEY ?? "").trim().length < 32) {
    issues.push("BE_AI_HEART_PORTAL_SECRET_KEY must be at least 32 characters in production.");
  }
  if (llmProxyEnabled(env)) {
    if (String(env.BE_AI_HEART_LLM_PROXY_SHARED_SECRET ?? "").trim().length < 32) {
      issues.push("BE_AI_HEART_LLM_PROXY_SHARED_SECRET must be at least 32 characters when the production LLM proxy is enabled.");
    }
    if (parseCsv(env.BE_AI_HEART_LLM_PROXY_ALLOWED_ORIGINS).length === 0) {
      issues.push("BE_AI_HEART_LLM_PROXY_ALLOWED_ORIGINS is required when the production LLM proxy is enabled.");
    }
  }
  if (liveBillingRequired(env) && !String(env.BE_AI_HEART_STRIPE_SECRET_KEY ?? env.STRIPE_SECRET_KEY ?? "").trim()) {
    issues.push("BE_AI_HEART_STRIPE_SECRET_KEY is required when live billing is enabled.");
  }

  if (issues.length > 0) {
    const error = new Error(`Production API configuration is incomplete: ${issues.join(" ")}`);
    error.statusCode = 500;
    error.errorCode = "PRODUCTION_CONFIG_INVALID";
    error.issues = issues;
    throw error;
  }

  return {
    schema_version: 1,
    status: "ready",
    runtime_environment: runtime.value,
    issues,
  };
}

export function resolveLlmProxySecurity(env = process.env) {
  return {
    enabled: llmProxyEnabled(env),
    sharedSecret: String(env.BE_AI_HEART_LLM_PROXY_SHARED_SECRET ?? "").trim(),
    allowedOrigins: parseCsv(env.BE_AI_HEART_LLM_PROXY_ALLOWED_ORIGINS),
  };
}

export function liveBillingRequired(env = process.env) {
  return truthy(env.BE_AI_HEART_REQUIRE_LIVE_BILLING) ||
    String(env.BE_AI_HEART_BILLING_MODE ?? "").trim().toLowerCase() === "live";
}

function requirePublicUrl(issues, envName, value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    issues.push(`${envName} is required in production.`);
    return;
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    issues.push(`${envName} must be a valid URL.`);
    return;
  }
  if (parsed.protocol !== "https:") {
    issues.push(`${envName} must use https in production.`);
  }
  if (["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
    issues.push(`${envName} must not point at loopback in production.`);
  }
}

function hasConfiguredAuthProvider(env) {
  return Boolean(
    String(env.BE_AI_HEART_AUTH0_ISSUER ?? "").trim() &&
      String(env.BE_AI_HEART_AUTH0_CLIENT_ID ?? "").trim() &&
      String(env.BE_AI_HEART_AUTH0_CLIENT_SECRET ?? "").trim(),
  ) || Boolean(
    String(env.BE_AI_HEART_CLERK_OIDC_ISSUER ?? "").trim() &&
      String(env.BE_AI_HEART_CLERK_CLIENT_ID ?? "").trim() &&
      String(env.BE_AI_HEART_CLERK_CLIENT_SECRET ?? "").trim(),
  ) || Boolean(
    String(env.BE_AI_HEART_OIDC_ISSUER ?? "").trim() &&
      String(env.BE_AI_HEART_OIDC_CLIENT_ID ?? "").trim() &&
      String(env.BE_AI_HEART_OIDC_CLIENT_SECRET ?? "").trim(),
  );
}

function llmProxyEnabled(env) {
  return String(env.BE_AI_HEART_ENABLE_LLM_PROXY ?? "1").trim().toLowerCase() !== "0";
}

function truthy(value) {
  return ["1", "true", "yes", "on", "enabled", "live"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

function parseCsv(value) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
