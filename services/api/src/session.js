import { createHash, randomBytes, randomUUID } from "node:crypto";
import { withServiceDatabase } from "./database.js";
import { listAccessibleWorkspaces, resolveActor } from "./access.js";
import { ensureCustomer } from "./customer-registry.js";
import { loadWorkspaceIdentity } from "./identity.js";
import { isLocalDemoAuthEnabled } from "./local-demo.js";
import {
  countSessionsInPostgres,
  isPostgresStorageEnabled,
  loadSessionFromPostgres,
  loadSessionsFromPostgres,
  revokeSessionsInPostgres,
  seedSessionsInPostgres,
  upsertSessionInPostgres,
} from "./postgres-repository.js";

const DEFAULT_SESSIONS = Object.freeze([
  {
    session_token: "portal-demo-session",
    actor_slug: "demo-customer",
    surface: "portal",
    workspace_slug: "",
    customer_slug: "demo-customer",
    display_name: "Demo Customer",
    source: "seeded-demo-session",
  },
  {
    session_token: "admin-owner-session",
    actor_slug: "owner-admin",
    surface: "admin",
    workspace_slug: "",
    customer_slug: "internal",
    display_name: "AI Heart Owner",
    source: "seeded-admin-session",
  },
]);
const SESSION_LAST_SEEN_REFRESH_MS = 60 * 1000;

export async function issueWorkspaceSession({
  serviceStorageRoot,
  actorSlug,
  localDemoAuth,
  surface,
  workspaceSlug,
  customerSlug,
  sessionToken,
  expiresAt,
  metadata,
  sessionFamilyId,
} = {}) {
  const now = new Date().toISOString();
  const actor = await resolveActor({
    serviceStorageRoot,
    surface,
    actorSlug,
    localDemoAuth,
  });
  if (!actor) {
    throw new Error(`Unknown actor for ${surface}: ${actorSlug ?? "default"}`);
  }

  const workspaceIdentity = workspaceSlug
    ? await loadWorkspaceIdentity({
        serviceStorageRoot,
        workspaceSlug,
      })
    : null;
  const customer = await ensureCustomer({
    serviceStorageRoot,
    customerSlug: customerSlug ?? workspaceIdentity?.customer_slug ?? actor.customer_slug,
    displayName: workspaceIdentity?.display_name ?? actor.display_name ?? actor.actor_slug,
  });
  const token = normalizeSessionToken(sessionToken) || randomBytes(32).toString("hex");
  const payload = {
    schema_version: 1,
    session_id: randomUUID(),
    session_family_id: String(sessionFamilyId ?? randomUUID()),
    session_token: token,
    csrf_token: randomBytes(18).toString("hex"),
    actor_slug: actor.actor_slug,
    surface: surface ?? actor.surface ?? "portal",
    workspace_slug: sanitizeSlug(workspaceSlug ?? workspaceIdentity?.workspace_slug ?? ""),
    customer_slug: sanitizeSlug(customerSlug ?? workspaceIdentity?.customer_slug ?? actor.customer_slug ?? ""),
    customer_id: customer?.customer_id ?? workspaceIdentity?.customer_id ?? actor.customer_id ?? "",
    issued_at: now,
    expires_at: expiresAt ?? addHours(now, 12),
    revoked_at: "",
    revocation_reason: "",
    last_seen_at: now,
    metadata: metadata ?? {},
  };
  const persistedPayload = createPersistedSessionPayload(payload);
  const lookupKey = hashSessionToken(token);

  if (isPostgresStorageEnabled()) {
    await upsertSessionInPostgres({
      session: persistedPayload,
      lookupKey,
    });
  } else {
    withServiceDatabase(serviceStorageRoot, (database) => {
      database
        .prepare(`
          INSERT INTO sessions (
            session_token,
            session_id,
            session_family_id,
            actor_slug,
            surface,
            workspace_slug,
            customer_slug,
            customer_id,
            issued_at,
            expires_at,
            revoked_at,
            revocation_reason,
            last_seen_at,
            payload_json
          )
          VALUES (
            :session_token,
            :session_id,
            :session_family_id,
            :actor_slug,
            :surface,
            :workspace_slug,
            :customer_slug,
            :customer_id,
            :issued_at,
            :expires_at,
            :revoked_at,
            :revocation_reason,
            :last_seen_at,
            :payload_json
          )
          ON CONFLICT(session_token) DO UPDATE SET
            session_id = excluded.session_id,
            session_family_id = excluded.session_family_id,
            actor_slug = excluded.actor_slug,
            surface = excluded.surface,
            workspace_slug = excluded.workspace_slug,
            customer_slug = excluded.customer_slug,
            customer_id = excluded.customer_id,
            issued_at = excluded.issued_at,
            expires_at = excluded.expires_at,
            revoked_at = excluded.revoked_at,
            revocation_reason = excluded.revocation_reason,
            last_seen_at = excluded.last_seen_at,
            payload_json = excluded.payload_json
        `)
        .run({
          session_token: lookupKey,
          session_id: payload.session_id,
          session_family_id: payload.session_family_id,
          actor_slug: payload.actor_slug,
          surface: payload.surface,
          workspace_slug: payload.workspace_slug || null,
          customer_slug: payload.customer_slug || null,
          customer_id: payload.customer_id || null,
          issued_at: payload.issued_at,
          expires_at: payload.expires_at,
          revoked_at: payload.revoked_at || null,
          revocation_reason: payload.revocation_reason || null,
          last_seen_at: payload.last_seen_at,
          payload_json: JSON.stringify(persistedPayload),
        });
    });
  }

  return payload;
}

