import fs from "node:fs/promises";
import path from "node:path";

import { getServiceStoragePaths, loadWorkspaceCatalog } from "./storage.js";
import { withServiceDatabase } from "./database.js";
import {
  clearMembershipsForActorInPostgres,
  isPostgresStorageEnabled,
  loadActorsFromPostgres,
  loadMembershipsFromPostgres,
  writeActorsToPostgres,
  writeMembershipsToPostgres,
} from "./postgres-repository.js";

const DEFAULT_ACTORS = Object.freeze([
  {
    actor_slug: "owner-admin",
    surface: "admin",
    role: "owner",
    access_mode: "all",
    customer_slug: "internal",
  },
  {
    actor_slug: "demo-customer",
    surface: "portal",
    role: "customer",
    access_mode: "all",
    customer_slug: "demo-customer",
  },
]);

export async function loadAccessRegistry({ serviceStorageRoot } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const authRoot = path.join(paths.root, "auth");
  let actors = await loadActorsFromDatabase(paths.root);
  let memberships = await loadMembershipsFromDatabase(paths.root);

  if (actors.length === 0) {
    const seededActors = await readJsonOrDefault(path.join(authRoot, "actors.json"), {
      actors: [...DEFAULT_ACTORS],
    });
    actors = seededActors.actors ?? [...DEFAULT_ACTORS];
    await writeActorsToDatabase(paths.root, actors);
  }

  if (memberships.length === 0) {
    const seededMemberships = await readJsonOrDefault(path.join(authRoot, "memberships.json"), {
      memberships: [],
    });
    memberships = seededMemberships.memberships ?? [];
    if (memberships.length > 0) {
      await writeMembershipsToDatabase(paths.root, memberships);
    }
  }

  return {
    actors,
    memberships,
    auth_root: authRoot,
  };
}

export async function listAccessibleWorkspaces({ serviceStorageRoot, surface, actorSlug } = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug);
  if (!actor) {
    return [];
  }

  const catalog = await loadWorkspaceCatalog({ serviceStorageRoot });
  return filterWorkspacesForActor(catalog.workspaces ?? [], actor, registry.memberships ?? []);
}

export async function listAccessibleRepositoryProfiles({ serviceStorageRoot, surface, actorSlug } = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug);
  if (!actor) {
    return [];
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const index = await readJsonOrDefault(path.join(paths.profilesRoot, "index.json"), { profiles: [] });
  const allowedWorkspaceSlugs = new Set(
    filterWorkspacesForActor(
      await loadWorkspaceCatalog({ serviceStorageRoot }).then((catalog) => catalog.workspaces ?? []),
      actor,
      registry.memberships ?? [],
    )
      .map((workspace) => workspace.workspace_slug),
  );

  return (index.profiles ?? []).filter((profile) => allowedWorkspaceSlugs.has(profile.workspace_slug ?? profile.profile_slug));
}

export async function loadAccessibleRepositoryView({
  serviceStorageRoot,
  surface,
  actorSlug,
  profileSlug,
} = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug);
  if (!actor) {
    return null;
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const workspaces = await loadWorkspaceCatalog({ serviceStorageRoot });
  const allowedWorkspaceSlugs = new Set(
    filterWorkspacesForActor(workspaces.workspaces ?? [], actor, registry.memberships ?? []).map(
      (workspace) => workspace.workspace_slug,
    ),
  );
  const safeSlug = sanitizeSlug(profileSlug);

  const profile = await readJsonOrDefault(
    path.join(paths.profileRepositoryFilesRoot, `${safeSlug}.json`),
    null,
  );
  if (!profile || !allowedWorkspaceSlugs.has(profile.workspace_slug ?? profile.profile_slug)) {
    return null;
  }

  const documents = await readJsonOrDefault(
    path.join(paths.documentRepositoryFilesRoot, `${safeSlug}.json`),
    null,
  );
  const benchmarkHistory = await readJsonOrDefault(
    path.join(paths.benchmarkRepositoriesRoot, `${safeSlug}.json`),
    { profile_slug: safeSlug, reports: [] },
  );
  const workspace = (workspaces.workspaces ?? []).find((entry) => entry.workspace_slug === (profile.workspace_slug ?? profile.profile_slug)) ?? null;

  return {
    profile,
    documents,
    benchmark_history: benchmarkHistory,
    workspace,
  };
}

