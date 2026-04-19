import { withServiceDatabase } from "./database.js";

export async function createAuthTransaction({
  serviceStorageRoot,
  state,
  providerId,
  surface,
  returnTo,
  workspaceSlug,
  customerSlug,
  redirectUri,
  nonce,
  codeVerifier,
  expiresAt,
  metadata,
} = {}) {
  const createdAt = new Date().toISOString();
  const payload = {
    schema_version: 1,
    state: sanitizeToken(state),
    provider_id: sanitizeSlug(providerId ?? ""),
    surface: sanitizeSlug(surface ?? "portal"),
    return_to: String(returnTo ?? "").trim(),
    workspace_slug: sanitizeSlug(workspaceSlug ?? ""),
    customer_slug: sanitizeSlug(customerSlug ?? ""),
    redirect_uri: String(redirectUri ?? "").trim(),
    nonce: String(nonce ?? "").trim(),
    code_verifier: String(codeVerifier ?? "").trim(),
    created_at: createdAt,
    expires_at: expiresAt ?? addMinutes(createdAt, 15),
    metadata: metadata ?? {},
  };
  if (!payload.state || !payload.provider_id || !payload.return_to || !payload.redirect_uri) {
    throw new Error("state, providerId, returnTo, and redirectUri are required.");
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO auth_transactions (
          state,
          provider_id,
          surface,
          return_to,
          workspace_slug,
          customer_slug,
          redirect_uri,
          nonce,
          code_verifier,
          created_at,
          expires_at,
          payload_json
        )
        VALUES (
          :state,
          :provider_id,
          :surface,
          :return_to,
          :workspace_slug,
          :customer_slug,
          :redirect_uri,
          :nonce,
          :code_verifier,
          :created_at,
          :expires_at,
          :payload_json
        )
        ON CONFLICT(state) DO UPDATE SET
          provider_id = excluded.provider_id,
          surface = excluded.surface,
          return_to = excluded.return_to,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          redirect_uri = excluded.redirect_uri,
          nonce = excluded.nonce,
          code_verifier = excluded.code_verifier,
          created_at = excluded.created_at,
          expires_at = excluded.expires_at,
          payload_json = excluded.payload_json
      `)
      .run({
        state: payload.state,
        provider_id: payload.provider_id,
        surface: payload.surface,
        return_to: payload.return_to,
        workspace_slug: payload.workspace_slug || null,
        customer_slug: payload.customer_slug || null,
        redirect_uri: payload.redirect_uri,
        nonce: payload.nonce,
        code_verifier: payload.code_verifier,
        created_at: payload.created_at,
        expires_at: payload.expires_at,
        payload_json: JSON.stringify(payload),
      });
  });

  return payload;
}

export async function loadAuthTransaction({ serviceStorageRoot, state, providerId } = {}) {
  const safeState = sanitizeToken(state);
  if (!safeState) {
    return null;
  }

  await cleanupExpiredAuthTransactions({ serviceStorageRoot });
  const payload = withServiceDatabase(serviceStorageRoot, (database) => {
    const row = database
      .prepare("SELECT payload_json FROM auth_transactions WHERE state = ?")
      .get(safeState);
    return parsePayload(row?.payload_json, null);
  });
  if (!payload) {
    return null;
  }

  if (providerId && sanitizeSlug(providerId) !== sanitizeSlug(payload.provider_id)) {
    return null;
  }

  if (payload.expires_at && payload.expires_at < new Date().toISOString()) {
    await deleteAuthTransaction({ serviceStorageRoot, state: safeState });
    return null;
  }

  return payload;
}

export async function consumeAuthTransaction({ serviceStorageRoot, state, providerId } = {}) {
  const payload = await loadAuthTransaction({
    serviceStorageRoot,
    state,
    providerId,
  });
  if (!payload) {
    return null;
  }

  await deleteAuthTransaction({
    serviceStorageRoot,
    state: payload.state,
  });
  return payload;
}

export async function cleanupExpiredAuthTransactions({ serviceStorageRoot } = {}) {
  const now = new Date().toISOString();
  withServiceDatabase(serviceStorageRoot, (database) => {
    database.prepare("DELETE FROM auth_transactions WHERE expires_at < ?").run(now);
  });
}

async function deleteAuthTransaction({ serviceStorageRoot, state } = {}) {
  const safeState = sanitizeToken(state);
  if (!safeState) {
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database.prepare("DELETE FROM auth_transactions WHERE state = ?").run(safeState);
  });
}

function addMinutes(isoTime, minutes) {
  const date = new Date(isoTime);
  date.setMinutes(date.getMinutes() + Number(minutes || 0));
  return date.toISOString();
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeToken(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "");
}

function parsePayload(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