export async function resolveWorkspaceSession({ serviceStorageRoot, surface, sessionToken, localDemoAuth } = {}) {
  await ensureDefaultSessions(serviceStorageRoot, { localDemoAuth });
  const safeToken = normalizeSessionToken(sessionToken ?? "");
  if (!safeToken) {
    return null;
  }
  if (!isLocalDemoAuthEnabled({ localDemoAuth }) && DEFAULT_SESSIONS.some((entry) => entry.session_token === safeToken)) {
    return null;
  }

  const lookupKeys = [hashSessionToken(safeToken), safeToken];
  const payload = isPostgresStorageEnabled()
    ? await loadSessionFromPostgres({
        lookupKeys,
      })
    : withServiceDatabase(serviceStorageRoot, (database) => {
        const row = database
          .prepare(`
            SELECT payload_json
            FROM sessions
            WHERE session_token IN (?, ?)
            ORDER BY CASE WHEN session_token = ? THEN 0 ELSE 1 END
            LIMIT 1
          `)
          .get(lookupKeys[0], lookupKeys[1], lookupKeys[0]);
        return parsePayload(row?.payload_json, null);
      });

  if (!payload) {
    return null;
  }

  if (surface && payload.surface !== surface) {
    return null;
  }

  if (payload.expires_at && payload.expires_at < new Date().toISOString()) {
    return null;
  }
  if (payload.revoked_at) {
    return null;
  }
  if (!isLocalDemoAuthEnabled({ localDemoAuth }) && String(payload.source ?? "").startsWith("seeded-")) {
    return null;
  }

  let resolvedPayload = payload;
  if (shouldRefreshSessionLastSeen(payload.last_seen_at)) {
    const refreshedLastSeenAt = new Date().toISOString();
    resolvedPayload = {
      ...payload,
      last_seen_at: refreshedLastSeenAt,
    };
    await persistSessionLastSeen({
      serviceStorageRoot,
      lookupKey: lookupKeys[0],
      session: resolvedPayload,
    });
  }

  return {
    ...resolvedPayload,
    session_token: safeToken,
  };
}

export async function revokeWorkspaceSession({
  serviceStorageRoot,
  sessionToken,
  sessionId,
  sessionFamilyId,
  actorSlug,
  reason,
} = {}) {
  return (
    (await revokeWorkspaceSessions({
      serviceStorageRoot,
      sessionToken,
      sessionId,
      sessionFamilyId,
      actorSlug,
      reason,
    })) > 0
  );
}

