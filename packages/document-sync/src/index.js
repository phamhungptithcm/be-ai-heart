import fs from "node:fs/promises";
import path from "node:path";
import {
  listDocumentSubmissionRecords,
  publishDocumentsToSurface,
  publishDocumentSubmissionsToSurface,
  publishWorkspacesToSurface,
  resolveServiceStorageRoot,
  writeDocumentSubmissionRecord,
  writeRepositoryDocumentArtifactRecord,
} from "../../../services/api/src/storage.js";

export async function publishRepositoryDocuments({
  surfaceRoot,
  serviceStorageRoot,
  profileSlug,
  repo,
  documentIndex,
}) {
  const webArtifact = createWebDocumentArtifact({
    profileSlug,
    repo,
    documentIndex,
  });
  const storageRoot = resolveServiceStorageRoot({
    serviceStorageRoot,
    portalRoot: surfaceRoot,
  });
  const persisted = await writeRepositoryDocumentArtifactRecord({
    serviceStorageRoot: storageRoot,
    artifact: webArtifact,
  });

  if (!surfaceRoot) {
    return persisted;
  }

  const mirrored = await publishDocumentsToSurface({
    serviceStorageRoot: storageRoot,
    surfaceRoot,
  });
  await publishWorkspacesToSurface({
    serviceStorageRoot: storageRoot,
    surfaceRoot,
  });

  return {
    ...persisted,
    ...mirrored,
    repository_path: persisted.repository_path,
  };
}

export function prepareRepositoryDocumentArtifact({
  profileSlug,
  repo,
  documentIndex,
} = {}) {
  return createWebDocumentArtifact({
    profileSlug,
    repo,
    documentIndex,
  });
}

export async function syncRepositoryDocumentsToSurfaces({
  repoRoot,
  profileSlug,
  repo,
  documentIndex,
  portalRoot,
  adminRoot,
  serviceStorageRoot,
} = {}) {
  const storageRoot = resolveServiceStorageRoot({
    serviceStorageRoot,
    repoRoot,
    portalRoot,
    adminRoot,
  });
  const persisted = await publishRepositoryDocuments({
    profileSlug,
    repo,
    documentIndex,
    serviceStorageRoot: storageRoot,
  });
  const destinations = [portalRoot, adminRoot]
    .filter(Boolean)
    .map((root) => ({
      kind: root === portalRoot ? "portal" : "admin",
      root,
    }));
  const syncedDestinations = [];

  for (const destination of destinations) {
    const mirrored = await publishDocumentsToSurface({
      serviceStorageRoot: storageRoot,
      surfaceRoot: destination.root,
    });
    await publishWorkspacesToSurface({
      serviceStorageRoot: storageRoot,
      surfaceRoot: destination.root,
    });
    syncedDestinations.push({
      kind: destination.kind,
      root: destination.root,
      index_path: mirrored.index_path,
      repository_path: persisted.repository_path,
    });
  }

  return {
    service_storage_root: storageRoot,
    repository_path: persisted.repository_path,
    synced_destinations: syncedDestinations,
  };
}

export async function writeWebDocumentSubmission({
  portalRoot,
  adminRoot,
  serviceStorageRoot,
  submission,
}) {
  const normalized = normalizeSubmission(submission);
  const storageRoot = resolveServiceStorageRoot({
    serviceStorageRoot,
    portalRoot,
    adminRoot,
  });
  const targets = [portalRoot, adminRoot].filter(Boolean);
  const persisted = await writeDocumentSubmissionRecord({
    serviceStorageRoot: storageRoot,
    submission: normalized,
  });

  for (const targetRoot of targets) {
    await publishDocumentSubmissionsToSurface({
      serviceStorageRoot: storageRoot,
      surfaceRoot: targetRoot,
    });
    await publishWorkspacesToSurface({
      serviceStorageRoot: storageRoot,
      surfaceRoot: targetRoot,
    });
  }

  return {
    ...normalized,
    ...persisted,
  };
}

