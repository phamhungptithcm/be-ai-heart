import fs from "node:fs/promises";
import path from "node:path";

import { resolveActorAccess } from "../../../packages/shared-schema/src/enterprise.js";
import { ensureCustomer } from "./customer-registry.js";
import { isLocalDemoAuthEnabled } from "./local-demo.js";
import {
  getServiceStoragePaths,
  loadRepositoryServiceArtifactRecord,
  loadWorkspaceCatalog,
} from "./storage.js";
import { withServiceDatabase } from "./database.js";
import {
  clearMembershipsForActorInPostgres,
  isPostgresStorageEnabled,
  loadBenchmarkIndexPageFromPostgres,
  loadActorsFromPostgres,
  loadMembershipsFromPostgres,
  loadRepositoryProfilesPageFromPostgres,
  loadWorkspaceRowsPageFromPostgres,
  writeActorsToPostgres,
  writeMembershipsToPostgres,
} from "./postgres-repository.js";

const DEFAULT_ACTORS = Object.freeze([
  {
    actor_slug: "owner-admin",
    surface: "admin",
    role: "owner",
    roles: ["owner"],
    access_mode: "all",
    customer_slug: "internal",
  },
  {
    actor_slug: "demo-customer",
    surface: "portal",
    role: "org_admin",
    roles: ["org_admin"],
    access_mode: "all",
    customer_slug: "demo-customer",
  },
]);
const DEFAULT_LOCAL_DEMO_ACTOR_SLUGS = new Set(DEFAULT_ACTORS.map((actor) => sanitizeSlug(actor.actor_slug)));

export async function loadAccessRegistry({ serviceStorageRoot, localDemoAuth } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const authRoot = path.join(paths.root, "auth");
  let actors = await loadActorsFromDatabase(paths.root);
  let memberships = await loadMembershipsFromDatabase(paths.root);
  const demoAuthEnabled = isLocalDemoAuthEnabled({ localDemoAuth });

  if (actors.length === 0) {
    const seededActors = await readJsonOrDefault(path.join(authRoot, "actors.json"), {
      actors: [...DEFAULT_ACTORS],
    });
    actors = seededActors.actors ?? (demoAuthEnabled ? [...DEFAULT_ACTORS] : []);
    if (actors.length > 0) {
      await writeActorsToDatabase(paths.root, actors);
    }
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
    actors: filterRuntimeActors(actors, { localDemoAuth: demoAuthEnabled }),
    memberships,
    auth_root: authRoot,
  };
}

export async function listAccessibleWorkspaces({ serviceStorageRoot, surface, actorSlug, localDemoAuth } = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug, { localDemoAuth });
  if (!actor) {
    return [];
  }

  const catalog = await loadWorkspaceCatalog({ serviceStorageRoot });
  return filterWorkspacesForActor(catalog.workspaces ?? [], actor, registry.memberships ?? []);
}

export async function listAccessibleWorkspacesPage({
  serviceStorageRoot,
  surface,
  actorSlug,
  localDemoAuth,
  repo,
  limit = 50,
  offset = 0,
} = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug, { localDemoAuth });
  if (!actor) {
    return {
      items: [],
      total_count: 0,
    };
  }

  const accessScope = buildWorkspaceAccessScope(actor, registry.memberships ?? []);
  if (isPostgresStorageEnabled()) {
    return loadWorkspaceRowsPageFromPostgres({
      ...accessScope,
      repo,
      limit,
      offset,
    }).then((result) => ({
      items: result.items,
      total_count: result.total_count,
    }));
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const { whereClause, values } = buildSqliteAccessScopeFilters({
      accessScope,
      extraFilters: repo ? [{ sql: "repo = ?", value: String(repo) }] : [],
    });
    const countStatement = database.prepare(`
      SELECT COUNT(*) AS count
      FROM workspaces
      ${whereClause}
    `);
    const dataStatement = database.prepare(`
      SELECT payload_json
      FROM workspaces
      ${whereClause}
      ORDER BY workspace_slug ASC
      LIMIT ?
      OFFSET ?
    `);
    const total_count = Number(countStatement.get(...values)?.count ?? 0);
    const items = dataStatement
      .all(...values, Number(limit), Number(offset))
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean);

    return {
      items,
      total_count,
    };
  });
}