export async function revokeWorkspaceSessions({
  serviceStorageRoot,
  sessionToken,
  sessionId,
  sessionFamilyId,
  actorSlug,
  customerSlug,
  customerId,
  reason,
} = {}) {
  const safeToken = normalizeSessionToken(sessionToken ?? "");
  if (!safeToken && !sessionId && !sessionFamilyId && !actorSlug && !customerSlug && !customerId) {
    return 0;
  }

  const lookupKeys = [hashSessionToken(safeToken), safeToken];
  if (isPostgresStorageEnabled()) {
    return revokeSessionsInPostgres({
      lookupKeys,
      sessionId,
      sessionFamilyId,
      actorSlug,
      customerSlug,
      customerId,
      reason,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const clauses = [];
    const values = [];
    if (safeToken) {
      clauses.push("session_token IN (?, ?)");
      values.push(lookupKeys[0], lookupKeys[1]);
    }
    if (sessionId) {
      clauses.push("session_id = ?");
      values.push(String(sessionId));
    }
    if (sessionFamilyId) {
      clauses.push("session_family_id = ?");
      values.push(String(sessionFamilyId));
    }
    if (actorSlug) {
      clauses.push("actor_slug = ?");
      values.push(String(actorSlug));
    }
    if (customerSlug) {
      clauses.push("customer_slug = ?");
      values.push(String(customerSlug));
    }
    if (customerId) {
      clauses.push("customer_id = ?");
      values.push(String(customerId));
    }
    if (clauses.length === 0) {
      return 0;
    }

    const revokedAt = new Date().toISOString();
    const result = database
      .prepare(`
        UPDATE sessions
        SET
          revoked_at = ?,
          revocation_reason = ?,
          payload_json = json_set(
            json_set(payload_json, '$.revoked_at', json(?)),
            '$.revocation_reason',
            json(?)
          )
        WHERE ${clauses.join(" OR ")}
      `)
      .run(
        revokedAt,
        String(reason ?? "revoked"),
        JSON.stringify(revokedAt),
        JSON.stringify(String(reason ?? "revoked")),
        ...values,
      );
    return Number(result.changes ?? 0);
  });
}

export async function rotateWorkspaceSession({
  serviceStorageRoot,
  sessionToken,
  expiresAt,
  metadata,
} = {}) {
  const existing = await resolveWorkspaceSession({
    serviceStorageRoot,
    sessionToken,
  });
  if (!existing) {
    return null;
  }

  const nextSession = await issueWorkspaceSession({
    serviceStorageRoot,
    actorSlug: existing.actor_slug,
    surface: existing.surface,
    workspaceSlug: existing.workspace_slug,
    customerSlug: existing.customer_slug,
    expiresAt: expiresAt ?? existing.expires_at,
    metadata: {
      ...(existing.metadata ?? {}),
      ...(metadata ?? {}),
    },
    sessionFamilyId: existing.session_family_id,
  });
  await revokeWorkspaceSession({
    serviceStorageRoot,
    sessionToken,
    reason: "rotated",
  });

  return nextSession;
}

export async function listWorkspaceSessions({
  serviceStorageRoot,
  sessionToken,
  sessionId,
  sessionFamilyId,
  actorSlug,
  surface,
  workspaceSlug,
  customerSlug,
  customerId,
  includeRevoked = false,
  limit = 100,
  offset = 0,
} = {}) {
  const safeToken = normalizeSessionToken(sessionToken ?? "");
  if (isPostgresStorageEnabled()) {
    return loadSessionsFromPostgres({
      sessionToken: safeToken,
      sessionId,
      sessionFamilyId,
      actorSlug,
      surface,
      workspaceSlug,
      customerSlug,
      customerId,
      includeRevoked,
      limit,
      offset,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const clauses = [];
    const values = [];
    if (safeToken) {
      clauses.push("session_token IN (?, ?)");
      values.push(hashSessionToken(safeToken), safeToken);
    }
    if (sessionId) {
      clauses.push("session_id = ?");
      values.push(String(sessionId));
    }
    if (sessionFamilyId) {
      clauses.push("session_family_id = ?");
      values.push(String(sessionFamilyId));
    }
    if (actorSlug) {
      clauses.push("actor_slug = ?");
      values.push(String(actorSlug));
    }
    if (surface) {
      clauses.push("surface = ?");
      values.push(String(surface));
    }
    if (workspaceSlug) {
      clauses.push("workspace_slug = ?");
      values.push(String(workspaceSlug));
    }
    if (customerSlug) {
      clauses.push("customer_slug = ?");
      values.push(String(customerSlug));
    }
    if (customerId) {
      clauses.push("customer_id = ?");
      values.push(String(customerId));
    }
    if (!includeRevoked) {
      clauses.push("(revoked_at IS NULL OR revoked_at = '')");
    }

    const statement = database.prepare(`
      SELECT payload_json
      FROM sessions
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY issued_at DESC, session_id ASC
      LIMIT ?
      OFFSET ?
    `);

    return statement
      .all(...values, Number(limit), Number(offset))
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean);
  });
}

export async function resolveRequestAuthContext({
  serviceStorageRoot,
  surface,
  request,
  sessionCookieName,
  localDemoAuth,
} = {}) {
  await ensureDefaultSessions(serviceStorageRoot, { localDemoAuth });
  const requestUrl = resolveRequestUrl(request);
  const actorSlugFromRequest =
    requestUrl.searchParams.get("actor") || request?.headers?.get?.("x-be-ai-heart-actor");
  const workspaceSlugFromRequest =
    requestUrl.searchParams.get("workspace") || request?.headers?.get?.("x-be-ai-heart-workspace");
  const { token: sessionToken, source: sessionSource } = inferSessionTokenFromRequest(request, {
    sessionCookieName,
  });
  const session = sessionToken
    ? await resolveWorkspaceSession({
        serviceStorageRoot,
        surface,
        sessionToken,
        localDemoAuth,
      })
    : null;
  const actor = await resolveActor({
    serviceStorageRoot,
    surface,
    actorSlug: actorSlugFromRequest ?? session?.actor_slug,
    localDemoAuth,
  });
  const workspaces = actor
    ? await listAccessibleWorkspaces({
        serviceStorageRoot,
        surface,
        actorSlug: actor.actor_slug,
        localDemoAuth,
      })
    : [];
  const requestedWorkspaceSlug = sanitizeSlug(
    workspaceSlugFromRequest ?? session?.workspace_slug ?? workspaces[0]?.workspace_slug ?? "",
  );
  const workspace =
    workspaces.find((entry) => sanitizeSlug(entry.workspace_slug) === requestedWorkspaceSlug) ?? null;
  const workspaceIdentity = requestedWorkspaceSlug
    ? await loadWorkspaceIdentity({
        serviceStorageRoot,
        workspaceSlug: requestedWorkspaceSlug,
      })
    : null;

  return {
    actor,
    actor_slug: actor?.actor_slug ?? "",
    session,
    session_source: sessionSource,
    session_token: session?.session_token ?? sessionToken ?? "",
    workspaces,
    workspace,
    workspace_identity: workspaceIdentity,
    workspace_slug: requestedWorkspaceSlug,
    customer_id:
      workspaceIdentity?.customer_id ??
      workspace?.customer_id ??
      session?.customer_id ??
      actor?.customer_id ??
      "",
    customer_slug:
      workspaceIdentity?.customer_slug ??
      workspace?.customer_slug ??
      session?.customer_slug ??
      actor?.customer_slug ??
      "",
  };
}

function inferSessionTokenFromRequest(request, { sessionCookieName } = {}) {
  const queryValue = resolveRequestUrl(request).searchParams.get("session");
  if (queryValue) {
    return {
      token: queryValue,
      source: "query",
    };
  }

  const cookieHeader = request?.headers?.get?.("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [key, ...rest] = entry.split("=");
        return [key, rest.join("=")];
      }),
  );
  const cookieKey = String(sessionCookieName ?? "be_ai_heart_session");
  if (cookies[cookieKey]) {
    return {
      token: cookies[cookieKey],
      source: "cookie",
    };
  }

  const headerValue = request?.headers?.get?.("x-be-ai-heart-session");
  if (headerValue) {
    return {
      token: headerValue,
      source: "header",
    };
  }

  const authorizationHeader = request?.headers?.get?.("authorization");
  if (authorizationHeader?.toLowerCase().startsWith("bearer ")) {
    return {
      token: authorizationHeader.slice("bearer ".length).trim(),
      source: "bearer",
    };
  }

  return {
    token: "",
    source: "",
  };
}

