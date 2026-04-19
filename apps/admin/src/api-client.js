"use client";

const SESSION_STORAGE_KEY = "be_ai_heart.admin.session";

export function getAdminApiBaseUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL ?? "http://127.0.0.1:4010",
  );
}

export function getAdminDefaultSessionToken() {
  return String(process.env.NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION ?? "admin-owner-session").trim();
}

export function getAdminSessionToken() {
  if (typeof window === "undefined") {
    return getAdminDefaultSessionToken();
  }

  return window.localStorage.getItem(SESSION_STORAGE_KEY) ?? getAdminDefaultSessionToken();
}

export function setAdminSessionToken(token) {
  const safeToken = String(token ?? "").trim();
  if (!safeToken || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, safeToken);
}

export async function fetchAdminJson(resourcePath, options = {}) {
  const response = await fetch(new URL(`/api/admin${resourcePath.replace(/^\/api/, "")}`, getAdminApiBaseUrl()), {
    method: options.method ?? "GET",
    cache: options.cache ?? "no-store",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
      ...(getAdminSessionToken() ? { "x-be-ai-heart-session": getAdminSessionToken() } : {}),
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
