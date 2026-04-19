"use client";

export function getWebsiteApiBaseUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL ?? "http://127.0.0.1:4010",
  );
}

export async function postWebsiteJson(resourcePath, body, options = {}) {
  const response = await fetch(new URL(resourcePath, getWebsiteApiBaseUrl()), {
    method: options.method ?? "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const raw = await response.text();
  const payload = safeJsonParse(raw);

  if (!response.ok) {
    throw new Error(payload?.error || `Failed to submit ${resourcePath}.`);
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