function resolveRequestUrl(request) {
  if (request?.nextUrl instanceof URL) {
    return request.nextUrl;
  }

  if (request?.url) {
    return new URL(String(request.url));
  }

  return new URL("http://127.0.0.1/");
}

export async function ensureDefaultSessions(serviceStorageRoot, options = {}) {
  if (!isLocalDemoAuthEnabled(options)) {
    return;
  }

  const issuedAt = new Date().toISOString();
  const payloads = [];
  for (const entry of DEFAULT_SESSIONS) {
    const customer = await ensureCustomer({
      serviceStorageRoot,
      customerSlug: entry.customer_slug,
      displayName: entry.display_name,
      status: "active",
    });
    payloads.push({
      schema_version: 1,
      session_id: randomUUID(),
      session_family_id: randomUUID(),
      ...entry,
      customer_id: customer?.customer_id ?? "",
      csrf_token: randomBytes(18).toString("hex"),
      issued_at: issuedAt,
      expires_at: addHours(issuedAt, 24 * 30),
      revoked_at: "",
      revocation_reason: "",
      last_seen_at: issuedAt,
    });
  }

  if (isPostgresStorageEnabled()) {
    const count = await countSessionsInPostgres();
    if (count > 0) {
      return;
    }

    await seedSessionsInPostgres({
      sessions: payloads.map((payload) => ({
        ...createPersistedSessionPayload(payload),
        session_lookup_key: hashSessionToken(payload.session_token),
      })),
    });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    const count = database.prepare("SELECT COUNT(*) AS count FROM sessions").get().count;
    if (count > 0) {
      return;
    }

    const statement = database.prepare(`
      INSERT INTO sessions (
        session_token,
        session_id,
        session_family_id,
        actor_slug,
        surface,
        workspace_slug,
        customer_slug,
        customer_id,
        issued_at,
        expires_at,
        revoked_at,
        revocation_reason,
        last_seen_at,
        payload_json
      )
      VALUES (
        :session_token,
        :session_id,
        :session_family_id,
        :actor_slug,
        :surface,
        :workspace_slug,
        :customer_slug,
        :customer_id,
        :issued_at,
        :expires_at,
        :revoked_at,
        :revocation_reason,
        :last_seen_at,
        :payload_json
      )
      ON CONFLICT(session_token) DO NOTHING
    `);

    for (const payload of payloads) {
      const persistedPayload = createPersistedSessionPayload(payload);
      statement.run({
        session_token: hashSessionToken(payload.session_token),
        session_id: payload.session_id,
        session_family_id: payload.session_family_id,
        actor_slug: payload.actor_slug,
        surface: payload.surface,
        workspace_slug: payload.workspace_slug || null,
        customer_slug: payload.customer_slug || null,
        customer_id: payload.customer_id || null,
        issued_at: payload.issued_at,
        expires_at: payload.expires_at,
        revoked_at: payload.revoked_at || null,
        revocation_reason: payload.revocation_reason || null,
        last_seen_at: payload.last_seen_at,
        payload_json: JSON.stringify(persistedPayload),
      });
    }
  });
}