export async function pullWebDocumentSubmissions({
  repoRoot,
  portalRoot,
  profileSlug,
  serviceStorageRoot,
}) {
  const targetRoot = path.join(repoRoot, ".heart", "imported-documents", "web");
  const matchedProfileSlug = sanitizeSlug(profileSlug ?? path.basename(repoRoot));
  const storageRoot = resolveServiceStorageRoot({
    serviceStorageRoot,
    portalRoot,
    repoRoot,
  });
  await fs.mkdir(targetRoot, { recursive: true });

  const records = await loadSubmissionRecords(storageRoot, portalRoot);
  if (records.length === 0) {
    return {
      imported_count: 0,
      matched_profile_slug: matchedProfileSlug,
      target_root: targetRoot,
    };
  }

  let importedCount = 0;
  for (const payload of records) {
    const payloadProfileSlug = sanitizeSlug(payload.profile_slug ?? "");
    if (payloadProfileSlug !== matchedProfileSlug) {
      continue;
    }

    const targetPath = path.join(targetRoot, `${payload.submission_id}.json`);
    await fs.writeFile(
      targetPath,
      `${JSON.stringify(
        {
          submission_id: payload.submission_id,
          title: payload.title,
          category: payload.category,
          summary: payload.summary,
          body: payload.body,
          profile_slug: payload.profile_slug,
          source: "portal-web-upload",
          source_path: payload.source_path ?? "",
          uploaded_at: payload.updated_at,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    importedCount += 1;
  }

  return {
    imported_count: importedCount,
    matched_profile_slug: matchedProfileSlug,
    service_storage_root: storageRoot,
    target_root: targetRoot,
  };
}

export async function importLocalDocument({
  repoRoot,
  sourcePath,
  title,
  category,
  summary,
  profileSlug,
}) {
  const absoluteSourcePath = path.resolve(sourcePath);
  const body = await fs.readFile(absoluteSourcePath, "utf8");
  const importedRoot = path.join(repoRoot, ".heart", "imported-documents", "local");
  const fileName = `${sanitizeSlug(title || path.basename(absoluteSourcePath, path.extname(absoluteSourcePath)))}.json`;

  await fs.mkdir(importedRoot, { recursive: true });
  await fs.writeFile(
    path.join(importedRoot, fileName),
    `${JSON.stringify(
      {
        title: title || path.basename(absoluteSourcePath, path.extname(absoluteSourcePath)),
        category: category || "business",
        summary: summary || body.trim().slice(0, 280),
        body,
        profile_slug: profileSlug || path.basename(repoRoot),
        source: "cli-import",
        source_path: absoluteSourcePath,
        imported_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return {
    imported_root: importedRoot,
    imported_path: path.join(importedRoot, fileName),
  };
}

function createWebDocumentArtifact({ profileSlug, repo, documentIndex }) {
  return {
    schema_version: 2,
    profile_slug: sanitizeSlug(profileSlug),
    workspace_slug: sanitizeSlug(profileSlug),
    customer_slug: sanitizeSlug(profileSlug),
    repo,
    generated_at: new Date().toISOString(),
    totals: documentIndex.totals,
    documents: documentIndex.documents.map((document) => ({
      document_id: document.document_id ?? `document:${sanitizeSlug(document.path)}`,
      path: document.path,
      source: document.source ?? {
        type: document.source_type ?? "",
        path: document.path,
      },
      source_type: document.source_type ?? "",
      title: document.title,
      category: document.category,
      headings: document.headings,
      summary:
        document.sensitivity?.level === "restricted"
          ? "Restricted document. Summary redacted from synced artifact."
          : document.summary,
      content_preview: document.content_preview ?? "",
      freshness: document.freshness ?? {},
      version_ref: document.version_ref ?? {},
      lineage: document.lineage ?? {},
      sensitivity: document.sensitivity ?? { level: "internal", reasons: [] },
      extraction: document.extraction ?? {},
      citations: document.citations ?? [],
    })),
  };
}

function normalizeSubmission(submission = {}) {
  const title = String(submission.title ?? "Untitled business document").trim();
  const body = String(submission.body ?? "").trim();
  const profileSlug = sanitizeSlug(submission.profile_slug ?? "project");
  const workspaceSlug = sanitizeSlug(submission.workspace_slug ?? profileSlug);
  const customerSlug = sanitizeSlug(submission.customer_slug ?? workspaceSlug);
  const defaultSubmissionId = `${profileSlug}-${title}`;

  return {
    schema_version: 1,
    submission_id: sanitizeSlug(submission.submission_id ?? defaultSubmissionId),
    profile_slug: profileSlug,
    workspace_slug: workspaceSlug,
    customer_slug: customerSlug,
    title,
    category: String(submission.category ?? "business").trim().toLowerCase(),
    summary: String(submission.summary ?? body.slice(0, 280)).trim(),
    body,
    repo: String(submission.repo ?? profileSlug).trim(),
    source: String(submission.source ?? "portal-web-upload"),
    source_path: String(submission.source_path ?? ""),
    updated_at: submission.updated_at ?? new Date().toISOString(),
  };
}

async function loadSubmissionRecords(serviceStorageRoot, portalRoot) {
  const records = await listDocumentSubmissionRecords({
    serviceStorageRoot,
  });

  if (records.length > 0) {
    return records;
  }

  return loadLegacyPortalSubmissionRecords(portalRoot);
}

async function loadLegacyPortalSubmissionRecords(portalRoot) {
  if (!portalRoot) {
    return [];
  }

  const sourceRoot = path.join(portalRoot, "uploads", "document-submissions");
  let entries;
  try {
    entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const records = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    records.push(JSON.parse(await fs.readFile(path.join(sourceRoot, entry.name), "utf8")));
  }

  return records;
}

function sanitizeSlug(value) {
  return String(value ?? "document")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "document";
}
