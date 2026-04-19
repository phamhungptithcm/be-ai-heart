"use client";

const SESSION_STORAGE_KEY = "be_ai_heart.portal.session";

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
  return String(process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_PORTAL_SESSION ?? "portal-demo-session").trim();
}

export function getPortalSessionToken() {
  if (typeof window === "undefined") {
    return getPortalDefaultSessionToken();
  }

  return window.localStorage.getItem(SESSION_STORAGE_KEY) ?? getPortalDefaultSessionToken();
}

export function setPortalSessionToken(token) {
  const safeToken = String(token ?? "").trim();
  if (!safeToken || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, safeToken);
  window.dispatchEvent(
    new CustomEvent("be-ai-heart:portal-session", {
      detail: {
        sessionToken: safeToken,
      },
    }),
  );
}

export function clearPortalSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
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
  const response = await fetch(buildPortalRequestUrl(resourcePath), {
    method: options.method ?? "GET",
    cache: options.cache ?? "no-store",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
      ...(getPortalSessionToken() ? { "x-be-ai-heart-session": getPortalSessionToken() } : {}),
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