function addHours(isoTime, hours) {
  const date = new Date(isoTime);
  date.setHours(date.getHours() + Number(hours || 0));
  return date.toISOString();
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSessionToken(value) {
  const safeValue = String(value ?? "").trim();
  if (!safeValue || safeValue.length > 256) {
    return "";
  }

  return /^[A-Za-z0-9._-]+$/.test(safeValue) ? safeValue : "";
}

async function persistSessionLastSeen({ serviceStorageRoot, lookupKey, session } = {}) {
  if (isPostgresStorageEnabled()) {
    await upsertSessionInPostgres({
      session,
      lookupKey,
    });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        UPDATE sessions
        SET
          last_seen_at = ?,
          payload_json = json_set(payload_json, '$.last_seen_at', json(?))
        WHERE session_token = ?
      `)
      .run(
        session.last_seen_at,
        JSON.stringify(session.last_seen_at),
        lookupKey,
      );
  });
}

function shouldRefreshSessionLastSeen(lastSeenAt) {
  const parsed = new Date(lastSeenAt ?? "");
  const timestampMs = parsed.getTime();
  return !Number.isFinite(timestampMs) || Date.now() - timestampMs >= SESSION_LAST_SEEN_REFRESH_MS;
}

function createPersistedSessionPayload(session) {
  return {
    ...session,
    session_token: "",
  };
}

function hashSessionToken(sessionToken) {
  return createHash("sha256").update(String(sessionToken ?? ""), "utf8").digest("hex");
}

function parsePayload(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