export async function listAccessibleRepositoryProfiles({ serviceStorageRoot, surface, actorSlug, localDemoAuth } = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug, { localDemoAuth });
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

export async function listAccessibleRepositoryProfilesPage({
  serviceStorageRoot,
  surface,
  actorSlug,
  localDemoAuth,
  repo,
  profileSlug,
  limit = 50,
  offset = 0,
} = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug, { localDemoAuth });
  if (!actor) {
    return {
      items: [],
      total_count: 0,
    };
  }

  const accessScope = buildWorkspaceAccessScope(actor, registry.memberships ?? []);
  if (isPostgresStorageEnabled()) {
    return loadRepositoryProfilesPageFromPostgres({
      ...accessScope,
      repo,
      profileSlug,
      limit,
      offset,
    }).then((result) => ({
      items: result.items,
      total_count: result.total_count,
    }));
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const extraFilters = [];
    if (repo) {
      extraFilters.push({ sql: "repo = ?", value: String(repo) });
    }
    if (profileSlug) {
      extraFilters.push({ sql: "profile_slug = ?", value: String(profileSlug) });
    }
    const { whereClause, values } = buildSqliteAccessScopeFilters({
      accessScope,
      extraFilters,
    });
    const countStatement = database.prepare(`
      SELECT COUNT(*) AS count
      FROM repository_profiles
      ${whereClause}
    `);
    const dataStatement = database.prepare(`
      SELECT profile_slug, workspace_slug, customer_slug, repo, generated_at, payload_json
      FROM repository_profiles
      ${whereClause}
      ORDER BY profile_slug ASC
      LIMIT ?
      OFFSET ?
    `);
    const total_count = Number(countStatement.get(...values)?.count ?? 0);
    const items = dataStatement.all(...values, Number(limit), Number(offset)).map((row) => {
      const payload = parsePayload(row.payload_json, {});
      return {
        profile_slug: row.profile_slug,
        workspace_slug: row.workspace_slug,
        customer_slug: row.customer_slug,
        repo: row.repo,
        generated_at: row.generated_at,
        overview: payload.overview,
        heart: payload.heart,
        documents: payload.documents,
        cache: payload.cache,
      };
    });

    return {
      items,
      total_count,
    };
  });
}

export async function loadAccessibleRepositoryView({
  serviceStorageRoot,
  surface,
  actorSlug,
  localDemoAuth,
  profileSlug,
  graphMode = "focused",
} = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug, { localDemoAuth });
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
  const normalizedGraphMode = normalizeCodeGraphMode(graphMode);
  const codeGraphView =
    (await loadRepositoryServiceArtifactRecord({
      serviceStorageRoot,
      profileSlug: safeSlug,
      serviceKey: "code-graph",
      variant: normalizedGraphMode,
    })) ??
    (await loadRepositoryServiceArtifactRecord({
      serviceStorageRoot,
      profileSlug: safeSlug,
      serviceKey: "code-graph",
      variant: "focused",
    }));

  return {
    profile,
    documents,
    benchmark_history: benchmarkHistory,
    workspace,
    code_graph: {
      default_mode: "focused",
      requested_mode: normalizedGraphMode,
      available_modes: ["focused", "full"],
      view: codeGraphView,
    },
  };
}

export async function loadAccessibleDocumentsView({ serviceStorageRoot, surface, actorSlug, localDemoAuth } = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug, { localDemoAuth });
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

export async function loadAccessibleBenchmarkIndex({ serviceStorageRoot, surface, actorSlug, localDemoAuth } = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug, { localDemoAuth });
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

