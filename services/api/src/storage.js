import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  resolveServiceDatabasePath as resolveServiceDatabaseFilePath,
  withServiceDatabase,
} from "./database.js";
import { upsertWorkspaceIdentity } from "./identity.js";
import {
  isPostgresStorageEnabled,
  loadBenchmarkHistoryEntriesFromPostgres,
  loadBenchmarkIndexFromPostgres,
  loadDocumentSubmissionsFromPostgres,
  loadRepositoryDocumentIndexFromPostgres,
  loadRepositoryProfileIndexFromPostgres,
  loadWorkspaceRowsFromPostgres,
  replaceWorkspaceRowsInPostgres,
  upsertBenchmarkReportInPostgres,
  upsertDocumentSubmissionInPostgres,
  upsertRepositoryDocumentInPostgres,
  upsertRepositoryProfileInPostgres,
} from "./postgres-repository.js";

export function resolveServiceStorageRoot(options = {}) {
  if (options.serviceStorageRoot) {
    return path.resolve(options.serviceStorageRoot);
  }

  if (options.monorepoRoot) {
    return path.join(path.resolve(options.monorepoRoot), "services", "api", "data");
  }

  if (options.portalRoot) {
    return path.join(path.resolve(options.portalRoot, "../.."), "services", "api", "data");
  }

  if (options.adminRoot) {
    return path.join(path.resolve(options.adminRoot, "../.."), "services", "api", "data");
  }

  if (options.repoRoot) {
    const repoRoot = path.resolve(options.repoRoot);
    if (existsSync(path.join(repoRoot, "services", "api"))) {
      return path.join(repoRoot, "services", "api", "data");
    }

    return path.join(path.dirname(repoRoot), "services", "api", "data");
  }

  if (process.env.BE_AI_HEART_SERVICE_STORAGE_ROOT) {
    return path.resolve(process.env.BE_AI_HEART_SERVICE_STORAGE_ROOT);
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), "services", "api", "data");
}

export function getServiceStoragePaths(options = {}) {
  const root = resolveServiceStorageRoot(options);
  return {
    root,
    profilesRoot: path.join(root, "profiles"),
    profileRepositoryFilesRoot: path.join(root, "profiles", "repositories"),
    documentsRoot: path.join(root, "documents"),
    documentRepositoryFilesRoot: path.join(root, "documents", "repositories"),
    documentSubmissionsRoot: path.join(root, "document-submissions"),
    documentSubmissionFilesRoot: path.join(root, "document-submissions", "submissions"),
    benchmarksRoot: path.join(root, "benchmarks"),
    benchmarkReportsRoot: path.join(root, "benchmarks", "reports"),
    benchmarkRepositoriesRoot: path.join(root, "benchmarks", "repositories"),
    workspacesRoot: path.join(root, "workspaces"),
  };
}

export function resolveServiceDatabasePath(options = {}) {
  return resolveServiceDatabaseFilePath(resolveServiceStorageRoot(options));
}

