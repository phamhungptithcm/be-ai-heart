import { withServiceDatabase } from "./database.js";
import { ensureCustomer } from "./customer-registry.js";
import {
  isPostgresStorageEnabled,
  listWorkspaceIdentitiesFromPostgres,
  loadWorkspaceIdentityFromPostgres,
  upsertWorkspaceIdentityInPostgres,
} from "./postgres-repository.js";

export async function upsertWorkspaceIdentity({
  serviceStorageRoot,
  workspaceSlug,
  customerSlug,
  profileSlug,
  repo,
  displayName,
  plan,
  status,
  ownerActorSlug,
  source,
  lastSyncAt,
  createdAt,
  updatedAt,
  metadata,
} = {}) {
  const now = updatedAt ?? new Date().toISOString();
  const identity = {
    schema_version: 1,
    workspace_slug: sanitizeSlug(workspaceSlug ?? profileSlug ?? repo ?? "workspace"),
    customer_slug: sanitizeSlug(customerSlug ?? workspaceSlug ?? profileSlug ?? repo ?? "customer"),
    profile_slug: sanitizeSlug(profileSlug ?? workspaceSlug ?? repo ?? "workspace"),
    repo: String(repo ?? ""),
    display_name: String(displayName ?? workspaceSlug ?? profileSlug ?? repo ?? "Workspace").trim(),
    plan: String(plan ?? "starter").trim().toLowerCase(),
    status: String(status ?? "active").trim().toLowerCase(),
    owner_actor_slug: ownerActorSlug ? sanitizeSlug(ownerActorSlug) : "",
    source: String(source ?? "service-write").trim().toLowerCase(),
    created_at: createdAt ?? now,
    updated_at: now,
    last_sync_at: lastSyncAt ?? now,
    metadata: metadata ?? {},
  };
  const existingPayload = await loadWorkspaceIdentity({
    serviceStorageRoot,
    workspaceSlug: identity.workspace_slug,
  });
  const customer = await ensureCustomer({
    serviceStorageRoot,
    customerSlug: identity.customer_slug,
    displayName: identity.display_name,
    status: identity.status,
    metadata: {
      latest_workspace_slug: identity.workspace_slug,
      repo: identity.repo,
    },
    customerId: existingPayload?.customer_id,
  });
  const createdAtValue = existingPayload?.created_at ?? identity.created_at;
  const merged = {
    ...(existingPayload ?? {}),
    ...identity,
    customer_id: customer?.customer_id ?? existingPayload?.customer_id ?? "",
    created_at: createdAtValue,
    metadata: {
      ...(existingPayload?.metadata ?? {}),
      ...(identity.metadata ?? {}),
    },
  };

  if (isPostgresStorageEnabled()) {
    await upsertWorkspaceIdentityInPostgres({
      identity: merged,
    });
  } else {
    withServiceDatabase(serviceStorageRoot, (database) => {
      database
        .prepare(`
          INSERT INTO workspace_identities (
            workspace_slug,
            customer_id,
            customer_slug,
            profile_slug,
            repo,
            display_name,
            plan,
            status,
            owner_actor_slug,
            source,
            created_at,
            updated_at,
            last_sync_at,
            payload_json
          )
          VALUES (
            :workspace_slug,
            :customer_id,
            :customer_slug,
            :profile_slug,
            :repo,
            :display_name,
            :plan,
            :status,
            :owner_actor_slug,
            :source,
            :created_at,
            :updated_at,
            :last_sync_at,
            :payload_json
          )
          ON CONFLICT(workspace_slug) DO UPDATE SET
            customer_id = excluded.customer_id,
            customer_slug = excluded.customer_slug,
            profile_slug = excluded.profile_slug,
            repo = excluded.repo,
            display_name = excluded.display_name,
            plan = excluded.plan,
            status = excluded.status,
            owner_actor_slug = excluded.owner_actor_slug,
            source = excluded.source,
            updated_at = excluded.updated_at,
            last_sync_at = excluded.last_sync_at,
            payload_json = excluded.payload_json
        `)
        .run({
          workspace_slug: merged.workspace_slug,
          customer_id: merged.customer_id || null,
          customer_slug: merged.customer_slug,
          profile_slug: merged.profile_slug,
          repo: merged.repo,
          display_name: merged.display_name,
          plan: merged.plan,
          status: merged.status,
          owner_actor_slug: merged.owner_actor_slug || null,
          source: merged.source,
          created_at: merged.created_at,
          updated_at: merged.updated_at,
          last_sync_at: merged.last_sync_at,
          payload_json: JSON.stringify(merged),
        });
    });
  }

  const persisted = await loadWorkspaceIdentity({
    serviceStorageRoot,
    workspaceSlug: identity.workspace_slug,
  });
  return persisted;
}

export async function loadWorkspaceIdentity({ serviceStorageRoot, workspaceSlug } = {}) {
  const safeWorkspaceSlug = sanitizeSlug(workspaceSlug ?? "");
  if (!safeWorkspaceSlug) {
    return null;
  }

  if (isPostgresStorageEnabled()) {
    return loadWorkspaceIdentityFromPostgres({
      workspaceSlug: safeWorkspaceSlug,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const row = database
      .prepare("SELECT payload_json FROM workspace_identities WHERE workspace_slug = ?")
      .get(safeWorkspaceSlug);
    return parsePayload(row?.payload_json, null);
  });
}

export async function listWorkspaceIdentities({ serviceStorageRoot, customerSlug } = {}) {
  const safeCustomerSlug = customerSlug ? sanitizeSlug(customerSlug) : "";

  if (isPostgresStorageEnabled()) {
    return listWorkspaceIdentitiesFromPostgres({
      customerSlug: safeCustomerSlug,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const statement = safeCustomerSlug
      ? database.prepare(`
          SELECT payload_json
          FROM workspace_identities
          WHERE customer_slug = ?
          ORDER BY workspace_slug
        `)
      : database.prepare(`
          SELECT payload_json
          FROM workspace_identities
          ORDER BY workspace_slug
        `);
    const rows = safeCustomerSlug ? statement.all(safeCustomerSlug) : statement.all();
    return rows.map((row) => parsePayload(row.payload_json, null)).filter(Boolean);
  });
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