export async function loadAccessibleBenchmarkIndexPage({
  serviceStorageRoot,
  surface,
  actorSlug,
  localDemoAuth,
  repo,
  profileSlug,
  scenario,
  limit = 50,
  offset = 0,
} = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug, { localDemoAuth });
  if (!actor) {
    return {
      reports: [],
      total_count: 0,
    };
  }

  const accessScope = buildWorkspaceAccessScope(actor, registry.memberships ?? []);
  if (isPostgresStorageEnabled()) {
    const result = await loadBenchmarkIndexPageFromPostgres({
      ...accessScope,
      repo,
      profileSlug,
      scenario,
      limit,
      offset,
      createBenchmarkIndexEntry: (report) => ({
        report_id: report.report_id,
        repo: report.repo,
        profile_slug: report.profile_slug,
        scenario: report.scenario,
        provider: report.provider,
        model: report.model,
        generated_at: report.generated_at,
        metrics: report.metrics,
        summary: report.summary,
        manager_summary: report.manager_summary,
      }),
    });
    return {
      reports: result.items,
      total_count: result.total_count,
    };
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const extraFilters = [];
    if (repo) {
      extraFilters.push({ sql: "repo = ?", value: String(repo) });
    }
    if (profileSlug) {
      extraFilters.push({ sql: "profile_slug = ?", value: String(profileSlug) });
    }
    if (scenario) {
      extraFilters.push({ sql: "scenario = ?", value: String(scenario) });
    }
    const { whereClause, values } = buildSqliteAccessScopeFilters({
      accessScope,
      extraFilters,
    });
    const countStatement = database.prepare(`
      SELECT COUNT(*) AS count
      FROM benchmark_reports
      ${whereClause}
    `);
    const dataStatement = database.prepare(`
      SELECT payload_json
      FROM benchmark_reports
      ${whereClause}
      ORDER BY generated_at DESC, report_id ASC
      LIMIT ?
      OFFSET ?
    `);
    const total_count = Number(countStatement.get(...values)?.count ?? 0);
    const reports = dataStatement
      .all(...values, Number(limit), Number(offset))
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean)
      .map((report) => ({
        report_id: report.report_id,
        repo: report.repo,
        profile_slug: report.profile_slug,
        scenario: report.scenario,
        provider: report.provider,
        model: report.model,
        generated_at: report.generated_at,
        metrics: report.metrics,
        summary: report.summary,
        manager_summary: report.manager_summary,
      }));

    return {
      reports,
      total_count,
    };
  });
}

export async function loadAccessibleBenchmarkReport({
  serviceStorageRoot,
  surface,
  actorSlug,
  localDemoAuth,
  reportId,
} = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth });
  const actor = resolveActorFromRegistry(registry, surface, actorSlug, { localDemoAuth });
  if (!actor) {
    return null;
  }

  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const report = await readJsonOrDefault(path.join(paths.benchmarkReportsRoot, `${sanitizeSlug(reportId)}.json`), null);
  if (!report) {
    return null;
  }
  const evidenceManifest = await readJsonOrDefault(
    path.join(paths.benchmarkEvidenceRoot, `${sanitizeSlug(reportId)}.json`),
    null,
  );

  const allowedWorkspaceSlugs = new Set(
    filterWorkspacesForActor(
      (await loadWorkspaceCatalog({ serviceStorageRoot })).workspaces ?? [],
      actor,
      registry.memberships ?? [],
    ).map((workspace) => workspace.workspace_slug),
  );

  if (!allowedWorkspaceSlugs.has(report.profile_slug)) {
    return null;
  }

  return {
    ...report,
    evidence_manifest: evidenceManifest ?? report.evidence_manifest,
  };
}

export async function resolveActor({ serviceStorageRoot, surface, actorSlug, localDemoAuth } = {}) {
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth });
  return resolveActorFromRegistry(registry, surface, actorSlug, { localDemoAuth });
}

export async function upsertActor({ serviceStorageRoot, actor } = {}) {
  if (!actor) {
    throw new Error("actor is required.");
  }

  const resolvedActor = resolveActorAccess(actor);
  const persistedActor = {
    ...actor,
    ...resolvedActor,
    role: resolvedActor.primary_role || String(actor.role ?? "").trim(),
  };
  const customer = persistedActor.customer_slug
    ? await ensureCustomer({
        serviceStorageRoot,
        customerSlug: persistedActor.customer_slug,
        displayName: persistedActor.customer_slug,
      })
    : null;
  await writeActorsToDatabase(serviceStorageRoot, [
    {
      ...persistedActor,
      customer_id: customer?.customer_id ?? persistedActor.customer_id ?? "",
    },
  ]);
  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth: true });
  const persisted = resolveActorFromRegistry(
    registry,
    persistedActor.surface,
    persistedActor.actor_slug,
    { localDemoAuth: true },
  );
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

  const registry = await loadAccessRegistry({ serviceStorageRoot, localDemoAuth: true });
  return (registry.memberships ?? []).filter(
    (membership) => sanitizeSlug(membership.actor_slug) === safeActorSlug,
  );
}

