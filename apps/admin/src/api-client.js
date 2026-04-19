"use client";

const SESSION_STORAGE_KEY = "be_ai_heart.admin.session";
const DEFAULT_SESSION_MODE = "header";

export function getAdminApiBaseUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL ?? "http://127.0.0.1:4010",
  );
}

export function getAdminPublicBaseUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_BE_AI_HEART_ADMIN_BASE_URL ?? "http://127.0.0.1:3002",
  );
}

export function getAdminDefaultSessionToken() {
  return String(
    process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION ??
      "admin-owner-session",
  ).trim();
}

export function getAdminSessionState() {
  if (typeof window === "undefined") {
    return {
      mode: DEFAULT_SESSION_MODE,
      sessionToken: getAdminDefaultSessionToken(),
      csrfToken: "",
    };
  }

  return normalizeAdminSessionState(window.localStorage.getItem(SESSION_STORAGE_KEY));
}

export function getAdminSessionToken() {
  return getAdminSessionState().sessionToken;
}

export function setAdminSessionToken(token) {
  const safeToken = String(token ?? "").trim();
  if (!safeToken || typeof window === "undefined") {
    return;
  }

  persistAdminSessionState({
    mode: "header",
    sessionToken: safeToken,
    csrfToken: "",
  });
}

export function establishAdminCookieSession(session) {
  if (typeof window === "undefined") {
    return;
  }

  persistAdminSessionState({
    mode: "cookie",
    sessionToken: "",
    csrfToken: String(session?.csrf_token ?? "").trim(),
  });
}

export function clearAdminSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  dispatchAdminSessionEvent({
    mode: "cleared",
    sessionToken: "",
    csrfToken: "",
  });
}

export async function fetchAdminJson(resourcePath, options = {}) {
  return sendAdminRequest(resourcePath, {
    ...options,
    method: options.method ?? "GET",
  });
}

export async function postAdminJson(resourcePath, body, options = {}) {
  return sendAdminRequest(resourcePath, {
    ...options,
    method: options.method ?? "POST",
    body,
  });
}

export function createAdminReturnToUrl(pathname = "/auth/complete") {
  return new URL(pathname, getAdminPublicBaseUrl()).toString();
}

function buildAdminRequestUrl(resourcePath) {
  return new URL(
    `/api/admin${String(resourcePath ?? "").replace(/^\/api(?:\/admin)?/, "")}`,
    getAdminApiBaseUrl(),
  ).toString();
}

async function sendAdminRequest(resourcePath, options = {}) {
  const sessionState = getAdminSessionState();
  const method = String(options.method ?? "GET").toUpperCase();
  const isStateChangingRequest = !["GET", "HEAD", "OPTIONS"].includes(method);
  const response = await fetch(buildAdminRequestUrl(resourcePath), {
    method,
    cache: options.cache ?? "no-store",
    credentials:
      options.credentials ?? (sessionState.mode === "cookie" ? "include" : "same-origin"),
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
      ...(sessionState.mode === "cookie" &&
      isStateChangingRequest &&
      sessionState.csrfToken
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

function normalizeAdminSessionState(rawValue) {
  const defaultState = {
    mode: DEFAULT_SESSION_MODE,
    sessionToken: getAdminDefaultSessionToken(),
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
            : String(
                parsed.sessionToken ??
                  parsed.session_token ??
                  defaultState.sessionToken,
              ).trim(),
        csrfToken: String(parsed.csrfToken ?? parsed.csrf_token ?? "").trim(),
      };
    }
  } catch {
    return {
      mode: DEFAULT_SESSION_MODE,
      sessionToken: String(rawValue).trim() || defaultState.sessionToken,
      csrfToken: "",
    };
  }

  return defaultState;
}

function persistAdminSessionState(state) {
  const normalized = {
    mode: state.mode === "cookie" ? "cookie" : DEFAULT_SESSION_MODE,
    sessionToken: String(state.sessionToken ?? "").trim(),
    csrfToken: String(state.csrfToken ?? "").trim(),
  };
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalized));
  dispatchAdminSessionEvent(normalized);
}

function dispatchAdminSessionEvent(detail) {
  window.dispatchEvent(
    new CustomEvent("be-ai-heart:admin-session", {
      detail,
    }),
  );
}

