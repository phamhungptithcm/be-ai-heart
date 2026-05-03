import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hydrateProjectGraph, snapshotProjectGraph } from "../../graph/src/index.js";

export const WORKSPACE_CACHE_SCHEMA_VERSION = 5;

export function getWorkspaceCachePaths(repoRoot) {
  const cacheDir = path.join(repoRoot, ".heart", "cache");
  return {
    cacheDir,
    workspaceStatePath: path.join(cacheDir, "workspace-state.json"),
  };
}

export async function loadCachedWorkspaceState(repoRoot) {
  const { workspaceStatePath } = getWorkspaceCachePaths(repoRoot);

  try {
    const raw = await fs.readFile(workspaceStatePath, "utf8");
    const payload = JSON.parse(raw);

    if (!isValidWorkspacePayload(payload)) {
      return null;
    }

    if (!isPortableWorkspacePayload(payload, repoRoot)) {
      return null;
    }

    return {
      schemaVersion: payload.schema_version,
      savedAt: payload.saved_at,
      scanProvenance: payload.scan_provenance ?? null,
      readiness: payload.readiness ?? null,
      scanResult: payload.scan_result,
      documentIndex: payload.document_index,
      graphSnapshot: payload.graph_snapshot,
      heartModel: payload.heart_model,
      policyReport: payload.policy_report,
      path: workspaceStatePath,
    };
  } catch {
    return null;
  }
}

export async function persistWorkspaceState(repoRoot, state) {
  const { cacheDir, workspaceStatePath } = getWorkspaceCachePaths(repoRoot);
  const tempPath = `${workspaceStatePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;

  await fs.mkdir(cacheDir, { recursive: true });

  const payload = {
    schema_version: WORKSPACE_CACHE_SCHEMA_VERSION,
    saved_at: new Date().toISOString(),
    scan_provenance: state.scanProvenance,
    readiness: state.readiness,
    scan_result: state.scanResult,
    document_index: state.documentIndex,
    graph_snapshot: snapshotProjectGraph(state.graph, {
      root: ".",
      repoRoot,
      scanProvenance: state.scanProvenance,
    }),
    heart_model: state.heartModel,
    policy_report: state.policyReport,
  };

  try {
    await fs.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, workspaceStatePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => null);
    throw error;
  }

  return workspaceStatePath;
}

export function hydrateCachedGraph(cacheEntry, scanResult) {
  return hydrateProjectGraph(cacheEntry.graphSnapshot, scanResult);
}

function isValidWorkspacePayload(payload) {
  if (!payload || payload.schema_version !== WORKSPACE_CACHE_SCHEMA_VERSION) {
    return false;
  }

  if (
    !payload.scan_provenance ||
    !payload.scan_result ||
    !payload.document_index ||
    !payload.graph_snapshot ||
    !payload.heart_model ||
    !payload.policy_report
  ) {
    return false;
  }

  if (!Array.isArray(payload.scan_result.files) || !Array.isArray(payload.document_index.documents)) {
    return false;
  }

  if (!Array.isArray(payload.graph_snapshot.nodes) || !Array.isArray(payload.graph_snapshot.edges)) {
    return false;
  }

  if (!Array.isArray(payload.heart_model.domains) || !Array.isArray(payload.heart_model.links)) {
    return false;
  }

  return true;
}

function isPortableWorkspacePayload(payload, repoRoot) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const provenance = payload.scan_provenance ?? {};

  if (provenance.repo_root && path.resolve(provenance.repo_root) !== resolvedRepoRoot) {
    return false;
  }

  return [provenance.config_path, provenance.policy_path].every(
    (candidatePath) => candidatePath == null || isWithinRepoRoot(candidatePath, resolvedRepoRoot),
  );
}

function isWithinRepoRoot(candidatePath, repoRoot) {
  const resolvedCandidate = path.resolve(candidatePath);
  return resolvedCandidate === repoRoot || resolvedCandidate.startsWith(`${repoRoot}${path.sep}`);
}