export async function loadAccessibleDocumentsView({ serviceStorageRoot, surface, actorSlug } = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug);
  if (!actor) {
    return {
      repositories: [],
      submissions: [],
    };
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const allowedWorkspaces = filterWorkspacesForActor(
    (await loadWorkspaceCatalog({ serviceStorageRoot })).workspaces ?? [],
    actor,
    registry.memberships ?? [],
  );
  const allowedWorkspaceSlugs = new Set(allowedWorkspaces.map((workspace) => workspace.workspace_slug));
  const repositoryIndex = await readJsonOrDefault(path.join(paths.documentsRoot, "index.json"), { repositories: [] });
  const submissionIndex = await readJsonOrDefault(path.join(paths.documentSubmissionsRoot, "index.json"), {
    submissions: [],
  });

  return {
    repositories: (repositoryIndex.repositories ?? []).filter((repository) =>
      allowedWorkspaceSlugs.has(repository.workspace_slug ?? repository.profile_slug),
    ),
    submissions: (submissionIndex.submissions ?? []).filter((submission) =>
      allowedWorkspaceSlugs.has(submission.profile_slug),
    ),
  };
}

export async function loadAccessibleBenchmarkIndex({ serviceStorageRoot, surface, actorSlug } = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug);
  if (!actor) {
    return {
      reports: [],
    };
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const allowedWorkspaceSlugs = new Set(
    filterWorkspacesForActor(
      (await loadWorkspaceCatalog({ serviceStorageRoot })).workspaces ?? [],
      actor,
      registry.memberships ?? [],
    ).map((workspace) => workspace.workspace_slug),
  );
  const benchmarkIndex = await readJsonOrDefault(path.join(paths.benchmarksRoot, "index.json"), { reports: [] });

  return {
    reports: (benchmarkIndex.reports ?? []).filter((report) =>
      allowedWorkspaceSlugs.has(report.profile_slug),
    ),
  };
}

export async function loadAccessibleBenchmarkReport({
  serviceStorageRoot,
  surface,
  actorSlug,
  reportId,
} = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug);
  if (!actor) {
    return null;
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const report = await readJsonOrDefault(path.join(paths.benchmarkReportsRoot, `${sanitizeSlug(reportId)}.json`), null);
  if (!report) {
    return null;
  }

  const allowedWorkspaceSlugs = new Set(
    filterWorkspacesForActor(
      (await loadWorkspaceCatalog({ serviceStorageRoot })).workspaces ?? [],
      actor,
      registry.memberships ?? [],
    ).map((workspace) => workspace.workspace_slug),
  );

  return allowedWorkspaceSlugs.has(report.profile_slug) ? report : null;
}

export async function resolveActor({ serviceStorageRoot, surface, actorSlug } = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot });
  return resolveActorFromRegistry(registry, surface, actorSlug);
}

export async function upsertActor({ serviceStorageRoot, actor } = {}) {
  if (!actor) {
    throw new Error("actor is required.");
  }

  await writeActorsToDatabase(serviceStorageRoot, [actor]);
  const registry = await loadAccessRegistry({ serviceStorageRoot });
  const persisted = resolveActorFromRegistry(registry, actor.surface, actor.actor_slug);
  return persisted;
}

export async function replaceActorMemberships({ serviceStorageRoot, actorSlug, memberships = [] } = {}) {
  const safeActorSlug = sanitizeSlug(actorSlug ?? "");
  if (!safeActorSlug) {
    throw new Error("actorSlug is required.");
  }

  if (isPostgresStorageEnabled()) {
    await clearMembershipsForActorInPostgres({
      actorSlug: safeActorSlug,
    });
  } else {
    withServiceDatabase(serviceStorageRoot, (database) => {
      database.prepare("DELETE FROM memberships WHERE actor_slug = ?").run(safeActorSlug);
    });
  }
  if (memberships.length > 0) {
    await writeMembershipsToDatabase(
      serviceStorageRoot,
      memberships.map((membership) => ({
        ...membership,
        actor_slug: safeActorSlug,
      })),
    );
  }

  const registry = await loadAccessRegistry({ serviceStorageRoot });
  return (registry.memberships ?? []).filter(
    (membership) => sanitizeSlug(membership.actor_slug) === safeActorSlug,
  );
}

