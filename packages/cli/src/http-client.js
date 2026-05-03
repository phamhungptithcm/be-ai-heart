export async function exchangeProviderSessionRemote({
  baseUrl,
  idToken,
  workspaceSlug,
  customerSlug,
  providerId,
} = {}) {
  return sendServiceRequest({
    baseUrl,
    path: "/api/session/provider",
    method: "POST",
    body: {
      id_token: idToken,
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
      provider_id: providerId,
    },
  });
}

export async function resolveSessionRemote({
  baseUrl,
  sessionToken,
} = {}) {
  return sendServiceRequest({
    baseUrl,
    path: "/api/session",
    method: "GET",
    sessionToken,
  });
}

export async function syncRepositoryProfileRemote({
  baseUrl,
  sessionToken,
  profile,
  workspaceMetadata,
} = {}) {
  return sendServiceRequest({
    baseUrl,
    path: "/api/repositories",
    method: "POST",
    sessionToken,
    body: {
      profile,
      workspace_metadata: workspaceMetadata,
    },
  });
}

export async function syncRepositoryDocumentsRemote({
  baseUrl,
  sessionToken,
  artifact,
} = {}) {
  return sendServiceRequest({
    baseUrl,
    path: "/api/documents",
    method: "POST",
    sessionToken,
    body: {
      artifact,
    },
  });
}

export async function syncBenchmarkReportRemote({
  baseUrl,
  sessionToken,
  report,
} = {}) {
  return sendServiceRequest({
    baseUrl,
    path: "/api/benchmarks",
    method: "POST",
    sessionToken,
    body: {
      report,
    },
  });
}

export async function createRepositoryContextPackRemote({
  baseUrl,
  sessionToken,
  profileSlug,
  task,
  tokenBudget,
} = {}) {
  return sendServiceRequest({
    baseUrl,
    path: `/api/repositories/${encodeURIComponent(String(profileSlug ?? ""))}/context-packs`,
    method: "POST",
    sessionToken,
    body: {
      task,
      token_budget: tokenBudget,
    },
  });
}

async function sendServiceRequest({ baseUrl, path, method = "GET", sessionToken, body } = {}) {
  const response = await fetch(new URL(path, normalizeServiceBaseUrl(baseUrl)), {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(sessionToken ? { "x-be-ai-heart-session": sessionToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || `${method} ${path} failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function normalizeServiceBaseUrl(value) {
  const base = String(value ?? "").trim();
  if (!base) {
    throw new Error("Service URL is required.");
  }

  return base.endsWith("/") ? base : `${base}/`;
}
