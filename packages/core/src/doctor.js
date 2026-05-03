import fs from "node:fs/promises";
import { scanDocumentTree } from "../../document-ingest/src/index.js";
import { scanSourceTree } from "../../parser-ts/src/index.js";
import { loadPolicyRules } from "../../policy-engine/src/index.js";
import {
  KNOWN_MCP_TOOL_NAMES,
  loadHeartConfig,
  resolveDocumentRoots,
  resolveEnabledMcpTools,
  resolveProjectIgnorePaths,
} from "./config.js";
import { detectProjectEnvironment } from "./environment.js";
import { getWorkspaceCachePaths, loadCachedWorkspaceState } from "./storage.js";
import { createWorkspaceReadinessSummary } from "./workspace.js";

export async function runWorkspaceDoctor(repoRoot) {
  const configState = await loadHeartConfig(repoRoot);
  const policyState = await loadPolicyRules(repoRoot, {
    rulesFile: configState.config.policies?.rules_file,
  });
  const documentRoots = resolveDocumentRoots(configState.config);
  const ignorePaths = resolveProjectIgnorePaths(configState.config);
  const scanResult = await scanSourceTree(repoRoot, {
    ignore: ignorePaths,
  });
  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: documentRoots,
    ignore: ignorePaths,
  });
  const environment = await detectProjectEnvironment(repoRoot, {
    scanResult,
    ignore: ignorePaths,
  });
  const cache = await readCacheStatus(repoRoot);
  const effectiveEnabledTools = resolveEnabledMcpTools(configState.config.mcp?.enabled_tools);
  const readiness = createWorkspaceReadinessSummary({
    configState,
    policyState,
    scanResult,
    documentIndex,
    cache,
    documentRoots,
    ignorePaths,
  });
  const warnings = [
    ...readiness.blocking_errors,
    ...readiness.warnings,
    ...buildMcpWarnings({ environment, effectiveEnabledTools }),
  ];
  const actions = buildActions({
    repoRoot,
    configState,
    policyState,
    cache,
    environment,
    effectiveEnabledTools,
    documentIndex,
  });
  const status =
    readiness.blocking_error_count > 0
      ? "blocked"
      : warnings.length > 0
        ? "attention_required"
        : "ready";

  return {
    status,
    repo_root: repoRoot,
    summary: {
      warning_count: warnings.length,
      action_count: actions.length,
      next_action: actions[0] ?? null,
    },
    config: {
      path: configState.path,
      exists: configState.exists,
      status: configState.status,
      errors: [...configState.errors],
    },
    policy: {
      path: policyState.path,
      exists: policyState.exists,
      status: policyState.status,
      errors: [...policyState.errors],
      rule_count: policyState.rules.length,
    },
    readiness,
    detected: environment,
    document_roots: documentRoots,
    ignore_paths: ignorePaths,
    parser: {
      engine: scanResult.parser_engine,
      available: scanResult.parser_engine === "typescript-ast",
      warning_count: scanResult.totals.warning_count,
      source_file_count: scanResult.totals.file_count,
      document_count: documentIndex.totals.document_count,
    },
    cache,
    mcp: {
      available_tools: [...KNOWN_MCP_TOOL_NAMES],
      configured_enabled_tools: [...(configState.config.mcp?.enabled_tools ?? [])],
      effective_enabled_tools: effectiveEnabledTools,
      disabled_tools: KNOWN_MCP_TOOL_NAMES.filter((tool) => !effectiveEnabledTools.includes(tool)),
    },
    warnings,
    actions,
  };
}

async function readCacheStatus(repoRoot) {
  const { workspaceStatePath } = getWorkspaceCachePaths(repoRoot);
  const exists = await fileExists(workspaceStatePath);
  const cacheEntry = exists ? await loadCachedWorkspaceState(repoRoot) : null;

  return {
    path: workspaceStatePath,
    exists,
    status: exists ? (cacheEntry ? "ready" : "invalid") : "missing",
    schema_version: cacheEntry?.schemaVersion ?? null,
    saved_at: cacheEntry?.savedAt ?? null,
  };
}

function buildMcpWarnings({ environment, effectiveEnabledTools }) {
  const warnings = [];

  if (environment.parser_engine !== "typescript-ast") {
    warnings.push("Parser is running in regex-fallback mode; typed graph coverage will be limited.");
  }

  if (effectiveEnabledTools.length === 0) {
    warnings.push("MCP tool surface is fully disabled by mcp.enabled_tools.");
  }

  return warnings;
}

function buildActions({ repoRoot, configState, policyState, cache, environment, effectiveEnabledTools }) {
  const actions = [];

  if (configState.status === "missing") {
    actions.push(`Run heart init --root ${repoRoot}`);
  }

  if (policyState.status !== "loaded") {
    actions.push(`Review ${policyState.path}`);
  }

  if (cache.status !== "ready") {
    actions.push(`Run heart scan --root ${repoRoot}`);
  }

  if (environment.parser_engine !== "typescript-ast") {
    actions.push("Install project dependencies so heart can use the TypeScript AST parser.");
  }

  if (effectiveEnabledTools.length !== KNOWN_MCP_TOOL_NAMES.length) {
    actions.push(`Run heart mcp tools --json --root ${repoRoot} to verify the filtered MCP surface.`);
  }

  if (actions.length === 0) {
    actions.push(`Run heart overview --root ${repoRoot}`);
  }

  return actions;
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
