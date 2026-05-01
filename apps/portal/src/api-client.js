"use client";

const SESSION_STORAGE_KEY = "be_ai_heart.portal.session";
const DEFAULT_SESSION_MODE = "header";
const DEFAULT_LOCAL_DEMO_SESSION = "portal-demo-session";

export function getPortalApiBaseUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL ?? "http://127.0.0.1:4010",
  );
}

export function getPortalPublicBaseUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL ?? "http://127.0.0.1:3001",
  );
}

export function getPortalDefaultSessionToken() {
  if (!isPortalLocalDemoAuthEnabled()) {
    return "";
  }

  return String(process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_PORTAL_SESSION ?? DEFAULT_LOCAL_DEMO_SESSION).trim();
}

export function getPortalSessionToken() {
  return getPortalSessionState().sessionToken;
}

export function getPortalSessionState() {
  if (typeof window === "undefined") {
    return {
      mode: DEFAULT_SESSION_MODE,
      sessionToken: getPortalDefaultSessionToken(),
      csrfToken: "",
    };
  }

  return normalizePortalSessionState(window.localStorage.getItem(SESSION_STORAGE_KEY));
}

export function setPortalSessionToken(token) {
  const safeToken = String(token ?? "").trim();
  if (!safeToken || typeof window === "undefined") {
    return;
  }

  persistPortalSessionState({
    mode: "header",
    sessionToken: safeToken,
    csrfToken: "",
  });
}

export function establishPortalCookieSession(session) {
  if (typeof window === "undefined") {
    return;
  }

  persistPortalSessionState({
    mode: "cookie",
    sessionToken: "",
    csrfToken: String(session?.csrf_token ?? "").trim(),
  });
}

export function clearPortalSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  dispatchPortalSessionEvent({
    mode: "cleared",
    sessionToken: "",
    csrfToken: "",
  });
}

export async function fetchPortalJson(resourcePath, options = {}) {
  return sendPortalRequest(resourcePath, {
    ...options,
    method: options.method ?? "GET",
  });
}

export async function postPortalJson(resourcePath, body, options = {}) {
  return sendPortalRequest(resourcePath, {
    ...options,
    method: options.method ?? "POST",
    body,
  });
}

export function createPortalReturnToUrl(pathname = "/auth/complete") {
  return new URL(pathname, getPortalPublicBaseUrl()).toString();
}

function buildPortalRequestUrl(resourcePath) {
  return new URL(resourcePath, getPortalApiBaseUrl()).toString();
}

async function sendPortalRequest(resourcePath, options = {}) {
  const sessionState = getPortalSessionState();
  const method = String(options.method ?? "GET").toUpperCase();
  const isStateChangingRequest = !["GET", "HEAD", "OPTIONS"].includes(method);
  const response = await fetch(buildPortalRequestUrl(resourcePath), {
    method,
    cache: options.cache ?? "no-store",
    credentials:
      options.credentials ?? (sessionState.mode === "cookie" ? "include" : "same-origin"),
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
      ...(sessionState.mode === "cookie" && isStateChangingRequest && sessionState.csrfToken
        ? { "x-be-ai-heart-csrf": sessionState.csrfToken }
        : {}),
      ...(sessionState.mode !== "cookie" && sessionState.sessionToken
        ? { "x-be-ai-heart-session": sessionState.sessionToken }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const raw = await response.text();
  const payload = safeJsonParse(raw);

  if (!response.ok) {
    if (response.status === 404 && options.allowMissing) {
      return {};
    }

    throw new Error(payload?.error || `Failed to load ${resourcePath}.`);
  }

  return payload ?? {};
}

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? "").trim();
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function normalizePortalSessionState(rawValue) {
  const defaultState = {
    mode: DEFAULT_SESSION_MODE,
    sessionToken: getPortalDefaultSessionToken(),
    csrfToken: "",
  };
  if (!rawValue) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === "object") {
      return {
        mode: parsed.mode === "cookie" ? "cookie" : DEFAULT_SESSION_MODE,
        sessionToken:
          parsed.mode === "cookie"
            ? ""
            : sanitizePortalSessionToken(
                String(parsed.sessionToken ?? parsed.session_token ?? defaultState.sessionToken).trim(),
              ),
        csrfToken: String(parsed.csrfToken ?? parsed.csrf_token ?? "").trim(),
      };
    }
  } catch {
    return {
      mode: DEFAULT_SESSION_MODE,
      sessionToken: sanitizePortalSessionToken(String(rawValue).trim() || defaultState.sessionToken),
      csrfToken: "",
    };
  }

  return {
    ...defaultState,
    sessionToken: sanitizePortalSessionToken(defaultState.sessionToken),
  };
}

function persistPortalSessionState(state) {
  const normalized = {
    mode: state.mode === "cookie" ? "cookie" : DEFAULT_SESSION_MODE,
    sessionToken: String(state.sessionToken ?? "").trim(),
    csrfToken: String(state.csrfToken ?? "").trim(),
  };
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalized));
  dispatchPortalSessionEvent(normalized);
}

function dispatchPortalSessionEvent(detail) {
  window.dispatchEvent(
    new CustomEvent("be-ai-heart:portal-session", {
      detail,
    }),
  );
}

function isPortalLocalDemoAuthEnabled() {
  return ["1", "true", "yes", "on", "enabled"].includes(
    String(process.env.NEXT_PUBLIC_BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH ?? "")
      .trim()
      .toLowerCase(),
  );
}

function sanitizePortalSessionToken(token) {
  const safeToken = String(token ?? "").trim();
  if (!safeToken) {
    return "";
  }

  if (!isPortalLocalDemoAuthEnabled() && safeToken === DEFAULT_LOCAL_DEMO_SESSION) {
    return "";
  }

  return safeToken;
}
