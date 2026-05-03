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
  const firstRun = createFirstRunChecklist({
    repoRoot,
    configState,
    policyState,
    cache,
    effectiveEnabledTools,
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
      first_run_next_command: firstRun.next_command,
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
    first_run: firstRun,
    warnings,
    actions,
  };
}

export function createFirstRunChecklist({
  repoRoot,
  configState = {},
  policyState = {},
  cache = {},
  effectiveEnabledTools = [],
} = {}) {
  const initReady = configState.status === "loaded" && policyState.status === "loaded";
  const scanReady = cache.status === "ready";
  const mcpReady = effectiveEnabledTools.length > 0;
  const steps = [
    firstRunStep({
      id: "init",
      label: "Create local config and policies",
      status: initReady ? "done" : "next",
      command: `heart init --root ${repoRoot}`,
      detail: initReady
        ? "heart.config.yaml and .heart/policies.yaml are present."
        : "Create the local scaffold before scanning.",
    }),
    firstRunStep({
      id: "doctor",
      label: "Check local readiness",
      status: "done",
      command: `heart doctor --root ${repoRoot}`,
      detail: "This report is the current readiness check.",
    }),
    firstRunStep({
      id: "scan",
      label: "Build durable repo memory",
      status: scanReady ? "done" : initReady ? "next" : "pending",
      command: `heart scan --root ${repoRoot}`,
      detail: scanReady
        ? "Workspace cache is ready."
        : "Create the graph, document memory, and cache artifacts.",
    }),
    firstRunStep({
      id: "overview",
      label: "Inspect repo memory",
      status: scanReady ? "available" : "pending",
      command: `heart overview --root ${repoRoot}`,
      detail: "Review graph health, docs, policies, and readiness before agent work.",
    }),
    firstRunStep({
      id: "pack",
      label: "Generate a task context pack",
      status: scanReady ? "available" : "pending",
      command: `heart pack --root ${repoRoot} "your task"`,
      detail: "Use a concrete task so Heart can rank context and trim tokens.",
    }),
    firstRunStep({
      id: "mcp_serve",
      label: "Connect an AI coding tool",
      status: !mcpReady ? "blocked" : scanReady ? "available" : "pending",
      command: `heart mcp serve --root ${repoRoot}`,
      detail: mcpReady
        ? "MCP tools are enabled for local agent workflows."
        : "MCP tools are disabled in heart.config.yaml.",
    }),
  ];
  const nextStep = steps.find((step) => ["next", "blocked"].includes(step.status)) ??
    steps.find((step) => step.status === "available") ??
    null;

  return {
    schema_version: 1,
    completed_count: steps.filter((step) => step.status === "done").length,
    total_count: steps.length,
    next_step: nextStep?.id ?? null,
    next_command: nextStep?.command ?? null,
    steps,
  };
}

function firstRunStep({ id, label, status, command, detail }) {
  return {
    id,
    label,
    status,
    command,
    detail,
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