function resolveActorFromRegistry(registry, surface, actorSlug, options = {}) {
  const safeActorSlug = sanitizeSlug(actorSlug ?? defaultActorSlugForSurface(surface, options));
  if (!safeActorSlug) {
    return null;
  }
  const actor =
    registry.actors.find(
      (entry) =>
        sanitizeSlug(entry.actor_slug) === safeActorSlug &&
        (entry.surface === surface || entry.surface === "all"),
    ) ?? null;
  return actor ? resolveActorAccess(actor) : null;
}

function defaultActorSlugForSurface(surface, options = {}) {
  if (!isLocalDemoAuthEnabled(options)) {
    return "";
  }

  if (surface === "admin") {
    return process.env.BE_AI_HEART_DEFAULT_ADMIN_ACTOR ?? "owner-admin";
  }

  return process.env.BE_AI_HEART_DEFAULT_PORTAL_ACTOR ?? "demo-customer";
}

function filterRuntimeActors(actors = [], options = {}) {
  if (isLocalDemoAuthEnabled(options)) {
    return actors;
  }

  return actors.filter((actor) => !DEFAULT_LOCAL_DEMO_ACTOR_SLUGS.has(sanitizeSlug(actor.actor_slug)));
}

function filterWorkspacesForActor(workspaces, actor, memberships = []) {
  if (!actor) {
    return [];
  }

  if (actor.surface === "admin" || actor.access_mode === "all" || actor.role === "owner") {
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

function buildWorkspaceAccessScope(actor, memberships = []) {
  const membershipWorkspaceSlugs = memberships
    .filter((membership) => sanitizeSlug(membership.actor_slug) === sanitizeSlug(actor.actor_slug))
    .map((membership) => sanitizeSlug(membership.workspace_slug))
    .filter(Boolean);

  return {
    accessAll:
      actor.surface === "admin" || actor.access_mode === "all" || actor.role === "owner",
    customerSlug: actor.customer_slug ? sanitizeSlug(actor.customer_slug) : "",
    workspaceSlugs: [...new Set([
      ...(actor.workspace_scopes ?? []).map((value) => sanitizeSlug(value)).filter((value) => value && value !== "*"),
      ...membershipWorkspaceSlugs,
    ])],
  };
}

function buildSqliteAccessScopeFilters({ accessScope, extraFilters = [] } = {}) {
  const clauses = [];
  const values = [];

  if (!accessScope.accessAll) {
    const scopeClauses = [];
    if ((accessScope.workspaceSlugs ?? []).length > 0) {
      scopeClauses.push(
        `workspace_slug IN (${accessScope.workspaceSlugs.map(() => "?").join(", ")})`,
      );
      values.push(...accessScope.workspaceSlugs);
    }
    if (accessScope.customerSlug) {
      scopeClauses.push("customer_slug = ?");
      values.push(accessScope.customerSlug);
    }
    clauses.push(scopeClauses.length > 0 ? `(${scopeClauses.join(" OR ")})` : "1 = 0");
  }

  for (const filter of extraFilters) {
    clauses.push(filter.sql);
    values.push(filter.value);
  }

  return {
    whereClause: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
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

function normalizeCodeGraphMode(mode) {
  return String(mode ?? "focused").trim().toLowerCase() === "full" ? "full" : "focused";
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
        customer_id,
        customer_slug,
        payload_json
      )
      VALUES (
        :actor_slug,
        :surface,
        :role,
        :access_mode,
        :customer_id,
        :customer_slug,
        :payload_json
      )
      ON CONFLICT(actor_slug, surface) DO UPDATE SET
        role = excluded.role,
        access_mode = excluded.access_mode,
        customer_id = excluded.customer_id,
        customer_slug = excluded.customer_slug,
        payload_json = excluded.payload_json
    `);

    for (const actor of actors) {
      const resolvedActor = resolveActorAccess(actor);
      statement.run({
        actor_slug: String(actor.actor_slug ?? ""),
        surface: String(actor.surface ?? "portal"),
        role: String(resolvedActor.primary_role ?? actor.role ?? ""),
        access_mode: String(actor.access_mode ?? "memberships"),
        customer_id: actor.customer_id ?? null,
        customer_slug: actor.customer_slug ?? null,
        payload_json: JSON.stringify({
          ...actor,
          ...resolvedActor,
          role: resolvedActor.primary_role ?? actor.role ?? "",
        }),
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
