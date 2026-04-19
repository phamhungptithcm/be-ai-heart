import { createHash } from "node:crypto";
import path from "node:path";
import { scanDocumentTree } from "../../document-ingest/src/index.js";
import { buildHeartModel } from "../../entity-linker/src/index.js";
import { buildProjectGraph } from "../../graph/src/index.js";
import { scanSourceTree } from "../../parser-ts/src/index.js";
import { evaluatePolicyViolations, loadPolicyRules } from "../../policy-engine/src/index.js";
import { loadHeartConfig } from "./config.js";
import {
  getWorkspaceCachePaths,
  hydrateCachedGraph,
  loadCachedWorkspaceState,
  persistWorkspaceState,
} from "./storage.js";

export async function buildWorkspaceState(repoRoot, options = {}) {
  const configState = await loadHeartConfig(repoRoot);
  const policyState = await loadPolicyRules(repoRoot, {
    rulesFile: configState.config.policies?.rules_file,
  });
  const cachePaths = getWorkspaceCachePaths(repoRoot);
  const cacheEntry = options.forceRescan ? null : await loadCachedWorkspaceState(repoRoot);
  const documentRoots = dedupeDocumentRoots([
    ...(configState.config.knowledge?.document_paths ?? []),
    ".heart/imported-documents",
  ]);
  const scanResult = await scanSourceTree(repoRoot, {
    ignore: configState.config.project.ignore,
    previousScanResult: cacheEntry?.scanResult,
  });
  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: documentRoots,
    ignore: configState.config.project.ignore,
    previousDocumentIndex: cacheEntry?.documentIndex,
  });
  const scanProvenance = createScanProvenance({
    repoRoot,
    configState,
    policyState,
    documentRoots,
  });
  const cache = summarizeCacheState({
    cacheEntry,
    scanResult,
    documentIndex,
    cachePaths,
    forceRescan: options.forceRescan === true,
    scanProvenance,
  });

  if (cache.status === "hit" && cacheEntry) {
    return {
      repoRoot,
      configState,
      policyState,
      scanProvenance: cacheEntry.scanProvenance,
      scanResult,
      documentIndex,
      graph: hydrateCachedGraph(cacheEntry, scanResult),
      heartModel: cacheEntry.heartModel,
      policyReport: cacheEntry.policyReport,
      cache,
    };
  }

  const heartModel = buildHeartModel({
    scanResult,
    documentIndex,
  });
  const policyReport = evaluatePolicyViolations(scanResult, policyState.rules);
  const graph = buildProjectGraph(scanResult, {
    repoName: path.basename(repoRoot),
    documentIndex,
    policyReport,
  });
  await persistWorkspaceState(repoRoot, {
    scanProvenance,
    scanResult,
    documentIndex,
    graph,
    heartModel,
    policyReport,
  });

  return {
    repoRoot,
    configState,
    policyState,
    scanProvenance,
    scanResult,
    documentIndex,
    graph,
    heartModel,
    policyReport,
    cache,
  };
}

function summarizeCacheState({ cacheEntry, scanResult, documentIndex, cachePaths, forceRescan, scanProvenance }) {
  const sourceChanges = scanResult.incremental ?? emptySourceChanges();
  const documentChanges = documentIndex.incremental ?? emptyDocumentChanges();
  const sameProvenance =
    JSON.stringify(cacheEntry?.scanProvenance ?? null) === JSON.stringify(scanProvenance);
  const noSourceChanges =
    sourceChanges.changed_file_count === 0 &&
    sourceChanges.added_file_count === 0 &&
    sourceChanges.removed_file_count === 0;
  const noDocumentChanges =
    documentChanges.changed_document_count === 0 &&
    documentChanges.added_document_count === 0 &&
    documentChanges.removed_document_count === 0;

  let status = "created";
  if (forceRescan) {
    status = "rebuild";
  } else if (cacheEntry && noSourceChanges && noDocumentChanges && sameProvenance) {
    status = "hit";
  } else if (cacheEntry) {
    status = "updated";
  }

  return {
    status,
    state_path: cachePaths.workspaceStatePath,
    provenance_changed: Boolean(cacheEntry) && sameProvenance === false,
    source_changes: sourceChanges,
    document_changes: documentChanges,
  };
}

function emptySourceChanges() {
  return {
    reused_file_count: 0,
    reparsed_file_count: 0,
    added_file_count: 0,
    changed_file_count: 0,
    removed_file_count: 0,
  };
}

function emptyDocumentChanges() {
  return {
    reused_document_count: 0,
    reparsed_document_count: 0,
    added_document_count: 0,
    changed_document_count: 0,
    removed_document_count: 0,
  };
}

function dedupeDocumentRoots(roots) {
  return [...new Set(roots.filter(Boolean))];
}

function createScanProvenance({ repoRoot, configState, policyState, documentRoots }) {
  return {
    repo_root: repoRoot,
    config_path: configState.path,
    config_exists: configState.exists,
    config_hash: hashString(configState.raw),
    policy_path: policyState.path,
    policy_exists: policyState.exists,
    policy_hash: hashString(policyState.raw),
    ignore_paths: [...(configState.config.project.ignore ?? [])],
    document_roots: [...documentRoots],
  };
}

function hashString(value) {
  return createHash("sha256").update(value ?? "").digest("hex");
}