export async function writeRepositoryProfileArtifactRecord({ serviceStorageRoot, profile }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.mkdir(paths.profileRepositoryFilesRoot, { recursive: true });

  const filePath = path.join(paths.profileRepositoryFilesRoot, `${profile.profile_slug}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  await upsertRepositoryProfileRecord(paths.root, profile);
  await upsertWorkspaceIdentity({
    serviceStorageRoot: paths.root,
    workspaceSlug: profile.workspace_slug ?? profile.profile_slug,
    customerSlug: profile.customer_slug ?? profile.profile_slug,
    profileSlug: profile.profile_slug,
    repo: profile.repo,
    displayName: profile.display_name ?? profile.profile_slug,
    source: "profile-artifact",
    lastSyncAt: profile.generated_at,
  });
  await updateRepositoryProfileIndex(paths);
  await updateWorkspaceCatalog(paths);

  return {
    service_storage_root: paths.root,
    database_path: resolveServiceDatabasePath({ serviceStorageRoot: paths.root }),
    profile_path: filePath,
  };
}

export async function publishProfilesToSurface({ serviceStorageRoot, surfaceRoot }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const publicRoot = path.join(surfaceRoot, "public", "profiles");
  await fs.mkdir(publicRoot, { recursive: true });
  await mirrorDirectory(paths.profileRepositoryFilesRoot, publicRoot, {
    indexPath: path.join(paths.profilesRoot, "index.json"),
    emptyIndex: { profiles: [] },
  });

  return {
    surface_root: surfaceRoot,
    public_root: publicRoot,
    index_path: path.join(publicRoot, "index.json"),
  };
}

export async function writeRepositoryDocumentArtifactRecord({ serviceStorageRoot, artifact }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.mkdir(paths.documentRepositoryFilesRoot, { recursive: true });

  const filePath = path.join(paths.documentRepositoryFilesRoot, `${artifact.profile_slug}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await upsertRepositoryDocumentRecord(paths.root, artifact);
  await upsertWorkspaceIdentity({
    serviceStorageRoot: paths.root,
    workspaceSlug: artifact.workspace_slug ?? artifact.profile_slug,
    customerSlug: artifact.customer_slug ?? artifact.profile_slug,
    profileSlug: artifact.profile_slug,
    repo: artifact.repo,
    displayName: artifact.display_name ?? artifact.profile_slug,
    source: "document-artifact",
    lastSyncAt: artifact.generated_at,
  });
  await updateRepositoryDocumentIndex(paths);
  await updateWorkspaceCatalog(paths);

  return {
    service_storage_root: paths.root,
    database_path: resolveServiceDatabasePath({ serviceStorageRoot: paths.root }),
    repository_path: filePath,
  };
}

export async function publishDocumentsToSurface({ serviceStorageRoot, surfaceRoot }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const publicRoot = path.join(surfaceRoot, "public", "documents");
  await fs.mkdir(publicRoot, { recursive: true });
  await mirrorDirectory(paths.documentRepositoryFilesRoot, path.join(publicRoot, "repositories"), {
    indexPath: path.join(paths.documentsRoot, "index.json"),
    targetIndexPath: path.join(publicRoot, "index.json"),
    emptyIndex: { repositories: [] },
  });

  return {
    surface_root: surfaceRoot,
    public_root: publicRoot,
    index_path: path.join(publicRoot, "index.json"),
  };
}

export async function writeDocumentSubmissionRecord({ serviceStorageRoot, submission }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.mkdir(paths.documentSubmissionFilesRoot, { recursive: true });

  const filePath = path.join(paths.documentSubmissionFilesRoot, `${submission.submission_id}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(submission, null, 2)}\n`, "utf8");
  await upsertDocumentSubmissionRecord(paths.root, submission);
  await upsertWorkspaceIdentity({
    serviceStorageRoot: paths.root,
    workspaceSlug: submission.workspace_slug ?? submission.profile_slug,
    customerSlug: submission.customer_slug ?? submission.profile_slug,
    profileSlug: submission.profile_slug,
    repo: submission.repo ?? submission.profile_slug,
    displayName: submission.profile_slug,
    source: "document-submission",
    lastSyncAt: submission.updated_at,
  });
  await updateDocumentSubmissionIndex(paths);
  await updateWorkspaceCatalog(paths);

  return {
    service_storage_root: paths.root,
    database_path: resolveServiceDatabasePath({ serviceStorageRoot: paths.root }),
    submission_path: filePath,
  };
}

export async function listDocumentSubmissionRecords({ serviceStorageRoot } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const databaseSubmissions = await loadDocumentSubmissionsFromDatabase(paths.root);
  if (databaseSubmissions.length > 0) {
    return databaseSubmissions;
  }

  let entries;

  try {
    entries = await fs.readdir(paths.documentSubmissionFilesRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const submissions = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const payload = JSON.parse(
      await fs.readFile(path.join(paths.documentSubmissionFilesRoot, entry.name), "utf8"),
    );
    submissions.push(payload);
  }

  return submissions.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function loadWorkspaceCatalog({ serviceStorageRoot } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const workspaces = await loadWorkspaceRecordsFromDatabase(paths.root);
  if (workspaces.length > 0) {
    return { workspaces };
  }

  return readJsonOrDefault(path.join(paths.workspacesRoot, "index.json"), { workspaces: [] });
}

export async function publishDocumentSubmissionsToSurface({ serviceStorageRoot, surfaceRoot }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const publicRoot = path.join(surfaceRoot, "public", "document-submissions");
  await fs.mkdir(publicRoot, { recursive: true });

  const indexPath = path.join(paths.documentSubmissionsRoot, "index.json");
  if (existsSync(indexPath)) {
    await fs.copyFile(indexPath, path.join(publicRoot, "index.json"));
    return {
      surface_root: surfaceRoot,
      public_root: publicRoot,
      index_path: path.join(publicRoot, "index.json"),
    };
  }

  await fs.writeFile(path.join(publicRoot, "index.json"), `${JSON.stringify({ submissions: [] }, null, 2)}\n`, "utf8");
  return {
    surface_root: surfaceRoot,
    public_root: publicRoot,
    index_path: path.join(publicRoot, "index.json"),
  };
}

export async function publishWorkspacesToSurface({ serviceStorageRoot, surfaceRoot }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const publicRoot = path.join(surfaceRoot, "public", "workspaces");
  await fs.mkdir(publicRoot, { recursive: true });

  const indexPath = path.join(paths.workspacesRoot, "index.json");
  if (existsSync(indexPath)) {
    await fs.copyFile(indexPath, path.join(publicRoot, "index.json"));
  } else {
    await fs.writeFile(path.join(publicRoot, "index.json"), `${JSON.stringify({ workspaces: [] }, null, 2)}\n`, "utf8");
  }

  return {
    surface_root: surfaceRoot,
    public_root: publicRoot,
    index_path: path.join(publicRoot, "index.json"),
  };
}

export async function writeBenchmarkArtifactRecord({ serviceStorageRoot, report }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.mkdir(paths.benchmarkReportsRoot, { recursive: true });
  await fs.mkdir(paths.benchmarkRepositoriesRoot, { recursive: true });

  const reportPath = path.join(paths.benchmarkReportsRoot, `${report.report_id}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await upsertBenchmarkReportRecord(paths.root, report);
  await upsertWorkspaceIdentity({
    serviceStorageRoot: paths.root,
    workspaceSlug: report.workspace_slug ?? report.profile_slug,
    customerSlug: report.customer_slug ?? report.profile_slug,
    profileSlug: report.profile_slug,
    repo: report.repo,
    displayName: report.profile_slug,
    source: "benchmark-report",
    lastSyncAt: report.generated_at,
  });
  await updateBenchmarkRepositoryHistory(paths, report);
  await updateBenchmarkIndex(paths);
  await updateWorkspaceCatalog(paths);

  return {
    service_storage_root: paths.root,
    database_path: resolveServiceDatabasePath({ serviceStorageRoot: paths.root }),
    report_path: reportPath,
  };
}

export async function publishBenchmarksToSurface({ serviceStorageRoot, surfaceRoot }) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const publicRoot = path.join(surfaceRoot, "public", "benchmarks");
  await fs.mkdir(publicRoot, { recursive: true });
  await mirrorDirectory(path.join(paths.benchmarksRoot, "reports"), path.join(publicRoot, "reports"));
  await mirrorDirectory(path.join(paths.benchmarksRoot, "repositories"), path.join(publicRoot, "repositories"));

  const indexPath = path.join(paths.benchmarksRoot, "index.json");
  if (existsSync(indexPath)) {
    await fs.copyFile(indexPath, path.join(publicRoot, "index.json"));
  } else {
    await fs.writeFile(path.join(publicRoot, "index.json"), `${JSON.stringify({ reports: [] }, null, 2)}\n`, "utf8");
  }

  return {
    surface_root: surfaceRoot,
    public_root: publicRoot,
    index_path: path.join(publicRoot, "index.json"),
  };
}

async function updateDocumentSubmissionIndex(paths) {
  const databaseSubmissions = await loadDocumentSubmissionsFromDatabase(paths.root);
  const submissions =
    databaseSubmissions.length > 0
      ? databaseSubmissions
      : await listDocumentSubmissionRecords({
          serviceStorageRoot: paths.root,
        });
  const summary = submissions.map((submission) => ({
    submission_id: submission.submission_id,
    profile_slug: submission.profile_slug,
    title: submission.title,
    category: submission.category,
    summary: submission.summary,
    updated_at: submission.updated_at,
    source: submission.source,
  }));

  await fs.mkdir(paths.documentSubmissionsRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.documentSubmissionsRoot, "index.json"),
    `${JSON.stringify({ submissions: summary }, null, 2)}\n`,
    "utf8",
  );
}

async function updateRepositoryProfileIndex(paths) {
  const profiles = await loadRepositoryProfileIndexFromDatabase(paths.root);
  if (profiles.length === 0) {
    let entries;
    try {
      entries = await fs.readdir(paths.profileRepositoryFilesRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const payload = JSON.parse(await fs.readFile(path.join(paths.profileRepositoryFilesRoot, entry.name), "utf8"));
      profiles.push({
        profile_slug: payload.profile_slug,
        workspace_slug: payload.workspace_slug ?? payload.profile_slug,
        customer_slug: payload.customer_slug ?? payload.profile_slug,
        repo: payload.repo,
        generated_at: payload.generated_at,
        overview: payload.overview,
        heart: payload.heart,
        documents: payload.documents,
        cache: payload.cache,
      });
    }
  }

  profiles.sort((left, right) => left.profile_slug.localeCompare(right.profile_slug));
  await fs.mkdir(paths.profilesRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.profilesRoot, "index.json"),
    `${JSON.stringify({ profiles }, null, 2)}\n`,
    "utf8",
  );
}

async function updateRepositoryDocumentIndex(paths) {
  const repositories = await loadRepositoryDocumentIndexFromDatabase(paths.root);
  if (repositories.length === 0) {
    let entries;
    try {
      entries = await fs.readdir(paths.documentRepositoryFilesRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const payload = JSON.parse(await fs.readFile(path.join(paths.documentRepositoryFilesRoot, entry.name), "utf8"));
      repositories.push({
        profile_slug: payload.profile_slug,
        workspace_slug: payload.workspace_slug ?? payload.profile_slug,
        customer_slug: payload.customer_slug ?? payload.profile_slug,
        repo: payload.repo,
        generated_at: payload.generated_at,
        totals: payload.totals,
        documents: payload.documents.map((document) => ({
          path: document.path,
          title: document.title,
          category: document.category,
          summary: document.summary,
        })),
      });
    }
  }

  repositories.sort((left, right) => left.profile_slug.localeCompare(right.profile_slug));
  await fs.mkdir(paths.documentsRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.documentsRoot, "index.json"),
    `${JSON.stringify({ repositories }, null, 2)}\n`,
    "utf8",
  );
}

async function updateBenchmarkRepositoryHistory(paths, report) {
  const filePath = path.join(paths.benchmarkRepositoriesRoot, `${report.profile_slug}.json`);
  const nextReports = await loadBenchmarkHistoryEntriesFromDatabase(paths.root, report.profile_slug);
  const repositoryHistory = {
    profile_slug: report.profile_slug,
    repo: report.repo,
    reports:
      nextReports.length > 0
        ? nextReports
        : [
            ...(await readJsonOrDefault(filePath, {
              profile_slug: report.profile_slug,
              repo: report.repo,
              reports: [],
            })).reports.filter((entry) => entry.report_id !== report.report_id),
            createBenchmarkIndexEntry(report),
          ].sort((left, right) => right.generated_at.localeCompare(left.generated_at)),
  };

  await fs.writeFile(
    filePath,
    `${JSON.stringify(
      repositoryHistory,
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function updateBenchmarkIndex(paths) {
  const reports = await loadBenchmarkIndexFromDatabase(paths.root);
  if (reports.length === 0) {
    let entries;
    try {
      entries = await fs.readdir(paths.benchmarkReportsRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const report = JSON.parse(await fs.readFile(path.join(paths.benchmarkReportsRoot, entry.name), "utf8"));
      reports.push(createBenchmarkIndexEntry(report));
    }
  }

  reports.sort((left, right) => right.generated_at.localeCompare(left.generated_at));
  await fs.mkdir(paths.benchmarksRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.benchmarksRoot, "index.json"),
    `${JSON.stringify({ reports }, null, 2)}\n`,
    "utf8",
  );
}

async function updateWorkspaceCatalog(paths) {
  const [profileIndex, documentIndex, benchmarkIndex, documentSubmissionIndex] = await Promise.all([
    loadServiceProfileIndex(paths),
    loadServiceDocumentIndex(paths),
    loadServiceBenchmarkIndex(paths),
    loadServiceDocumentSubmissionIndex(paths),
  ]);

  const profileBySlug = new Map((profileIndex.profiles ?? []).map((profile) => [profile.profile_slug, profile]));
  const documentsBySlug = new Map(
    (documentIndex.repositories ?? []).map((repository) => [repository.profile_slug, repository]),
  );
  const benchmarkReportsBySlug = new Map();
  for (const report of benchmarkIndex.reports ?? []) {
    const existing = benchmarkReportsBySlug.get(report.profile_slug) ?? [];
    existing.push(report);
    benchmarkReportsBySlug.set(report.profile_slug, existing);
  }
  const submissionsBySlug = new Map();
  for (const submission of documentSubmissionIndex.submissions ?? []) {
    const existing = submissionsBySlug.get(submission.profile_slug) ?? [];
    existing.push(submission);
    submissionsBySlug.set(submission.profile_slug, existing);
  }

  const allSlugs = new Set([
    ...profileBySlug.keys(),
    ...documentsBySlug.keys(),
    ...benchmarkReportsBySlug.keys(),
    ...submissionsBySlug.keys(),
  ]);
  const workspaces = [];

  for (const slug of [...allSlugs].sort((left, right) => left.localeCompare(right))) {
    const profile = profileBySlug.get(slug);
    const documents = documentsBySlug.get(slug);
    const benchmarkReports = benchmarkReportsBySlug.get(slug) ?? [];
    const queuedSubmissions = submissionsBySlug.get(slug) ?? [];

    workspaces.push({
      workspace_slug: profile?.workspace_slug ?? documents?.workspace_slug ?? slug,
      customer_slug: profile?.customer_slug ?? documents?.customer_slug ?? slug,
      profile_slug: slug,
      repo: profile?.repo ?? documents?.repo ?? benchmarkReports[0]?.repo ?? "unknown-repo",
      latest_sync_at: pickLatestTimestamp([
        profile?.generated_at,
        documents?.generated_at,
        benchmarkReports[0]?.generated_at,
      ]),
      profile_synced_at: profile?.generated_at ?? "",
      documents_synced_at: documents?.generated_at ?? "",
      profile_available: Boolean(profile),
      document_available: Boolean(documents),
      benchmark_report_count: benchmarkReports.length,
      latest_benchmark_at: benchmarkReports[0]?.generated_at ?? "",
      queued_submission_count: queuedSubmissions.length,
      document_count: Number(documents?.totals?.document_count ?? 0),
      avg_token_savings_pct: average(
        benchmarkReports.map((report) => report.metrics?.token_savings_pct ?? 0),
      ),
      avg_memory_refresh_reduction_pct: average(
        benchmarkReports.map((report) => report.metrics?.memory_refresh_reduction_pct ?? 0),
      ),
    });

    await upsertWorkspaceIdentity({
      serviceStorageRoot: paths.root,
      workspaceSlug: profile?.workspace_slug ?? documents?.workspace_slug ?? slug,
      customerSlug: profile?.customer_slug ?? documents?.customer_slug ?? slug,
      profileSlug: slug,
      repo: profile?.repo ?? documents?.repo ?? benchmarkReports[0]?.repo ?? "unknown-repo",
      displayName:
        profile?.display_name ??
        documents?.display_name ??
        (profile?.workspace_slug ?? documents?.workspace_slug ?? slug),
      source: "workspace-catalog-refresh",
      lastSyncAt: pickLatestTimestamp([
        profile?.generated_at,
        documents?.generated_at,
        benchmarkReports[0]?.generated_at,
      ]),
    });
  }

  await replaceWorkspaceRecords(paths.root, workspaces);
  await fs.mkdir(paths.workspacesRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.workspacesRoot, "index.json"),
    `${JSON.stringify({ workspaces }, null, 2)}\n`,
    "utf8",
  );
}

function createBenchmarkIndexEntry(report) {
  return {
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
  };
}

async function mirrorDirectory(sourceRoot, targetRoot, options = {}) {
  await fs.rm(targetRoot, { recursive: true, force: true });
  if (!existsSync(sourceRoot)) {
    await fs.mkdir(targetRoot, { recursive: true });
    if (options.targetIndexPath) {
      await fs.writeFile(options.targetIndexPath, `${JSON.stringify(options.emptyIndex ?? {}, null, 2)}\n`, "utf8");
    }
    return;
  }

  await fs.mkdir(path.dirname(targetRoot), { recursive: true });
  await fs.cp(sourceRoot, targetRoot, { recursive: true });

  if (options.indexPath) {
    await fs.copyFile(options.indexPath, options.targetIndexPath ?? path.join(targetRoot, "index.json"));
  }
}

async function readJsonOrDefault(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function pickLatestTimestamp(values) {
  return values
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? "";
}

function average(values) {
  const filtered = values.map((value) => Number(value || 0));
  if (filtered.length === 0) {
    return 0;
  }

  return Math.round((filtered.reduce((sum, value) => sum + value, 0) / filtered.length) * 10) / 10;
}

async function loadServiceProfileIndex(paths) {
  const profiles = await loadRepositoryProfileIndexFromDatabase(paths.root);
  if (profiles.length > 0) {
    return { profiles };
  }

  return readJsonOrDefault(path.join(paths.profilesRoot, "index.json"), { profiles: [] });
}

async function loadServiceDocumentIndex(paths) {
  const repositories = await loadRepositoryDocumentIndexFromDatabase(paths.root);
  if (repositories.length > 0) {
    return { repositories };
  }

  return readJsonOrDefault(path.join(paths.documentsRoot, "index.json"), { repositories: [] });
}

async function loadServiceBenchmarkIndex(paths) {
  const reports = await loadBenchmarkIndexFromDatabase(paths.root);
  if (reports.length > 0) {
    return { reports };
  }

  return readJsonOrDefault(path.join(paths.benchmarksRoot, "index.json"), { reports: [] });
}

async function loadServiceDocumentSubmissionIndex(paths) {
  const submissions = await loadDocumentSubmissionsFromDatabase(paths.root);
  if (submissions.length > 0) {
    return {
      submissions: submissions.map((submission) => ({
        submission_id: submission.submission_id,
        profile_slug: submission.profile_slug,
        title: submission.title,
        category: submission.category,
        summary: submission.summary,
        updated_at: submission.updated_at,
        source: submission.source,
      })),
    };
  }

  return readJsonOrDefault(path.join(paths.documentSubmissionsRoot, "index.json"), { submissions: [] });
}

async function upsertRepositoryProfileRecord(serviceStorageRoot, profile) {
  if (isPostgresStorageEnabled()) {
    await upsertRepositoryProfileInPostgres({ profile });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO repository_profiles (
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          generated_at,
          payload_json
        )
        VALUES (
          :profile_slug,
          :workspace_slug,
          :customer_slug,
          :repo,
          :generated_at,
          :payload_json
        )
        ON CONFLICT(profile_slug) DO UPDATE SET
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          repo = excluded.repo,
          generated_at = excluded.generated_at,
          payload_json = excluded.payload_json
      `)
      .run({
        profile_slug: String(profile.profile_slug ?? ""),
        workspace_slug: String(profile.workspace_slug ?? profile.profile_slug ?? ""),
        customer_slug: String(profile.customer_slug ?? profile.profile_slug ?? ""),
        repo: String(profile.repo ?? ""),
        generated_at: String(profile.generated_at ?? ""),
        payload_json: JSON.stringify(profile),
      });
  });
}

async function upsertRepositoryDocumentRecord(serviceStorageRoot, artifact) {
  if (isPostgresStorageEnabled()) {
    await upsertRepositoryDocumentInPostgres({ artifact });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO repository_documents (
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          generated_at,
          document_count,
          payload_json
        )
        VALUES (
          :profile_slug,
          :workspace_slug,
          :customer_slug,
          :repo,
          :generated_at,
          :document_count,
          :payload_json
        )
        ON CONFLICT(profile_slug) DO UPDATE SET
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          repo = excluded.repo,
          generated_at = excluded.generated_at,
          document_count = excluded.document_count,
          payload_json = excluded.payload_json
      `)
      .run({
        profile_slug: String(artifact.profile_slug ?? ""),
        workspace_slug: String(artifact.workspace_slug ?? artifact.profile_slug ?? ""),
        customer_slug: String(artifact.customer_slug ?? artifact.profile_slug ?? ""),
        repo: String(artifact.repo ?? ""),
        generated_at: String(artifact.generated_at ?? ""),
        document_count: Number(artifact.totals?.document_count ?? artifact.documents?.length ?? 0),
        payload_json: JSON.stringify(artifact),
      });
  });
}

async function upsertDocumentSubmissionRecord(serviceStorageRoot, submission) {
  if (isPostgresStorageEnabled()) {
    await upsertDocumentSubmissionInPostgres({ submission });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO document_submissions (
          submission_id,
          profile_slug,
          workspace_slug,
          customer_slug,
          title,
          category,
          summary,
          updated_at,
          source,
          payload_json
        )
        VALUES (
          :submission_id,
          :profile_slug,
          :workspace_slug,
          :customer_slug,
          :title,
          :category,
          :summary,
          :updated_at,
          :source,
          :payload_json
        )
        ON CONFLICT(submission_id) DO UPDATE SET
          profile_slug = excluded.profile_slug,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          title = excluded.title,
          category = excluded.category,
          summary = excluded.summary,
          updated_at = excluded.updated_at,
          source = excluded.source,
          payload_json = excluded.payload_json
      `)
      .run({
        submission_id: String(submission.submission_id ?? ""),
        profile_slug: String(submission.profile_slug ?? ""),
        workspace_slug: String(submission.workspace_slug ?? submission.profile_slug ?? ""),
        customer_slug: String(submission.customer_slug ?? submission.profile_slug ?? ""),
        title: String(submission.title ?? ""),
        category: String(submission.category ?? ""),
        summary: String(submission.summary ?? ""),
        updated_at: String(submission.updated_at ?? ""),
        source: String(submission.source ?? "unknown"),
        payload_json: JSON.stringify(submission),
      });
  });
}

async function upsertBenchmarkReportRecord(serviceStorageRoot, report) {
  if (isPostgresStorageEnabled()) {
    await upsertBenchmarkReportInPostgres({ report });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO benchmark_reports (
          report_id,
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          scenario,
          provider,
          model,
          generated_at,
          token_savings_pct,
          memory_refresh_reduction_pct,
          payload_json
        )
        VALUES (
          :report_id,
          :profile_slug,
          :workspace_slug,
          :customer_slug,
          :repo,
          :scenario,
          :provider,
          :model,
          :generated_at,
          :token_savings_pct,
          :memory_refresh_reduction_pct,
          :payload_json
        )
        ON CONFLICT(report_id) DO UPDATE SET
          profile_slug = excluded.profile_slug,
          workspace_slug = excluded.workspace_slug,
          customer_slug = excluded.customer_slug,
          repo = excluded.repo,
          scenario = excluded.scenario,
          provider = excluded.provider,
          model = excluded.model,
          generated_at = excluded.generated_at,
          token_savings_pct = excluded.token_savings_pct,
          memory_refresh_reduction_pct = excluded.memory_refresh_reduction_pct,
          payload_json = excluded.payload_json
      `)
      .run({
        report_id: String(report.report_id ?? ""),
        profile_slug: String(report.profile_slug ?? ""),
        workspace_slug: String(report.workspace_slug ?? report.profile_slug ?? ""),
        customer_slug: String(report.customer_slug ?? report.profile_slug ?? ""),
        repo: String(report.repo ?? ""),
        scenario: String(report.scenario ?? ""),
        provider: String(report.provider ?? ""),
        model: String(report.model ?? ""),
        generated_at: String(report.generated_at ?? ""),
        token_savings_pct: Number(report.metrics?.token_savings_pct ?? 0),
        memory_refresh_reduction_pct: Number(report.metrics?.memory_refresh_reduction_pct ?? 0),
        payload_json: JSON.stringify(report),
      });
  });
}

async function replaceWorkspaceRecords(serviceStorageRoot, workspaces) {
  if (isPostgresStorageEnabled()) {
    await replaceWorkspaceRowsInPostgres({ workspaces });
    return;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database.exec("DELETE FROM workspaces");
    const statement = database.prepare(`
      INSERT INTO workspaces (
        workspace_slug,
        customer_slug,
        profile_slug,
        repo,
        latest_sync_at,
        profile_synced_at,
        documents_synced_at,
        latest_benchmark_at,
        payload_json
      )
      VALUES (
        :workspace_slug,
        :customer_slug,
        :profile_slug,
        :repo,
        :latest_sync_at,
        :profile_synced_at,
        :documents_synced_at,
        :latest_benchmark_at,
        :payload_json
      )
    `);

    for (const workspace of workspaces) {
      statement.run({
        workspace_slug: String(workspace.workspace_slug ?? ""),
        customer_slug: String(workspace.customer_slug ?? ""),
        profile_slug: String(workspace.profile_slug ?? workspace.workspace_slug ?? ""),
        repo: String(workspace.repo ?? ""),
        latest_sync_at: String(workspace.latest_sync_at ?? ""),
        profile_synced_at: String(workspace.profile_synced_at ?? ""),
        documents_synced_at: String(workspace.documents_synced_at ?? ""),
        latest_benchmark_at: String(workspace.latest_benchmark_at ?? ""),
        payload_json: JSON.stringify(workspace),
      });
    }
  });
}

async function loadRepositoryProfileIndexFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadRepositoryProfileIndexFromPostgres();
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          generated_at,
          payload_json
        FROM repository_profiles
        ORDER BY profile_slug
      `)
      .all()
      .map((row) => {
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
      }),
  );
}

async function loadRepositoryDocumentIndexFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadRepositoryDocumentIndexFromPostgres();
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT
          profile_slug,
          workspace_slug,
          customer_slug,
          repo,
          generated_at,
          payload_json
        FROM repository_documents
        ORDER BY profile_slug
      `)
      .all()
      .map((row) => {
        const payload = parsePayload(row.payload_json, {});
        return {
          profile_slug: row.profile_slug,
          workspace_slug: row.workspace_slug,
          customer_slug: row.customer_slug,
          repo: row.repo,
          generated_at: row.generated_at,
          totals: payload.totals ?? { document_count: payload.documents?.length ?? 0 },
          documents: (payload.documents ?? []).map((document) => ({
            path: document.path,
            title: document.title,
            category: document.category,
            summary: document.summary,
          })),
        };
      }),
  );
}

async function loadDocumentSubmissionsFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadDocumentSubmissionsFromPostgres();
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT payload_json
        FROM document_submissions
        ORDER BY updated_at DESC, submission_id ASC
      `)
      .all()
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean),
  );
}

async function loadBenchmarkIndexFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadBenchmarkIndexFromPostgres({
      createBenchmarkIndexEntry,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT payload_json
        FROM benchmark_reports
        ORDER BY generated_at DESC, report_id ASC
      `)
      .all()
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean)
      .map((report) => createBenchmarkIndexEntry(report)),
  );
}

async function loadBenchmarkHistoryEntriesFromDatabase(serviceStorageRoot, profileSlug) {
  if (isPostgresStorageEnabled()) {
    return loadBenchmarkHistoryEntriesFromPostgres({
      profileSlug,
      createBenchmarkIndexEntry,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT payload_json
        FROM benchmark_reports
        WHERE profile_slug = ?
        ORDER BY generated_at DESC, report_id ASC
      `)
      .all(String(profileSlug ?? ""))
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean)
      .map((report) => createBenchmarkIndexEntry(report)),
  );
}

async function loadWorkspaceRecordsFromDatabase(serviceStorageRoot) {
  if (isPostgresStorageEnabled()) {
    return loadWorkspaceRowsFromPostgres();
  }

  return withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare(`
        SELECT payload_json
        FROM workspaces
        ORDER BY workspace_slug
      `)
      .all()
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean),
  );
}

function parsePayload(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
