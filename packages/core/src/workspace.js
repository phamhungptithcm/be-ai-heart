import { createHash } from "node:crypto";
import path from "node:path";
import { scanDocumentTree } from "../../document-ingest/src/index.js";
import { buildHeartModel } from "../../entity-linker/src/index.js";
import { buildProjectGraph } from "../../graph/src/index.js";
import { scanSourceTree } from "../../parser-ts/src/index.js";
import { evaluatePolicyViolations, loadPolicyRules } from "../../policy-engine/src/index.js";
import { DEFAULT_IGNORE_PATHS } from "../../shared-schema/src/index.js";
import { loadHeartConfig, resolveDocumentRoots, resolveProjectIgnorePaths } from "./config.js";
import {
  WORKSPACE_CACHE_SCHEMA_VERSION,
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
  const documentRoots = resolveDocumentRoots(configState.config);
  const ignorePaths = resolveProjectIgnorePaths(configState.config);
  const scanResult = await scanSourceTree(repoRoot, {
    ignore: ignorePaths,
    previousScanResult: cacheEntry?.scanResult,
  });
  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: documentRoots,
    ignore: ignorePaths,
    previousDocumentIndex: cacheEntry?.documentIndex,
  });
  const scanProvenance = createScanProvenance({
    repoRoot,
    configState,
    policyState,
    documentRoots,
    ignorePaths,
  });
  const cache = summarizeCacheState({
    cacheEntry,
    scanResult,
    documentIndex,
    cachePaths,
    forceRescan: options.forceRescan === true,
    scanProvenance,
  });
  const readiness = createWorkspaceReadinessSummary({
    configState,
    policyState,
    scanResult,
    documentIndex,
    cache,
    documentRoots,
    ignorePaths,
  });

  if (cache.status === "hit" && cacheEntry) {
    return {
      repoRoot,
      configState,
      policyState,
      scanProvenance: cacheEntry.scanProvenance,
      readiness,
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
    heartModel,
  });
  await persistWorkspaceState(repoRoot, {
    scanProvenance,
    readiness,
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
    readiness,
    scanResult,
    documentIndex,
    graph,
    heartModel,
    policyReport,
    cache,
  };
}

export function createWorkspaceReadinessSummary({
  configState = { status: "unknown", exists: false, errors: [] },
  policyState = { status: "unknown", exists: false, errors: [] },
  scanResult = { parser_engine: "unknown", totals: {} },
  documentIndex = { totals: {} },
  cache = { status: "unknown" },
  documentRoots = [],
  ignorePaths = [],
} = {}) {
  const effectiveIgnores = Array.isArray(ignorePaths) ? ignorePaths : [];
  const requiredNoiseIgnores = [
    ".next",
    "dist",
    "build",
    "out",
    "vendor",
    ".heart/cache",
    ".heart/diagrams",
    ".heart/benchmarks",
  ];
  const missingNoiseIgnores = requiredNoiseIgnores.filter(
    (entry) => !effectiveIgnores.includes(entry),
  );
  const blockingErrors = [];
  const warnings = [];

  if (configState.status === "invalid") {
    blockingErrors.push("Config is invalid.");
  } else if (configState.status !== "loaded") {
    warnings.push(`Config status is ${configState.status}.`);
  }

  if (policyState.status === "invalid") {
    blockingErrors.push("Policy is invalid.");
  } else if (policyState.status !== "loaded") {
    warnings.push(`Policy status is ${policyState.status}.`);
  }

  if (missingNoiseIgnores.length > 0) {
    warnings.push(`Generated/vendor ignore defaults are incomplete: ${missingNoiseIgnores.join(", ")}.`);
  }

  if (scanResult.parser_engine !== "typescript-ast") {
    warnings.push("Parser is not using the TypeScript AST engine.");
  }

  if (cache.status === "invalid") {
    blockingErrors.push("Workspace cache is invalid.");
  }

  if ((documentIndex.totals?.document_count ?? 0) === 0) {
    warnings.push("No project documents were discovered in the effective document roots.");
  }

  return {
    schema_version: 1,
    status: blockingErrors.length > 0 ? "blocked" : warnings.length > 0 ? "attention_required" : "ready",
    blocking_error_count: blockingErrors.length,
    warning_count: warnings.length,
    config_status: configState.status,
    policy_status: policyState.status,
    generated_noise_exclusion: {
      status: missingNoiseIgnores.length === 0 ? "ready" : "attention_required",
      required_ignore_paths: requiredNoiseIgnores,
      default_ignore_count: DEFAULT_IGNORE_PATHS.length,
      effective_ignore_count: effectiveIgnores.length,
      missing_ignore_paths: missingNoiseIgnores,
    },
    cache: {
      status: cache.status,
      provenance_changed: Boolean(cache.provenance_changed),
    },
    parser: {
      engine: scanResult.parser_engine,
      source_file_count: scanResult.totals?.file_count ?? 0,
      symbol_count: scanResult.totals?.symbol_count ?? 0,
      warning_count: scanResult.totals?.warning_count ?? 0,
    },
    documents: {
      count: documentIndex.totals?.document_count ?? 0,
      roots: [...documentRoots],
    },
    blocking_errors: blockingErrors,
    warnings,
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

function createScanProvenance({ repoRoot, configState, policyState, documentRoots, ignorePaths }) {
  return {
    repo_root: repoRoot,
    cache_schema_version: WORKSPACE_CACHE_SCHEMA_VERSION,
    config_path: configState.path,
    config_exists: configState.exists,
    config_hash: hashString(configState.raw),
    policy_path: policyState.path,
    policy_exists: policyState.exists,
    policy_hash: hashString(policyState.raw),
    default_ignore_paths: resolveProjectIgnorePaths({ project: { ignore: [] } }),
    configured_ignore_paths: [...(configState.config.project.ignore ?? [])],
    ignore_paths: [...ignorePaths],
    document_roots: [...documentRoots],
  };
}

function hashString(value) {
  return createHash("sha256").update(value ?? "").digest("hex");
}
