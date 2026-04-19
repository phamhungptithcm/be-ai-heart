import { withServiceDatabase } from "./database.js";
import { listAccessibleWorkspaces, resolveActor } from "./access.js";
import { loadWorkspaceIdentity } from "./identity.js";
import {
  countSessionsInPostgres,
  isPostgresStorageEnabled,
  loadSessionFromPostgres,
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

export async function issueWorkspaceSession({
  serviceStorageRoot,
  actorSlug,
  surface,
  workspaceSlug,
  customerSlug,
  sessionToken,
  expiresAt,
  metadata,
} = {}) {
  const now = new Date().toISOString();
  const actor = await resolveActor({
    serviceStorageRoot,
    surface,
    actorSlug,
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
  const token =
    sanitizeSlug(sessionToken) ||
    `${sanitizeSlug(surface ?? actor.surface ?? "portal")}-${sanitizeSlug(actor.actor_slug)}-${Date.now()}`;
  const payload = {
    schema_version: 1,
    session_token: token,
    actor_slug: actor.actor_slug,
    surface: surface ?? actor.surface ?? "portal",
    workspace_slug: sanitizeSlug(workspaceSlug ?? workspaceIdentity?.workspace_slug ?? ""),
    customer_slug: sanitizeSlug(customerSlug ?? workspaceIdentity?.customer_slug ?? actor.customer_slug ?? ""),
    issued_at: now,
    expires_at: expiresAt ?? addHours(now, 12),
    metadata: metadata ?? {},
  };

  if (isPostgresStorageEnabled()) {
    await upsertSessionInPostgres({
      session: payload,
    });
  } else {
    withServiceDatabase(serviceStorageRoot, (database) => {
      database
        .prepare(`
          INSERT INTO sessions (
            session_token,
            actor_slug,
            surface,
            workspace_slug,
            customer_slug,
            issued_at,
            expires_at,
            payload_json
          )
          VALUES (
            :session_token,
            :actor_slug,
            :surface,
            :workspace_slug,
            :customer_slug,
            :issued_at,
            :expires_at,
            :payload_json
          )
          ON CONFLICT(session_token) DO UPDATE SET
            actor_slug = excluded.actor_slug,
            surface = excluded.surface,
            workspace_slug = excluded.workspace_slug,
            customer_slug = excluded.customer_slug,
            issued_at = excluded.issued_at,
            expires_at = excluded.expires_at,
            payload_json = excluded.payload_json
        `)
        .run({
          session_token: payload.session_token,
          actor_slug: payload.actor_slug,
          surface: payload.surface,
          workspace_slug: payload.workspace_slug || null,
          customer_slug: payload.customer_slug || null,
          issued_at: payload.issued_at,
          expires_at: payload.expires_at,
          payload_json: JSON.stringify(payload),
        });
    });
  }

  return payload;
}

export async function resolveWorkspaceSession({ serviceStorageRoot, surface, sessionToken } = {}) {
  await ensureDefaultSessions(serviceStorageRoot);
  const safeToken = sanitizeSlug(sessionToken ?? "");
  if (!safeToken) {
    return null;
  }

  const payload = isPostgresStorageEnabled()
    ? await loadSessionFromPostgres({
        sessionToken: safeToken,
      })
    : withServiceDatabase(serviceStorageRoot, (database) => {
        const row = database
          .prepare("SELECT payload_json FROM sessions WHERE session_token = ?")
          .get(safeToken);
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

  return payload;
}

export async function resolveRequestAuthContext({ serviceStorageRoot, surface, request } = {}) {
  await ensureDefaultSessions(serviceStorageRoot);
  const requestUrl = resolveRequestUrl(request);
  const actorSlugFromRequest =
    requestUrl.searchParams.get("actor") || request?.headers?.get?.("x-be-ai-heart-actor");
  const workspaceSlugFromRequest =
    requestUrl.searchParams.get("workspace") || request?.headers?.get?.("x-be-ai-heart-workspace");
  const sessionToken = inferSessionTokenFromRequest(request);
  const session = sessionToken
    ? await resolveWorkspaceSession({
        serviceStorageRoot,
        surface,
        sessionToken,
      })
    : null;
  const actor = await resolveActor({
    serviceStorageRoot,
    surface,
    actorSlug: actorSlugFromRequest ?? session?.actor_slug,
  });
  const workspaces = actor
    ? await listAccessibleWorkspaces({
        serviceStorageRoot,
        surface,
        actorSlug: actor.actor_slug,
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
    session_token: session?.session_token ?? sessionToken ?? "",
    workspaces,
    workspace,
    workspace_identity: workspaceIdentity,
    workspace_slug: requestedWorkspaceSlug,
    customer_slug:
      workspaceIdentity?.customer_slug ??
      workspace?.customer_slug ??
      session?.customer_slug ??
      actor?.customer_slug ??
      "",
  };
}

function inferSessionTokenFromRequest(request) {
  const queryValue = resolveRequestUrl(request).searchParams.get("session");
  if (queryValue) {
    return queryValue;
  }

  const headerValue = request?.headers?.get?.("x-be-ai-heart-session");
  if (headerValue) {
    return headerValue;
  }

  const authorizationHeader = request?.headers?.get?.("authorization");
  if (authorizationHeader?.toLowerCase().startsWith("bearer ")) {
    return authorizationHeader.slice("bearer ".length).trim();
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
  return cookies.be_ai_heart_session ?? "";
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

export async function ensureDefaultSessions(serviceStorageRoot) {
  const issuedAt = new Date().toISOString();
  const payloads = DEFAULT_SESSIONS.map((entry) => ({
    schema_version: 1,
    ...entry,
    issued_at: issuedAt,
    expires_at: addHours(issuedAt, 24 * 30),
  }));

  if (isPostgresStorageEnabled()) {
    const count = await countSessionsInPostgres();
    if (count > 0) {
      return;
    }

    await seedSessionsInPostgres({
      sessions: payloads,
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
        actor_slug,
        surface,
        workspace_slug,
        customer_slug,
        issued_at,
        expires_at,
        payload_json
      )
      VALUES (
        :session_token,
        :actor_slug,
        :surface,
        :workspace_slug,
        :customer_slug,
        :issued_at,
        :expires_at,
        :payload_json
      )
      ON CONFLICT(session_token) DO NOTHING
    `);

    for (const payload of payloads) {
      statement.run({
        session_token: payload.session_token,
        actor_slug: payload.actor_slug,
        surface: payload.surface,
        workspace_slug: payload.workspace_slug || null,
        customer_slug: payload.customer_slug || null,
        issued_at: payload.issued_at,
        expires_at: payload.expires_at,
        payload_json: JSON.stringify(payload),
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

function parsePayload(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