function resolveActorFromRegistry(registry, surface, actorSlug) {
  const safeActorSlug = sanitizeSlug(actorSlug ?? defaultActorSlugForSurface(surface));

  return (
    registry.actors.find(
      (actor) =>
        sanitizeSlug(actor.actor_slug) === safeActorSlug &&
        (actor.surface === surface || actor.surface === "all"),
    ) ?? null
  );
}

function defaultActorSlugForSurface(surface) {
  if (surface === "admin") {
    return process.env.BE_AI_HEART_DEFAULT_ADMIN_ACTOR ?? "owner-admin";
  }

  return process.env.BE_AI_HEART_DEFAULT_PORTAL_ACTOR ?? "demo-customer";
}

function filterWorkspacesForActor(workspaces, actor, memberships = []) {
  if (!actor) {
    return [];
  }

  if (actor.access_mode === "all" || actor.role === "owner") {
    return workspaces;
  }

  const workspaceScope = new Set((actor.workspace_scopes ?? []).map((value) => sanitizeSlug(value)));
  const membershipSet = new Set(
    memberships
      .filter((membership) => sanitizeSlug(membership.actor_slug) === sanitizeSlug(actor.actor_slug))
      .map((membership) => sanitizeSlug(membership.workspace_slug)),
  );

  return workspaces.filter((workspace) => {
    const workspaceSlug = sanitizeSlug(workspace.workspace_slug ?? workspace.profile_slug);

    if (workspaceScope.has("*") || membershipSet.has(workspaceSlug) || workspaceScope.has(workspaceSlug)) {
      return true;
    }

    if (actor.customer_slug && sanitizeSlug(actor.customer_slug) === sanitizeSlug(workspace.customer_slug ?? "")) {
      return true;
    }

    return false;
  });
}

async function readJsonOrDefault(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadActorsFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadActorsFromPostgres();
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT payload_json
        FROM actors
        ORDER BY surface ASC, actor_slug ASC
      `)
      .all()
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean),
  );
}

async function loadMembershipsFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadMembershipsFromPostgres();
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT payload_json
        FROM memberships
        ORDER BY actor_slug ASC, workspace_slug ASC
      `)
      .all()
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean),
  );
}

async function writeActorsToDatabase(serviceStorageRoot, actors) {
  if (isPostgresStorageEnabled()) {
    await writeActorsToPostgres({ actors });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    const statement = database.prepare(`
      INSERT INTO actors (
        actor_slug,
        surface,
        role,
        access_mode,
        customer_slug,
        payload_json
      )
      VALUES (
        :actor_slug,
        :surface,
        :role,
        :access_mode,
        :customer_slug,
        :payload_json
      )
      ON CONFLICT(actor_slug, surface) DO UPDATE SET
        role = excluded.role,
        access_mode = excluded.access_mode,
        customer_slug = excluded.customer_slug,
        payload_json = excluded.payload_json
    `);

    for (const actor of actors) {
      statement.run({
        actor_slug: String(actor.actor_slug ?? ""),
        surface: String(actor.surface ?? "portal"),
        role: String(actor.role ?? "customer"),
        access_mode: String(actor.access_mode ?? "memberships"),
        customer_slug: actor.customer_slug ?? null,
        payload_json: JSON.stringify(actor),
      });
    }
  });
}

async function writeMembershipsToDatabase(serviceStorageRoot, memberships) {
  if (isPostgresStorageEnabled()) {
    await writeMembershipsToPostgres({ memberships });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    const statement = database.prepare(`
      INSERT INTO memberships (
        actor_slug,
        workspace_slug,
        payload_json
      )
      VALUES (
        :actor_slug,
        :workspace_slug,
        :payload_json
      )
      ON CONFLICT(actor_slug, workspace_slug) DO UPDATE SET
        payload_json = excluded.payload_json
    `);

    for (const membership of memberships) {
      statement.run({
        actor_slug: String(membership.actor_slug ?? ""),
        workspace_slug: String(membership.workspace_slug ?? ""),
        payload_json: JSON.stringify(membership),
      });
    }
  });
}

function parsePayload(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
