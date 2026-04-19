export async function runHostedAuthSmoke({
  apiBaseUrl,
  providerId = "auth0",
  surface = "portal",
  returnTo,
} = {}) {
  const resolvedApiBaseUrl = normalizeBaseUrl(apiBaseUrl);
  const resolvedReturnTo = String(returnTo ?? "").trim();
  if (!resolvedApiBaseUrl) {
    throw new Error("apiBaseUrl is required.");
  }
  if (!resolvedReturnTo) {
    throw new Error("returnTo is required.");
  }

  const providerRegistryUrl = new URL("/api/auth/providers", resolvedApiBaseUrl);
  providerRegistryUrl.searchParams.set("surface", surface);
  providerRegistryUrl.searchParams.set("return_to", resolvedReturnTo);

  const providerRegistryResponse = await fetch(providerRegistryUrl, {
    redirect: "manual",
    headers: {
      Accept: "application/json",
    },
  });
  const providerRegistryPayload = await providerRegistryResponse.json().catch(() => ({}));
  if (!providerRegistryResponse.ok) {
    throw new Error(providerRegistryPayload?.error || "Failed to load auth provider registry.");
  }

  const provider = (providerRegistryPayload.providers ?? []).find((entry) => entry.id === providerId);
  if (!provider) {
    throw new Error(`Provider ${providerId} is not configured on the hosted API.`);
  }

  const authorizeResponse = await fetch(provider.authorize_url, {
    redirect: "manual",
  });
  const authorizeLocation = authorizeResponse.headers.get("location");
  if (authorizeResponse.status !== 302 || !authorizeLocation) {
    throw new Error("Provider authorization redirect was not issued.");
  }

  const approvedAuthorizeUrl = new URL(authorizeLocation);
  approvedAuthorizeUrl.searchParams.set("approve", "1");
  const providerResponse = await fetch(approvedAuthorizeUrl, {
    redirect: "manual",
  });
  const callbackLocation = providerResponse.headers.get("location");
  if (providerResponse.status !== 302 || !callbackLocation) {
    throw new Error("Mock provider did not redirect back to the BeHeart callback route.");
  }

  const callbackResponse = await fetch(callbackLocation, {
    redirect: "manual",
  });
  const completionLocation = callbackResponse.headers.get("location");
  const sessionCookie = callbackResponse.headers.get("set-cookie");
  if (callbackResponse.status !== 302 || !completionLocation) {
    throw new Error("BeHeart callback did not redirect back to the portal completion route.");
  }

  const completionUrl = new URL(completionLocation);
  if (completionUrl.searchParams.get("session_established") !== "1") {
    throw new Error("Hosted auth flow completed without establishing a hosted session.");
  }
  if (!sessionCookie) {
    throw new Error("Hosted auth callback did not set a session cookie.");
  }

  const sessionUrl = new URL("/api/session", resolvedApiBaseUrl);
  const sessionResponse = await fetch(sessionUrl, {
    headers: {
      Accept: "application/json",
      Cookie: sessionCookie.split(";")[0],
    },
  });
  const sessionPayload = await sessionResponse.json().catch(() => ({}));
  if (!sessionResponse.ok) {
    throw new Error(sessionPayload?.error || "Hosted auth flow issued a session cookie that could not be resolved.");
  }

  return {
    provider_id: providerId,
    surface,
    provider_authorize_url: provider.authorize_url,
    callback_url: callbackLocation,
    completion_url: completionLocation,
    session_cookie: sessionCookie,
    session: sessionPayload.session ?? null,
    actor: sessionPayload.actor ?? null,
    workspace: sessionPayload.workspace ?? null,
  };
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  return raw.endsWith("/") ? raw : `${raw}/`;
}
