import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { createInterface as createPromptInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  buildInstallPlan,
  detectConnections,
  installConnection,
  runConnectDoctor,
  verifyConnection,
} from "../../connect/src/index.js";
import {
  compareBenchmarkRuns,
  loadBenchmarkScenario,
  loadBenchmarkReport,
  mergeObservedRunIntoBenchmarkInput,
  prepareBenchmarkReportArtifact,
  publishBenchmarkReport,
  runBenchmarkScenario,
  runBenchmarkSuite,
  writeBenchmarkEvidenceBundle,
  writeBenchmarkReport,
  writeBenchmarkSuiteReport,
} from "../../benchmark/src/index.js";
import {
  KNOWN_MCP_TOOL_NAMES,
  buildWorkspaceState,
  createDefaultConfigYaml,
  detectProjectEnvironment,
  detectPackLayerConflicts,
  getDomainPack,
  listDomainPacks,
  listGeneratedPackArtifacts,
  listPackLayers,
  loadHeartConfig,
  readGeneratedPackArtifact,
  resolveEnabledMcpTools,
  runWorkspaceDoctor,
  syncGeneratedPackArtifact,
  validateDomainPack,
  writePackArtifact,
} from "../../core/src/index.js";
import { compileContextPack } from "../../context-compiler/src/index.js";
import {
  generateDiagramBundle,
  prepareRepositoryProfileArtifact,
  resolveDiagramTypes,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../../diagram-generator/src/index.js";
import { findRelevantDocuments } from "../../document-ingest/src/index.js";
import {
  importLocalDocument,
  prepareRepositoryDocumentArtifact,
  pullWebDocumentSubmissions,
  syncRepositoryDocumentsToSurfaces,
} from "../../document-sync/src/index.js";
import {
  createRepositoryContextPackRemote,
  exchangeProviderSessionRemote,
  resolveSessionRemote,
  syncBenchmarkReportRemote,
  syncRepositoryDocumentsRemote,
  syncRepositoryProfileRemote,
} from "./http-client.js";
import {
  deleteCliCredentials,
  loadCliCredentials,
  redactSecret,
  saveCliCredentials,
} from "./credentials.js";
import {
  createProviderValidationPlan,
  getProviderDefinition,
  getPricingCatalog,
  listProviderModels,
  listProviders,
  parseProviderModelSpec,
  resolveProviderCredential,
} from "../../model-registry/src/index.js";
import {
  sendModelRequest,
  streamModelResponse,
  validateProviderCredential,
} from "../../ai-gateway/src/index.js";
import {
  attachDocs,
  attachDomainPack,
  attachRepoGraph,
  buildContextAttachment,
  sendChatMessage,
} from "../../chat-runtime/src/index.js";
import {
  buildWorkbenchSession,
  ideHelpText,
  openCommandPalette,
  renderWorkbenchLayout,
  startIdeWorkbench,
} from "../../cli-workbench/src/index.js";
import {
  openExternalEditor,
  openFile,
  searchFiles,
} from "../../editor-core/src/index.js";
import {
  applyPatchWithConfirmation,
  previewPatch,
  rollbackAiPatch,
} from "../../diff-engine/src/index.js";
import {
  buildDiagnosticsNavigation,
  discoverPackageScripts,
  parseDiagnosticsFromOutput,
  runLint,
  runProjectTask,
  runTests,
  runTypecheck,
} from "../../dev-runner/src/index.js";
import {
  buildGitStagePicker,
  generateCommitSummary,
  generatePrSummary,
  getGitDiff,
  getGitReview,
  getGitStatus,
  selectGitStagePickerChoices,
  stageSelectedFiles,
  unstageSelectedFiles,
} from "../../git-workflow/src/index.js";
import {
  collectLspDiagnosticsStream,
  parseLspDiagnosticsPayload,
  probeLspServer,
} from "../../lsp-adapter/src/index.js";
import { loadKeymap } from "../../keymap/src/index.js";
import { listAllowedTools } from "../../agent-tools/src/index.js";
import {
  addCliProviderKey,
  deleteCliProviderKey,
  getCliProviderCredential,
  loadCliModelConfig,
  redactCliModelConfig,
  resolveCliSelectedModel,
  selectCliModel,
} from "./model-credentials.js";
import {
  createDependencyExplanation,
  createImpactAnalysis,
  createProjectOverview,
  searchSymbols,
} from "../../graph/src/index.js";
import {
  createDefaultGenerationPlan,
  generateProjectFromDomainAndStack,
  listGenerationModes,
  listStackPresets,
  previewGenerationPlan,
} from "../../project-generator/src/index.js";
import { explainStackTradeoffs } from "../../stack-presets/src/index.js";
import { createToolRegistry, startStdioServer } from "../../mcp-server/src/index.js";
import { createDefaultPoliciesYaml } from "../../policy-engine/src/index.js";
import { writeCanonicalSnapshot } from "../../../services/api/src/migration.js";
import {
  loadAgentRunCapture,
  startServiceHost,
  writeAgentRunRecord,
} from "../../../services/api/src/index.js";
import { resolveServiceStorageRoot } from "../../../services/api/src/storage.js";
import {
  detectInteractiveTerminal,
  startHeartSession,
} from "./interactive.js";

const EXIT_USAGE_ERROR = 2;
const EXIT_NOT_FOUND = 3;
const DEFAULT_BEHEART_API_URL = "https://api.beheart.dev";
const DEFAULT_BEHEART_PORTAL_URL = "https://portal.beheart.dev";

export async function runCli(argv, io = defaultIo()) {
  const parsedArgs = parseArgs(argv);
  if (parsedArgs.error) {
    io.stderr.write(`${parsedArgs.error}\n`);
    return EXIT_USAGE_ERROR;
  }

  const { command, subcommand, flags, positional } = parsedArgs;

  if (shouldLaunchInteractiveMode(parsedArgs, io)) {
    return startHeartSession({
      io,
      flags,
      runCommand: (nextArgv, nextIo) => runCli(nextArgv, nextIo),
    });
  }

  if (flags.help && command !== "help") {
    io.stdout.write(`${resolveHelpText(command, subcommand)}\n`);
    return 0;
  }

  switch (command) {
    case "init":
      return handleInit(flags, io);
    case "doctor":
      return handleDoctor(flags, io);
    case "scan":
      return handleScan(flags, io);
    case "overview":
      return handleOverview(flags, io);
    case "find":
      return handleFind(subcommand, flags, positional, io);
    case "deps":
      return handleDeps(flags, positional, io);
    case "impact":
      return handleImpact(flags, positional, io);
    case "policy":
      return handlePolicy(subcommand, flags, io);
    case "diagram":
      return handleDiagram(subcommand, flags, positional, io);
    case "packs":
      return handlePacks(subcommand, flags, positional, io);
    case "generate":
      return handleGenerate(flags, positional, io);
    case "pack":
      return handlePack(flags, positional, io);
    case "benchmark":
      return handleBenchmark(subcommand, flags, positional, io);
    case "ide":
      return handleIde(subcommand, flags, positional, io);
    case "models":
      return handleModels(subcommand, flags, positional, io);
    case "agent":
      return handleAgent(subcommand, flags, positional, io);
    case "docs":
      return handleDocs(subcommand, flags, positional, io);
    case "connect":
      return handleConnect(subcommand, flags, io);
    case "login":
      return handleLogin(flags, positional, io);
    case "logout":
      return handleLogout(flags, io);
    case "auth":
      return handleAuth(subcommand, flags, positional, io);
    case "sync":
      return handleSync(subcommand, flags, positional, io);
    case "service":
      return handleService(subcommand, flags, io);
    case "mcp":
      return handleMcp(subcommand, flags, io);
    case "chat":
      return handleChat(flags, positional, io);
    case "help":
    case undefined:
      writeOutput(helpText(), flags.json, io);
      return 0;
    default:
      io.stderr.write(`Unknown command: ${command}\n`);
      io.stderr.write(helpText());
      return 1;
  }
}

export function shouldLaunchInteractiveMode(parsedArgs, io = defaultIo()) {
  const { command, flags } = parsedArgs;
  const wantsChat = command === "chat";
  const emptyCommand = command === undefined;

  if (!wantsChat && !emptyCommand) {
    return false;
  }

  if (flags.help || flags.json) {
    return false;
  }

  return detectInteractiveTerminal(io, io.env ?? process.env);
}

async function handleChat(flags, positional, io) {
  const prompt = String(flags.prompt ?? positional.join(" ")).trim();
  if (!prompt && !detectInteractiveTerminal(io, io.env ?? process.env)) {
    io.stderr.write("heart chat needs an interactive terminal or a prompt argument for non-interactive usage.\n");
    return EXIT_USAGE_ERROR;
  }

  if (!prompt) {
    return startHeartSession({
      io,
      flags,
      runCommand: (nextArgv, nextIo) => runCli(nextArgv, nextIo),
    });
  }

  return runOneShotChat({ prompt, flags, io });
}

async function handleIde(subcommand, flags, positional, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const action = subcommand ?? "";

  if (flags.help) {
    io.stdout.write(`${ideHelpText()}\n`);
    return 0;
  }

  if (!action) {
    return startIdeWorkbench({
      io,
      repoRoot,
      flags,
      runCommand: (nextArgv, nextIo = io) => runCli(nextArgv, nextIo),
      loadState: async (root) => runWorkspaceDoctor(root).catch((error) => ({
        status: "warning",
        error: error instanceof Error ? error.message : String(error),
      })),
    });
  }

  if (action === "status") {
    const terminal = {
      is_tty: Boolean(io.stdin?.isTTY && io.stdout?.isTTY),
      columns: Number(io.stdout?.columns ?? 100),
    };
    const doctor = await runWorkspaceDoctor(repoRoot).catch((error) => ({
      status: "warning",
      error: error instanceof Error ? error.message : String(error),
    }));
    const modelConfig = await loadCliModelConfig({
      credentialPath: flags.credentialPath,
      env: io.env ?? process.env,
    }).catch(() => null);
    const selected = modelConfig ? resolveCliSelectedModel({ config: modelConfig }) : {};
    const session = await buildWorkbenchSession({
      repoRoot,
      terminal,
      doctor,
      model: {
        provider_id: selected.provider_id ?? "",
        model_id: selected.model_id ?? "",
        selected_model_label: selected.provider_id ? `${selected.provider_id}/${selected.model_id}` : "provider-default",
      },
    });
    writeOutput(flags.json ? session : renderWorkbenchLayout(session, { columns: terminal.columns }), flags.json, io);
    return 0;
  }

  if (action === "files") {
    const query = positional.join(" ");
    const files = await searchFiles({ repoRoot, query });
    writeOutput(flags.json ? { schema_version: 1, query, files } : formatIdeList("Files", files), flags.json, io);
    return 0;
  }

  if (action === "open") {
    const filePath = positional.join(" ").trim();
    if (!filePath) {
      io.stderr.write("Usage: heart ide open [--json] [--root PATH] <file>\n");
      return EXIT_USAGE_ERROR;
    }
    const buffer = await openFile({ repoRoot, filePath });
    if (flags.editor) {
      const result = await openExternalEditor({ repoRoot, filePath, editorCommand: flags.editor });
      writeOutput(result, flags.json, io);
      return result.status === "failed" ? 1 : 0;
    }
    const preview = {
      ...buffer,
      content: buffer.content.split(/\r?\n/).slice(0, 120).join("\n"),
    };
    writeOutput(flags.json ? preview : `File: ${preview.path}\n${preview.content}`, flags.json, io);
    return 0;
  }

  if (action === "keymap") {
    const keymap = await loadKeymap({ repoRoot, profile: flags.profile, configPath: flags.keymap });
    writeOutput(flags.json ? keymap : formatKeymap(keymap), flags.json, io);
    return keymap.conflicts?.length ? 1 : 0;
  }

  if (action === "palette") {
    const query = positional.join(" ");
    const commands = openCommandPalette({ query });
    writeOutput(flags.json ? { schema_version: 1, query, commands } : formatPalette(commands), flags.json, io);
    return 0;
  }

  if (action === "tasks") {
    const tasks = await discoverPackageScripts({ repoRoot });
    writeOutput(flags.json ? tasks : formatTasks(tasks.scripts), flags.json, io);
    return 0;
  }

  if (action === "run") {
    const target = positional[0] ?? "";
    if (!target) {
      io.stderr.write("Usage: heart ide run <test|lint|typecheck|script> [--json] [--root PATH] [--confirm]\n");
      return EXIT_USAGE_ERROR;
    }
    let result;
    if (target === "test" || target === "tests") {
      result = await runTests({ repoRoot, confirmed: Boolean(flags.confirm), env: io.env ?? process.env });
    } else if (target === "lint") {
      result = await runLint({ repoRoot, confirmed: Boolean(flags.confirm), env: io.env ?? process.env });
    } else if (target === "typecheck" || target === "type-check") {
      result = await runTypecheck({ repoRoot, confirmed: Boolean(flags.confirm), env: io.env ?? process.env });
    } else {
      const tasks = await discoverPackageScripts({ repoRoot });
      const task = tasks.scripts.find((entry) => entry.script_name === target);
      if (!task) {
        writeOutput({ schema_version: 1, status: "not_found", available_scripts: tasks.scripts.map((entry) => entry.script_name) }, flags.json, io);
        return EXIT_NOT_FOUND;
      }
      result = await runProjectTask({ repoRoot, task, confirmed: Boolean(flags.confirm), env: io.env ?? process.env });
    }
    writeOutput(flags.json ? result : formatToolRun(result), flags.json, io);
    if (result.status === "not_found") {
      return EXIT_NOT_FOUND;
    }
    return result.status === "completed" || result.status === "needs_confirmation" ? 0 : 1;
  }

  if (action === "diagnostics") {
    const source = flags.source ?? "task";
    const diagnosticsInputPath = positional[0];
    let output = "";
    if (diagnosticsInputPath) {
      const absolutePath = path.resolve(io.cwd, diagnosticsInputPath);
      const relativeToRepo = path.relative(repoRoot, absolutePath);
      if (relativeToRepo.startsWith("..") || path.isAbsolute(relativeToRepo)) {
        io.stderr.write("Diagnostics input must be inside the repo root.\n");
        return EXIT_USAGE_ERROR;
      }
      output = await fs.readFile(absolutePath, "utf8");
    } else {
      output = await readStdinFully(io);
    }
    const parsed = flags.format === "lsp"
      ? parseLspDiagnosticsPayload({ repoRoot, source: "lsp", input: output })
      : { ...parseDiagnosticsFromOutput({ source, output }), format: "text" };
    writeOutput(flags.json ? parsed : formatDiagnosticsPanel(parsed), flags.json, io);
    return 0;
  }

  if (action === "diagnostics-nav") {
    const source = flags.source ?? "task";
    const diagnosticsInputPath = positional[0];
    let output = "";
    if (diagnosticsInputPath) {
      const absolutePath = path.resolve(io.cwd, diagnosticsInputPath);
      const relativeToRepo = path.relative(repoRoot, absolutePath);
      if (relativeToRepo.startsWith("..") || path.isAbsolute(relativeToRepo)) {
        io.stderr.write("Diagnostics input must be inside the repo root.\n");
        return EXIT_USAGE_ERROR;
      }
      output = await fs.readFile(absolutePath, "utf8");
    } else {
      output = await readStdinFully(io);
    }
    const parsed = flags.format === "lsp"
      ? parseLspDiagnosticsPayload({ repoRoot, source: "lsp", input: output })
      : { ...parseDiagnosticsFromOutput({ source, output }), format: "text" };
    const navigation = buildDiagnosticsNavigation({ diagnostics: parsed.diagnostics ?? [] });
    const payload = {
      ...navigation,
      source: parsed.source ?? source,
      format: parsed.format ?? "text",
      diagnostics: parsed.diagnostics ?? [],
    };
    writeOutput(flags.json ? payload : formatDiagnosticsNavigation(payload), flags.json, io);
    return 0;
  }

  if (action === "git") {
    const status = await getGitStatus({ repoRoot });
    const commit = generateCommitSummary({ status });
    const pr = generatePrSummary({ status });
    const payload = { schema_version: 1, status, commit_summary: commit, pr_summary: pr };
    writeOutput(flags.json ? payload : formatGitWorkflow(payload), flags.json, io);
    return 0;
  }

  if (action === "diff") {
    const diff = await getGitDiff({ repoRoot, staged: Boolean(flags.staged) });
    writeOutput(flags.json ? diff : formatIdeDiff(diff), flags.json, io);
    return 0;
  }

  if (action === "review") {
    const review = await getGitReview({ repoRoot });
    writeOutput(flags.json ? review : formatGitReview(review), flags.json, io);
    return 0;
  }

  if (action === "stage-picker") {
    const payload = flags.interactive
      ? await promptGitStagePicker({ repoRoot, flags, io })
      : flags.select
        ? await selectGitStagePickerChoices({ repoRoot, selection: flags.select, confirmed: Boolean(flags.confirm) })
        : await buildGitStagePicker({ repoRoot });
    writeOutput(flags.json ? payload : formatStagePickerPayload(payload), flags.json, io);
    return 0;
  }

  if (action === "stage" || action === "unstage") {
    const files = positional;
    const result = action === "stage"
      ? await stageSelectedFiles({ repoRoot, files, confirmed: Boolean(flags.confirm) })
      : await unstageSelectedFiles({ repoRoot, files, confirmed: Boolean(flags.confirm) });
    writeOutput(flags.json ? result : formatGitStageResult(result), flags.json, io);
    return ["staged", "unstaged", "needs_confirmation"].includes(result.status) ? 0 : 1;
  }

  if (action === "lsp-probe") {
    const result = await probeLspServer({
      repoRoot,
      server: flags.server ?? positional[0] ?? "typescript",
      timeoutMs: flags.timeoutMs ?? 2000,
      env: io.env ?? process.env,
    });
    writeOutput(flags.json ? result : formatLspProbe(result), flags.json, io);
    return ["ready", "timeout", "denied"].includes(result.status) ? 0 : 1;
  }

  if (action === "lsp-diagnostics") {
    const filePath = positional[0];
    if (!filePath) {
      io.stderr.write("Usage: heart ide lsp-diagnostics [--json] [--root PATH] [--server PRESET] [--timeout-ms N] <file>\n");
      return EXIT_USAGE_ERROR;
    }
    const result = await collectLspDiagnosticsStream({
      repoRoot,
      server: flags.server ?? "typescript",
      filePath,
      timeoutMs: flags.timeoutMs ?? 3000,
      diagnosticTimeoutMs: flags.diagnosticTimeoutMs ?? 1500,
      env: io.env ?? process.env,
    });
    writeOutput(flags.json ? result : formatLspDiagnosticsStream(result), flags.json, io);
    return ["completed", "timeout", "denied"].includes(result.status) ? 0 : 1;
  }

  if (action === "context") {
    return handlePack(flags, positional, io);
  }

  if (action === "graph") {
    return handleOverview(flags, io);
  }

  if (action === "docs") {
    if (positional.length > 0) {
      return handleDocs("search", flags, positional, io);
    }
    const workspaceState = await buildWorkspaceState(repoRoot);
    const documents = workspaceState.documentIndex?.documents ?? [];
    const totals = workspaceState.documentIndex?.totals ?? {};
    const payload = {
      schema_version: 1,
      repo_root: repoRoot,
      document_count: totals.document_count ?? documents.length,
      category_counts: totals.category_counts ?? {},
      sensitivity_counts: totals.sensitivity_counts ?? {},
      documents: documents.slice(0, 12).map((document) => ({
        path: document.path,
        title: document.title,
        category: document.category,
        sensitivity: document.sensitivity?.level ?? "internal",
      })),
    };
    writeOutput(flags.json ? payload : formatDocsPanel(payload), flags.json, io);
    return 0;
  }

  if (action === "policy") {
    return handlePolicy("check", flags, io);
  }

  if (action === "domain") {
    const domainAction = positional[0] ?? "list";
    if (["list", "show", "layers", "build", "validate", "conflicts", "sync", "open", "artifacts"].includes(domainAction)) {
      return handlePacks(domainAction, flags, positional.slice(1), io);
    }
    return handlePacks("show", flags, positional, io);
  }

  if (action === "generate") {
    return handleGenerate(flags, positional, io);
  }

  if (action === "memory") {
    const memoryViews = new Set(["summary", "graph", "docs", "policy", "domain", "attachments"]);
    const requestedView = memoryViews.has(positional[0]) ? positional[0] : "summary";
    const query = requestedView === "summary" ? positional.join(" ").trim() : positional.slice(1).join(" ").trim();
    const payload = await buildIdeMemoryPanel({ repoRoot, query, view: requestedView, select: flags.select });
    writeOutput(flags.json ? payload : formatMemoryPanel(payload), flags.json, io);
    return 0;
  }

  if (action === "patch-preview") {
    const proposal = await readPatchProposal(positional[0], io);
    const preview = await previewPatch({ repoRoot, proposal });
    writeOutput(flags.json ? preview : formatPatchPreview(preview), flags.json, io);
    return preview.status === "conflict" ? 1 : 0;
  }

  if (action === "patch-apply") {
    const proposal = await readPatchProposal(positional[0], io);
    const preview = await previewPatch({ repoRoot, proposal });
    const result = await applyPatchWithConfirmation({ repoRoot, preview, confirmed: Boolean(flags.confirm) });
    writeOutput(flags.json ? result : formatPatchApply(result), flags.json, io);
    return result.status === "applied" || result.status === "needs_confirmation" ? 0 : 1;
  }

  if (action === "patch-rollback") {
    const rollbackId = positional[0];
    if (!rollbackId) {
      io.stderr.write("Usage: heart ide patch-rollback [--json] [--root PATH] <rollback-id>\n");
      return EXIT_USAGE_ERROR;
    }
    const result = await rollbackAiPatch({ repoRoot, rollbackId });
    writeOutput(flags.json ? result : formatPatchApply(result), flags.json, io);
    return result.status === "rolled_back" ? 0 : 1;
  }

  io.stderr.write(`Unknown ide subcommand: ${action}\n`);
  io.stderr.write(ideHelpText());
  return 1;
}

async function runOneShotChat({ prompt, flags, io }) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const modelConfig = await loadCliModelConfig({
    credentialPath: flags.credentialPath,
    env: io.env ?? process.env,
  });
  const selected = resolveChatModelSelection({ flags, modelConfig });
  const provider = getProviderDefinition(selected.provider_id);
  const modelId = selected.model_id || provider.fallback_models?.[0]?.model_id || "";
  const localCredential = getCliProviderCredential(modelConfig, provider.provider_id);
  const credential = resolveProviderCredential({
    providerId: provider.provider_id,
    credential: localCredential,
    env: io.env ?? process.env,
  });

  if (!credential.api_key) {
    io.stderr.write(
      `No API key for ${provider.label}. Run heart models add-key --provider ${provider.provider_id} --api-key-stdin or set ${provider.env_keys[0]}.\n`,
    );
    return EXIT_USAGE_ERROR;
  }

  const contextAttachments = await buildCliContextAttachments({ repoRoot, flags });

  if (flags.json) {
    const result = await sendChatMessage({
      message: prompt,
      providerId: provider.provider_id,
      modelId,
      credential,
      contextAttachments,
      env: io.env ?? process.env,
      fetchImpl: flags.fetchImpl,
      maxOutputTokens: flags.tokenBudget ? Math.min(flags.tokenBudget, 8192) : 2000,
    });
    writeOutput(
      {
        schema_version: 1,
        provider_id: provider.provider_id,
        model_id: modelId,
        context_attachments: contextAttachments,
        assistant_message: result.assistant_message,
        usage: result.response.usage,
        cost: result.response.cost,
      },
      true,
      io,
    );
    return 0;
  }

  io.stdout.write(`BeHeart AI ${provider.label}/${modelId}\n`);
  if (contextAttachments.length > 0) {
    io.stdout.write(`Context: ${contextAttachments.map((attachment) => attachment.label).join(", ")}\n\n`);
  }

  let exitCode = 0;
  for await (const event of streamModelResponse({
    providerId: provider.provider_id,
    modelId,
    credential,
    env: io.env ?? process.env,
    messages: [{ role: "user", content: prompt }],
    system: buildCliSystemPrompt(contextAttachments),
    maxOutputTokens: flags.tokenBudget ? Math.min(flags.tokenBudget, 8192) : 2000,
  })) {
    if (event.event === "assistant_delta") {
      io.stdout.write(event.delta);
    }
    if (event.event === "usage" && event.usage?.total_tokens) {
      io.stdout.write(`\n\nUsage: ${event.usage.total_tokens} tokens`);
      if (event.cost?.estimated_total !== null) {
        io.stdout.write(`; estimated cost ${event.cost.currency} ${event.cost.estimated_total.toFixed(6)}`);
      }
      io.stdout.write("\n");
    }
    if (event.event === "run_failed") {
      io.stderr.write(`${event.error.message}\n`);
      exitCode = 1;
    }
  }
  if (exitCode === 0) {
    io.stdout.write("\n");
  }
  return exitCode;
}

function resolveChatModelSelection({ flags, modelConfig }) {
  const modelSpec = flags.model && flags.model.includes("/")
    ? flags.model
    : flags.provider && flags.model
      ? `${flags.provider}/${flags.model}`
      : "";
  const selected = resolveCliSelectedModel({
    config: modelConfig,
    providerId: flags.provider,
    modelId: flags.model && !flags.model.includes("/") ? flags.model : undefined,
    modelSpec,
  });
  const providerId = selected.provider_id || "openai";
  const provider = getProviderDefinition(providerId);
  return {
    provider_id: provider.provider_id,
    model_id: selected.model_id || provider.fallback_models?.[0]?.model_id || "",
  };
}

async function buildCliContextAttachments({ repoRoot, flags } = {}) {
  const attachments = [];
  const wantsRepo = !flags.context || String(flags.context).toLowerCase() === "repo";
  if (wantsRepo) {
    try {
      const doctor = await runWorkspaceDoctor(repoRoot);
      attachments.push(buildContextAttachment("repo", {
        label: path.basename(repoRoot),
        summary: [
          `memory=${doctor.status}`,
          `docs=${doctor.parser?.document_count ?? 0}`,
          `mcp_tools=${doctor.mcp?.effective_enabled_tools?.length ?? 0}`,
          `warnings=${doctor.warnings?.length ?? 0}`,
        ].join("; "),
        sourceRef: repoRoot,
        data: {
          status: doctor.status,
          cache: doctor.cache,
          parser: doctor.parser,
          warnings: doctor.warnings,
        },
      }));
    } catch (error) {
      attachments.push(buildContextAttachment("repo", {
        label: path.basename(repoRoot),
        summary: `Repo memory status unavailable: ${error.message}`,
        sourceRef: repoRoot,
      }));
    }
  }

  if (flags.context === "graph" || flags.context === "repo") {
    try {
      const workspace = await buildWorkspaceState(repoRoot);
      attachments.push(attachRepoGraph({
        repo: workspace.repoName ?? path.basename(repoRoot),
        node_count: workspace.graph?.nodes?.length ?? workspace.nodes?.length ?? 0,
        edge_count: workspace.graph?.edges?.length ?? workspace.edges?.length ?? 0,
        summary: workspace.overview?.summary ?? "Local repo graph memory attached.",
      }));
      const documents = workspace.documentIndex?.documents ?? workspace.documents ?? [];
      if (documents.length > 0) {
        attachments.push(attachDocs(documents));
      }
    } catch {
      // Doctor-level repo status is enough for a degraded one-shot chat.
    }
  }

  if (flags.pack) {
    const packId = String(flags.pack).trim();
    try {
      const pack = await getDomainPack(packId, { repoRoot });
      attachments.push(attachDomainPack(pack));
    } catch (error) {
      attachments.push(buildContextAttachment("domain_pack", {
        label: packId,
        summary: `Domain pack could not be loaded: ${error.message}`,
        sourceRef: packId,
      }));
    }
  }

  return attachments;
}

function buildCliSystemPrompt(contextAttachments) {
  const context = contextAttachments.length > 0
    ? contextAttachments.map((attachment) => `- ${attachment.type}: ${attachment.label}. ${attachment.summary}`).join("\n")
    : "No BeHeart context attachments active.";
  return [
    "You are BeHeart AI Agent.",
    "Use durable repo memory, context packs, docs/specs, graph evidence, domain packs, benchmarks, and policy warnings.",
    "Mark source-backed facts separately from generated hypotheses.",
    "Never reveal secrets. Only suggest allowlisted BeHeart actions.",
    "",
    "Active context:",
    context,
  ].join("\n");
}

async function handleInit(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const configState = await loadHeartConfig(repoRoot);
  const environment = await detectProjectEnvironment(repoRoot, {
    ignore: configState.config.project.ignore,
  });
  const configPath = path.join(repoRoot, "heart.config.yaml");
  const policyPath = path.join(repoRoot, ".heart", "policies.yaml");
  const createdFiles = {
    config: false,
    policy: false,
  };

  if (flags.force || !configState.exists) {
    await fs.writeFile(
      configPath,
      createDefaultConfigYaml(path.basename(repoRoot), {
        languagePriority: environment.languages,
      }),
      "utf8",
    );
    createdFiles.config = true;
  }

  if (flags.force || !(await fileExists(policyPath))) {
    await fs.mkdir(path.join(repoRoot, ".heart"), { recursive: true });
    await fs.writeFile(policyPath, createDefaultPoliciesYaml(), "utf8");
    createdFiles.policy = true;
  }

  const created = createdFiles.config || createdFiles.policy;
  const status = created
    ? createdFiles.config && createdFiles.policy && !configState.exists
      ? "created"
      : "updated"
    : "unchanged";

  const payload = {
    status,
    created,
    created_files: createdFiles,
    repo_root: repoRoot,
    config_path: configPath,
    policy_path: policyPath,
    detected: environment,
    next_commands: [
      `heart doctor --root ${repoRoot}`,
      `heart scan --root ${repoRoot}`,
      `heart pack --root ${repoRoot} "your task"`,
      "heart models providers",
      "heart login",
      `heart sync setup --root ${repoRoot}`,
      `heart connect doctor --root ${repoRoot}`,
    ],
  };

  if (!created) {
    payload.message = `Scaffold already present. Use --force to rewrite ${configPath} and ${policyPath}.`;
  }

  writeOutput(flags.json ? payload : formatInitOutput(payload), flags.json, io);
  return 0;
}

async function handleDoctor(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const result = await runWorkspaceDoctor(repoRoot);
  writeOutput(flags.json ? result : formatDoctorOutput(result), flags.json, io);
  return 0;
}

async function handleOverview(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);
  const overview = createProjectOverview(
    workspaceState.graph,
    workspaceState.policyReport,
    workspaceState.documentIndex,
    workspaceState.heartModel,
  );
  const payload = {
    ...overview,
    readiness: workspaceState.readiness,
  };

  writeOutput(
    flags.json ? payload : formatOverviewOutput(payload, repoRoot),
    flags.json,
    io,
  );
  return 0;
}

async function handleScan(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot, {
    forceRescan: flags.rebuild === true,
  });

  writeOutput(
    {
      repo_root: repoRoot,
      cache: workspaceState.cache,
      heart: workspaceState.heartModel.summary,
      parser_engine: workspaceState.scanResult.parser_engine,
      file_count: workspaceState.scanResult.totals.file_count,
      symbol_count: workspaceState.scanResult.totals.symbol_count,
      document_count: workspaceState.documentIndex.totals.document_count,
      policy_warnings: workspaceState.policyReport.violations.length,
    },
    flags.json,
    io,
  );
  return 0;
}

async function handlePack(flags, positional, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const task = positional.join(" ").trim();

  if (!task) {
    io.stderr.write("Usage: heart pack [--json] [--token-budget N] [--root PATH] <task description>\n");
    return EXIT_USAGE_ERROR;
  }

  const workspaceState = await buildWorkspaceState(repoRoot);
  const contextPack = compileContextPack({
    task,
    graph: workspaceState.graph,
    documentIndex: workspaceState.documentIndex,
    heartModel: workspaceState.heartModel,
    policyReport: workspaceState.policyReport,
    tokenBudget: flags.tokenBudget,
  });

  writeOutput(flags.json ? contextPack : formatPackOutput(contextPack, repoRoot), flags.json, io);
  return 0;
}

async function handleFind(subcommand, flags, positional, io) {
  if (subcommand !== "symbol") {
    io.stderr.write("Usage: heart find symbol [--json] [--root PATH] <query>\n");
    return EXIT_USAGE_ERROR;
  }

  const query = positional.join(" ").trim();
  if (!query) {
    io.stderr.write("Usage: heart find symbol [--json] [--root PATH] <query>\n");
    return EXIT_USAGE_ERROR;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);

  writeOutput(
    {
      query,
      matches: searchSymbols(workspaceState.graph, query),
    },
    flags.json,
    io,
  );
  return 0;
}

async function handleDeps(flags, positional, io) {
  const target = positional.join(" ").trim();
  if (!target) {
    io.stderr.write("Usage: heart deps [--json] [--root PATH] <file-or-symbol>\n");
    return EXIT_USAGE_ERROR;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);
  const result = createDependencyExplanation(workspaceState.graph, target);
  writeOutput(flags.json ? result : formatNotFoundAwareOutput("deps", result, repoRoot), flags.json, io);
  return result.found === false ? EXIT_NOT_FOUND : 0;
}

async function handleImpact(flags, positional, io) {
  const target = positional.join(" ").trim();
  if (!target) {
    io.stderr.write("Usage: heart impact [--json] [--root PATH] <file-or-symbol>\n");
    return EXIT_USAGE_ERROR;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);
  const result = createImpactAnalysis(workspaceState.graph, target);
  writeOutput(flags.json ? result : formatNotFoundAwareOutput("impact", result, repoRoot), flags.json, io);
  return result.found === false ? EXIT_NOT_FOUND : 0;
}

async function handlePolicy(subcommand, flags, io) {
  if (subcommand !== "check") {
    io.stderr.write("Usage: heart policy check [--json] [--root PATH]\n");
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);
  writeOutput(workspaceState.policyReport, flags.json, io);
  return 0;
}

async function handleDiagram(subcommand, flags, positional, io) {
  if (subcommand === "generate" || !subcommand) {
    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const requestedType = positional[0] ?? "all";
    const workspaceState = await buildWorkspaceState(repoRoot);
    const bundle = generateDiagramBundle({
      workspaceState,
      types: resolveDiagramTypes(requestedType),
      task: flags.task,
      target: flags.target,
    });
    const artifacts = await writeDiagramBundle(repoRoot, bundle);

    if (!flags.json && bundle.diagrams.length === 1) {
      io.stdout.write(`${bundle.diagrams[0].content}\n`);
      return 0;
    }

    writeOutput(
      {
        repo_root: repoRoot,
        generated_at: bundle.generated_at,
        manifest_path: artifacts.manifest_path,
        diagrams: artifacts.diagrams.map((diagram) => ({
          type: diagram.type,
          title: diagram.title,
          format: diagram.format,
          inference_mode: diagram.inference_mode,
          artifact_path: diagram.artifact_path,
        })),
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (subcommand === "sync") {
    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const workspaceState = await buildWorkspaceState(repoRoot);
    const bundle = generateDiagramBundle({
      workspaceState,
      task: flags.task,
      target: flags.target,
    });
    const artifacts = await writeDiagramBundle(repoRoot, bundle);
    const syncResult = await syncRepositoryProfile({
      repoRoot,
      workspaceState,
      bundle,
      artifacts,
      slug: flags.slug,
      portalRoot: flags.portalRoot,
      adminRoot: flags.adminRoot,
    });

    writeOutput(
      {
        repo_root: repoRoot,
        profile_slug: syncResult.profile_slug,
        published_root: syncResult.published_root,
        profile_path: syncResult.profile_path,
        synced_destinations: syncResult.synced_destinations,
      },
      flags.json,
      io,
    );
    return 0;
  }

  io.stderr.write(
    "Usage: heart diagram generate [all|symbol-graph|high-level|component|class|sequence|mindmap] [--json] [--task TEXT] [--target NAME] [--root PATH]\n",
  );
  io.stderr.write(
    "       heart diagram sync [--json] [--slug NAME] [--portal-root PATH] [--admin-root PATH] [--task TEXT] [--target NAME] [--root PATH]\n",
  );
  return 1;
}

async function handlePacks(subcommand, flags, positional, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const action = subcommand ?? "list";
  const packId = positional[0] ?? "tolling-management";

  if (action === "list") {
    const packs = await listDomainPacks({ repoRoot });
    const payload = {
      schema_version: 1,
      repo_root: repoRoot,
      packs,
      next_actions: [
        "heart packs show tolling-management",
        "heart packs build tolling-management --output sales-demo-kit",
      ],
    };
    writeOutput(flags.json ? payload : formatPacksListOutput(payload), flags.json, io);
    return 0;
  }

  if (action === "show") {
    const pack = await getDomainPack(packId, { repoRoot });
    writeOutput(flags.json ? pack : formatPackDetailOutput(pack), flags.json, io);
    return 0;
  }

  if (action === "layers") {
    const layers = await listPackLayers(packId, { repoRoot });
    const payload = {
      schema_version: 1,
      pack_id: packId,
      layers,
      next_action: `heart packs build ${packId} --regional texas --agency hctra-example`,
    };
    writeOutput(flags.json ? payload : formatPackLayersOutput(payload), flags.json, io);
    return 0;
  }

  if (action === "build") {
    const result = await writePackArtifact({
      repoRoot,
      sourceRepoRoot: io.cwd,
      packId,
      outputType: flags.output ?? "domain-pack",
      regionalLayer: flags.regional,
      agencyOverlay: flags.agency,
      customerRequirements: flags.customerRequirements ?? "",
      tokenBudget: flags.tokenBudget,
    });
    writeOutput(flags.json ? result : formatPackBuildOutput(result), flags.json, io);
    return 0;
  }

  if (action === "validate") {
    const validation = await validateDomainPack(packId, { repoRoot });
    writeOutput(flags.json ? validation : formatPackValidationOutput(validation), flags.json, io);
    return validation.status === "valid" ? 0 : 1;
  }

  if (action === "conflicts") {
    const conflicts = await detectPackLayerConflicts({
      pack_id: packId,
      regional_layer: flags.regional,
      agency_overlay: flags.agency,
      customer_requirements: flags.customerRequirements,
    }, { repoRoot });
    const payload = {
      schema_version: 1,
      pack_id: packId,
      conflicts,
      status: conflicts.length > 0 ? "conflicts_found" : "clear",
      next_action: conflicts.length > 0
        ? "Resolve conflicts in customer overlay or accepted docs before implementation."
        : `heart packs build ${packId} --output sales-demo-kit`,
    };
    writeOutput(flags.json ? payload : formatPackConflictsOutput(payload), flags.json, io);
    return 0;
  }

  if (action === "sync") {
    const result = await syncGeneratedPackArtifact({
      repoRoot,
      packId,
      artifactId: flags.artifact,
    });
    writeOutput(flags.json ? result : formatPackSyncOutput(result), flags.json, io);
    return result.status === "synced" ? 0 : EXIT_NOT_FOUND;
  }

  if (action === "open") {
    const artifact = await readGeneratedPackArtifact({
      repoRoot,
      packId,
      artifactId: flags.artifact,
    });
    if (!artifact) {
      io.stderr.write(`No generated artifact found for ${packId}. Next action: heart packs build ${packId} --output sales-demo-kit\n`);
      return EXIT_NOT_FOUND;
    }
    const payload = {
      schema_version: 1,
      pack_id: packId,
      artifact: artifact.manifest,
      files: artifact.files,
      next_action: "Open the listed file path or view it in the portal artifact viewer.",
    };
    writeOutput(flags.json ? payload : formatPackOpenOutput(payload), flags.json, io);
    return 0;
  }

  if (action === "artifacts") {
    const artifacts = await listGeneratedPackArtifacts({ repoRoot, packId });
    const payload = {
      schema_version: 1,
      pack_id: packId,
      artifacts,
      next_action: artifacts.length > 0
        ? `heart packs open ${packId} --artifact ${artifacts[0].artifact_id}`
        : `heart packs build ${packId} --output sales-demo-kit`,
    };
    writeOutput(flags.json ? payload : formatPackArtifactsOutput(payload), flags.json, io);
    return 0;
  }

  io.stderr.write("Usage: heart packs list|show|layers|build|validate|conflicts|sync|open|artifacts [pack-id] [--json] [--root PATH]\n");
  return EXIT_USAGE_ERROR;
}

async function handleGenerate(flags, positional, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const action = positional[0] ?? "";

  if (flags.help) {
    io.stdout.write(`${resolveHelpText("generate")}\n`);
    return 0;
  }

  if (action === "stacks" || flags.stacks) {
    const payload = {
      schema_version: 1,
      presets: listStackPresets(),
      next_action: "heart generate tolling-management --stack next-fullstack-postgres",
    };
    writeOutput(flags.json ? payload : formatStackPresetsOutput(payload), flags.json, io);
    return 0;
  }

  if (action === "modes") {
    const payload = {
      schema_version: 1,
      modes: listGenerationModes(),
      next_action: "heart generate tolling-management --mode product-starter --stack next-fullstack-postgres",
    };
    writeOutput(flags.json ? payload : formatGenerationModesOutput(payload), flags.json, io);
    return 0;
  }

  if (action === "stack") {
    const stackId = positional[1] ?? flags.stack;
    if (!stackId) {
      io.stderr.write("Usage: heart generate stack <stack-id> [--json]\n");
      return EXIT_USAGE_ERROR;
    }
    const payload = explainStackTradeoffs(stackId);
    writeOutput(flags.json ? payload : formatStackTradeoffsOutput(payload), flags.json, io);
    return 0;
  }

  const domainId = action || flags.domain || "tolling-management";
  const prompt = flags.prompt ?? positional.slice(action ? 1 : 0).join(" ");
  const plan = await createDefaultGenerationPlan({
    repoRoot,
    domainId,
    stackId: flags.stack,
    mode: flags.mode ?? flags.output,
    prompt,
    outputDir: flags.outputDir,
    regionalLayer: flags.regional,
    agencyOverlay: flags.agency,
    customerRequirements: flags.customerRequirements ?? "",
    tokenBudget: flags.tokenBudget,
  });

  if (!flags.confirm) {
    const preview = previewGenerationPlan(plan);
    writeOutput(flags.json ? { plan, preview } : formatGenerationPreviewOutput(preview), flags.json, io);
    return 0;
  }

  const result = await generateProjectFromDomainAndStack({
    repoRoot,
    plan,
    prompt,
    confirmed: true,
  });
  writeOutput(flags.json ? result : formatGenerationResultOutput(result), flags.json, io);
  return ["generated", "generated_with_warnings"].includes(result.status) ? 0 : 1;
}

async function handleMcp(subcommand, flags, io) {
  if (subcommand === "tools" || !subcommand) {
    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const configState = await loadHeartConfig(repoRoot);
    const effectiveEnabledTools = resolveEnabledMcpTools(configState.config.mcp?.enabled_tools);
    const tools = createToolRegistry({
      enabledTools: effectiveEnabledTools,
    });
    const payload = {
      repo_root: repoRoot,
      enabled_tools: effectiveEnabledTools,
      disabled_tools: KNOWN_MCP_TOOL_NAMES.filter((tool) => !effectiveEnabledTools.includes(tool)),
      tools,
    };

    writeOutput(flags.json ? payload : formatMcpToolsOutput(payload), flags.json, io);
    return 0;
  }

  if (subcommand === "serve") {
    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    await startStdioServer({
      repoRoot,
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
    });
    return 0;
  }

  io.stderr.write(`Unknown mcp subcommand: ${subcommand}\n`);
  return EXIT_USAGE_ERROR;
}

async function handleBenchmark(subcommand, flags, positional, io) {
  if (subcommand === "capture") {
    if (positional.length < 2 || !flags.upstreamBaseUrl || !Array.isArray(flags.command) || flags.command.length === 0) {
      io.stderr.write(
        "Usage: heart benchmark capture <baseline|assisted> <scenario-name-or-path> [--json] [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME] [--provider NAME] [--model NAME] [--agent-client NAME] [--input-cost-per-1m USD] [--cached-input-cost-per-1m USD] [--output-cost-per-1m USD] --upstream-base-url URL -- <command ...>\n",
      );
      return 1;
    }

    const mode = positional[0];
    if (!["baseline", "assisted"].includes(mode)) {
      io.stderr.write("Benchmark capture mode must be baseline or assisted.\n");
      return 1;
    }

    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const scenario = await loadBenchmarkScenario(positional[1], repoRoot);
    const result = await executeAgentRunCapture({
      repoRoot,
      slug: flags.slug,
      workspace: flags.workspace,
      customer: flags.customer,
      scenario: scenario.id,
      dataset: scenario.dataset?.id,
      mode,
      provider: flags.provider ?? scenario.provider,
      model: flags.model ?? scenario.model,
      agentClient: flags.agentClient,
      upstreamBaseUrl: flags.upstreamBaseUrl,
      command: flags.command,
      pricing: createPricingConfig(flags),
    });
    const artifact = await writeAgentRunCaptureArtifact(repoRoot, {
      scenario,
      mode,
      run: result.run,
      summary: result.summary,
      proxy: result.proxy,
      command: result.command,
    });

    writeOutput(
      {
        ...result,
        artifact,
        next_commands: {
          run_report:
            mode === "baseline"
              ? `heart benchmark run ${scenario.path ?? scenario.id} --baseline-run ${result.run.run_id} --assisted-run <assisted-run-id>`
              : `heart benchmark run ${scenario.path ?? scenario.id} --baseline-run <baseline-run-id> --assisted-run ${result.run.run_id}`,
        },
      },
      flags.json,
      io,
    );
    return result.command.exit_code === 0 ? 0 : result.command.exit_code || 1;
  }

  if (subcommand === "run") {
    if (!flags.all && positional.length < 1) {
      io.stderr.write(
        "Usage: heart benchmark run [--all] [--baseline-run RUN_ID] [--assisted-run RUN_ID] [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <scenario-name-or-path>\n",
      );
      return 1;
    }

    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    if ((flags.baselineRun || flags.assistedRun) && flags.all) {
      io.stderr.write("Observed run ids cannot be combined with --all.\n");
      return 1;
    }
    if ((flags.baselineRun && !flags.assistedRun) || (!flags.baselineRun && flags.assistedRun)) {
      io.stderr.write("Both --baseline-run and --assisted-run are required for observed benchmark reports.\n");
      return 1;
    }
    const benchmarkWorkspaceState = await buildWorkspaceState(repoRoot);
    const scanProvenance = benchmarkWorkspaceState.scanProvenance;
    const readiness = benchmarkWorkspaceState.readiness;
    if (flags.all) {
      const suiteResult = await runBenchmarkSuite({
        repoRoot,
        repo: path.basename(repoRoot),
        profile_slug: flags.slug ?? path.basename(repoRoot),
        provider: flags.provider,
        model: flags.model,
      });
      const persisted_reports = [];

      for (const scenarioRun of suiteResult.scenario_runs) {
        const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, scenarioRun.report, {
          baselineInput: scenarioRun.scenario.baseline,
          assistedInput: scenarioRun.scenario.assisted,
          evaluation: {
            scenario_path: scenarioRun.scenario.path,
          },
          scenario: scenarioRun.scenario,
          dataset: scenarioRun.dataset,
          scanProvenance,
          readiness,
        });
        const reportWithEvidence = {
          ...scenarioRun.report,
          evidence_bundle: evidenceBundle,
        };
        const persisted = await writeBenchmarkReport(repoRoot, reportWithEvidence);
        const syncedDestinations = await publishBenchmarkReport({
          report: reportWithEvidence,
          repoRoot,
          portalRoot: flags.portalRoot,
          adminRoot: flags.adminRoot,
        });
        persisted_reports.push({
          report: reportWithEvidence,
          persisted,
          synced_destinations: syncedDestinations,
        });
      }

      const suitePersisted = await writeBenchmarkSuiteReport(repoRoot, suiteResult.suite);
      writeOutput(
        {
          suite: suiteResult.suite,
          suite_persisted: suitePersisted,
          scenario_reports: persisted_reports,
        },
        flags.json,
        io,
      );
      return 0;
    }

    const scenarioRef = positional[0];
    const scenario = await loadBenchmarkScenario(scenarioRef, repoRoot);
    let observedBaseline = null;
    let observedAssisted = null;
    try {
      observedBaseline = flags.baselineRun
        ? await loadObservedRunSummary({
            serviceStorageRoot: resolveServiceStorageRoot({ repoRoot }),
            runId: flags.baselineRun,
          })
        : null;
      observedAssisted = flags.assistedRun
        ? await loadObservedRunSummary({
            serviceStorageRoot: resolveServiceStorageRoot({ repoRoot }),
            runId: flags.assistedRun,
          })
        : null;
    } catch (error) {
      io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      return 1;
    }
    const observedValidationError = validateObservedBenchmarkRunPair({
      scenario,
      baselineRun: observedBaseline,
      assistedRun: observedAssisted,
    });
    if (observedValidationError) {
      io.stderr.write(`${observedValidationError}\n`);
      return 1;
    }
    const baselineInput = mergeObservedRunIntoBenchmarkInput(scenario.baseline, observedBaseline);
    const assistedInput = mergeObservedRunIntoBenchmarkInput(scenario.assisted, observedAssisted);
    const report = await runBenchmarkScenario(scenarioRef, {
      repoRoot,
      repo: path.basename(repoRoot),
      profile_slug: flags.slug ?? path.basename(repoRoot),
      scenario: flags.scenario,
      provider: flags.provider,
      model: flags.model,
      scenarioManifest: scenario,
      baselineObservedRun: observedBaseline,
      assistedObservedRun: observedAssisted,
    });
    const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, report, {
      baselineInput,
      assistedInput,
      evaluation: {
        scenario_path: scenario.path,
        baseline_run_id: flags.baselineRun,
        assisted_run_id: flags.assistedRun,
      },
      scenario,
      dataset: scenario.dataset ?? null,
      scanProvenance,
      readiness,
    });
    const reportWithEvidence = {
      ...report,
      evidence_bundle: evidenceBundle,
    };
    const persisted = await writeBenchmarkReport(repoRoot, reportWithEvidence);
    const syncedDestinations = await publishBenchmarkReport({
      report: reportWithEvidence,
      repoRoot,
      portalRoot: flags.portalRoot,
      adminRoot: flags.adminRoot,
    });

    writeOutput(
      {
        report: reportWithEvidence,
        persisted,
        synced_destinations: syncedDestinations,
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (subcommand !== "compare") {
    io.stderr.write(
      "Usage: heart benchmark run [--all] [--baseline-run RUN_ID] [--assisted-run RUN_ID] [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <scenario-name-or-path>\n",
    );
    io.stderr.write(
      "       heart benchmark capture <baseline|assisted> <scenario-name-or-path> [--json] [--root PATH] [--slug NAME] [--provider NAME] [--model NAME] --upstream-base-url URL -- <command ...>\n",
    );
    io.stderr.write(
      "       heart benchmark compare [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <baseline.json> <assisted.json>\n",
    );
    return 1;
  }

  if (positional.length < 2) {
    io.stderr.write(
      "Usage: heart benchmark compare [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <baseline.json> <assisted.json>\n",
    );
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const benchmarkWorkspaceState = await buildWorkspaceState(repoRoot);
  const baselinePath = path.resolve(io.cwd, positional[0]);
  const assistedPath = path.resolve(io.cwd, positional[1]);
  const [baseline, assisted] = await Promise.all([
    loadBenchmarkReport(baselinePath),
    loadBenchmarkReport(assistedPath),
  ]);

  const report = compareBenchmarkRuns(baseline, assisted, {
    repo: path.basename(repoRoot),
    profile_slug: flags.slug ?? path.basename(repoRoot),
    scenario: flags.scenario ?? "comparison",
    provider: flags.provider,
    model: flags.model,
  });
  const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, report, {
    baselineInput: baseline,
    assistedInput: assisted,
    evaluation: {
      baseline_source: baselinePath,
      assisted_source: assistedPath,
    },
    scanProvenance: benchmarkWorkspaceState.scanProvenance,
    readiness: benchmarkWorkspaceState.readiness,
  });
  const reportWithEvidence = {
    ...report,
    evidence_bundle: evidenceBundle,
  };
  const persisted = await writeBenchmarkReport(repoRoot, reportWithEvidence);
  const syncedDestinations = await publishBenchmarkReport({
    report: reportWithEvidence,
    repoRoot,
    portalRoot: flags.portalRoot,
    adminRoot: flags.adminRoot,
  });

  writeOutput(
    {
      report: reportWithEvidence,
      persisted,
      synced_destinations: syncedDestinations,
    },
    flags.json,
    io,
  );
  return 0;
}

async function handleModels(subcommand, flags, positional, io) {
  const action = subcommand ?? "list";
  if (action === "providers") {
    const config = await loadCliModelConfig({
      credentialPath: flags.credentialPath,
      env: io.env ?? process.env,
    });
    const payload = {
      schema_version: 1,
      providers: listProviders({
        env: io.env ?? process.env,
        credentialState: config.credentials,
      }),
      selected: config.selected,
      security: config.security,
    };
    writeOutput(flags.json ? payload : formatModelProviders(payload), flags.json, io);
    return 0;
  }

  if (action === "list") {
    const config = await loadCliModelConfig({
      credentialPath: flags.credentialPath,
      env: io.env ?? process.env,
    });
    const providerIds = flags.provider
      ? [flags.provider]
      : config.selected?.provider_id
        ? [config.selected.provider_id]
        : listProviders({ env: io.env ?? process.env, credentialState: config.credentials }).map((provider) => provider.provider_id);
    const results = [];
    for (const providerId of providerIds) {
      const provider = getProviderDefinition(providerId);
      const credential = getCliProviderCredential(config, provider.provider_id);
      const resolvedCredential = resolveProviderCredential({
        providerId: provider.provider_id,
        credential,
        env: io.env ?? process.env,
      });
      results.push(await listProviderModels({
        providerId: provider.provider_id,
        credential: resolvedCredential,
        env: io.env ?? process.env,
        dynamic: Boolean(resolvedCredential.api_key || !provider.requires_api_key),
      }));
    }
    const payload = {
      schema_version: 1,
      selected: config.selected,
      providers: results,
    };
    writeOutput(flags.json ? payload : formatModelList(payload), flags.json, io);
    return 0;
  }

  if (action === "pricing") {
    const payload = getPricingCatalog({
      providerId: flags.provider ?? positional[0],
    });
    writeOutput(payload, flags.json, io);
    return 0;
  }

  if (action === "validate") {
    const config = await loadCliModelConfig({
      credentialPath: flags.credentialPath,
      env: io.env ?? process.env,
    });
    const plan = createProviderValidationPlan({
      env: io.env ?? process.env,
      credentialState: config.credentials,
    });
    if (!flags.live) {
      writeOutput(plan, flags.json, io);
      return 0;
    }
    const results = [];
    for (const entry of plan.providers) {
      if (!["ready_for_live_test", "needs_local_runtime"].includes(entry.status)) {
        results.push({
          ...entry,
          ok: false,
          skipped: true,
        });
        continue;
      }
      const credential = getCliProviderCredential(config, entry.provider_id);
      results.push({
        ...entry,
        ...(await validateProviderCredential({
          providerId: entry.provider_id,
          credential,
          env: io.env ?? process.env,
        })),
      });
    }
    const payload = {
      ...plan,
      live: true,
      providers: results,
    };
    writeOutput(payload, flags.json, io);
    return results.every((entry) => entry.ok || entry.skipped) ? 0 : 1;
  }

  if (action === "add-key") {
    const providerId = flags.provider ?? positional[0];
    if (!providerId) {
      io.stderr.write("Usage: heart models add-key --provider PROVIDER --api-key-stdin\n");
      return EXIT_USAGE_ERROR;
    }
    const apiKey = flags.apiKeyStdin ? await readStdinFully(io) : flags.apiKey;
    const saved = await addCliProviderKey({
      providerId,
      apiKey,
      credentialPath: flags.credentialPath,
      env: io.env ?? process.env,
    });
    const credential = saved.credentials[getProviderDefinition(providerId).provider_id];
    writeOutput(
      {
        schema_version: 1,
        provider_id: credential.provider_id,
        key_status: credential.enabled ? "configured" : "disabled",
        masked_key: credential.masked_key,
        credential_path: saved.credential_path,
        security: saved.security,
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (action === "remove-key") {
    const providerId = flags.provider ?? positional[0];
    if (!providerId) {
      io.stderr.write("Usage: heart models remove-key --provider PROVIDER\n");
      return EXIT_USAGE_ERROR;
    }
    const saved = await deleteCliProviderKey({
      providerId,
      credentialPath: flags.credentialPath,
      env: io.env ?? process.env,
    });
    writeOutput(
      {
        schema_version: 1,
        provider_id: getProviderDefinition(providerId).provider_id,
        key_status: "removed",
        credential_path: saved.credential_path,
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (action === "select") {
    const modelSpec = positional[0] && positional[0].includes("/") ? positional[0] : "";
    const saved = await selectCliModel({
      providerId: flags.provider ?? (modelSpec ? undefined : positional[0]),
      modelId: flags.model ?? (modelSpec ? undefined : positional[1]),
      modelSpec: flags.model?.includes("/") ? flags.model : modelSpec,
      credentialPath: flags.credentialPath,
      env: io.env ?? process.env,
    });
    writeOutput(
      {
        schema_version: 1,
        selected: saved.selected,
        credential_path: saved.credential_path,
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (action === "test") {
    const config = await loadCliModelConfig({
      credentialPath: flags.credentialPath,
      env: io.env ?? process.env,
    });
    const providerId = flags.provider ?? config.selected?.provider_id ?? positional[0];
    if (!providerId) {
      io.stderr.write("Usage: heart models test --provider PROVIDER\n");
      return EXIT_USAGE_ERROR;
    }
    const provider = getProviderDefinition(providerId);
    const credential = getCliProviderCredential(config, provider.provider_id);
    const result = await validateProviderCredential({
      providerId: provider.provider_id,
      credential,
      env: io.env ?? process.env,
    });
    writeOutput(result, flags.json, io);
    return result.ok ? 0 : 1;
  }

  io.stderr.write(resolveHelpText("models", action));
  return EXIT_USAGE_ERROR;
}

async function handleAgent(subcommand, flags, positional, io) {
  const action = subcommand ?? "settings";
  if (action === "settings") {
    const config = await loadCliModelConfig({
      credentialPath: flags.credentialPath,
      env: io.env ?? process.env,
    });
    const providers = listProviders({
      env: io.env ?? process.env,
      credentialState: config.credentials,
    });
    writeOutput(
      {
        schema_version: 1,
        selected: config.selected,
        providers,
        tools: listAllowedTools(),
        security: config.security,
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (action !== "run") {
    io.stderr.write(
      "Usage: heart agent settings [--json] | heart agent run [--json] [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME] [--scenario TEXT] [--dataset TEXT] [--mode baseline|assisted] [--provider NAME] [--model NAME] [--agent-client NAME] [--input-cost-per-1m USD] [--cached-input-cost-per-1m USD] [--output-cost-per-1m USD] --upstream-base-url URL -- <command ...>\n",
    );
    return 1;
  }

  if (!flags.upstreamBaseUrl || !Array.isArray(flags.command) || flags.command.length === 0) {
    io.stderr.write(
      "Usage: heart agent run [--json] [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME] [--scenario TEXT] [--dataset TEXT] [--mode baseline|assisted] [--provider NAME] [--model NAME] [--agent-client NAME] [--input-cost-per-1m USD] [--cached-input-cost-per-1m USD] [--output-cost-per-1m USD] --upstream-base-url URL -- <command ...>\n",
    );
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const payload = await executeAgentRunCapture({
    repoRoot,
    slug: flags.slug,
    workspace: flags.workspace,
    customer: flags.customer,
    scenario: flags.scenario,
    dataset: flags.dataset,
    mode: flags.mode,
    provider: flags.provider,
    model: flags.model,
    agentClient: flags.agentClient,
    upstreamBaseUrl: flags.upstreamBaseUrl,
    command: flags.command,
    pricing: createPricingConfig(flags),
  });

  writeOutput(payload, flags.json, io);
  return payload.command.exit_code === 0 ? 0 : payload.command.exit_code || 1;
}

async function handleDocs(subcommand, flags, positional, io) {
  if (subcommand === "search") {
    const query = positional.join(" ").trim();
    if (!query) {
      io.stderr.write("Usage: heart docs search [--json] [--root PATH] <query>\n");
      return 1;
    }

    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const workspaceState = await buildWorkspaceState(repoRoot);

    writeOutput(
      {
        query,
        matches: findRelevantDocuments(workspaceState.documentIndex, query, 8),
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (subcommand === "import") {
    if (positional.length < 1) {
      io.stderr.write(
        "Usage: heart docs import [--json] [--root PATH] [--slug NAME] [--category NAME] [--title TEXT] [--summary TEXT] [--portal-root PATH] [--admin-root PATH] <source-file>\n",
      );
      return 1;
    }

    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const result = await importLocalDocument({
      repoRoot,
      sourcePath: positional[0],
      title: flags.title,
      category: flags.category,
      summary: flags.summary,
      profileSlug: flags.slug,
    });
    const published = await syncRepositoryDocumentsToWeb({
      repoRoot,
      profileSlug: flags.slug ?? path.basename(repoRoot),
      portalRoot: flags.portalRoot,
      adminRoot: flags.adminRoot,
      cwd: io.cwd,
    });

    writeOutput(
      {
        ...result,
        ...published,
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (subcommand === "sync-web") {
    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const profileSlug = flags.slug ?? path.basename(repoRoot);
    const portalRoot = flags.portalRoot ? path.resolve(io.cwd, flags.portalRoot) : path.join(repoRoot, "apps", "portal");
    const result = await pullWebDocumentSubmissions({
      repoRoot,
      portalRoot,
      profileSlug,
    });
    const published = await syncRepositoryDocumentsToWeb({
      repoRoot,
      profileSlug,
      portalRoot: flags.portalRoot,
      adminRoot: flags.adminRoot,
      cwd: io.cwd,
    });

    writeOutput(
      {
        ...result,
        ...published,
      },
      flags.json,
      io,
    );
    return 0;
  }

  io.stderr.write("Usage: heart docs search [--json] [--root PATH] <query>\n");
  io.stderr.write(
    "       heart docs import [--json] [--root PATH] [--slug NAME] [--category NAME] [--title TEXT] [--summary TEXT] [--portal-root PATH] [--admin-root PATH] <source-file>\n",
  );
  io.stderr.write("       heart docs sync-web [--json] [--root PATH] [--slug NAME] [--portal-root PATH] [--admin-root PATH]\n");
  return 1;
}

async function handleConnect(subcommand, flags, io) {
  if (flags.help || subcommand === "help") {
    io.stdout.write(`${connectHelpText()}\n`);
    return 0;
  }

  if (subcommand === "detect") {
    return handleConnectDetect(flags, io);
  }

  if (subcommand === "install") {
    return handleConnectInstall(flags, io);
  }

  if (subcommand === "verify") {
    return handleConnectVerify(flags, io);
  }

  if (subcommand === "doctor") {
    return handleConnectDoctor(flags, io);
  }

  io.stderr.write(connectHelpText());
  return 1;
}

async function handleConnectDetect(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const result = await detectConnections({ repoRoot });
  const payload = normalizeConnectDetectionForCli(result, repoRoot);

  if (flags.agents && !flags.models) {
    payload.models = [];
  }

  if (flags.models && !flags.agents) {
    payload.agents = [];
  }

  writeOutput(flags.json ? payload : formatConnectDetectOutput(payload), flags.json, io);
  return 0;
}

async function handleConnectInstall(flags, io) {
  if (!flags.client) {
    io.stderr.write(
      "Usage: heart connect install --client CLIENT [--json] [--root PATH] [--scope user|repo] [--model RUNTIME] [--dry-run] [--backup]\n",
    );
    return EXIT_USAGE_ERROR;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const scope = flags.scope ?? "repo";
  const scopeError = validateConnectScope(scope);
  if (scopeError) {
    io.stderr.write(`${scopeError}\n`);
    return EXIT_USAGE_ERROR;
  }

  let plan;
  try {
    plan = await buildInstallPlan({
      client: flags.client,
      scope,
      repoRoot,
      modelRuntime: flags.model,
    });
  } catch (error) {
    io.stderr.write(`${formatConnectClientError(error, flags.client)}\n`);
    return EXIT_USAGE_ERROR;
  }

  if (flags.dryRun) {
    writeOutput(flags.json ? { plan } : formatConnectInstallPlanOutput(plan), flags.json, io);
    return 0;
  }

  try {
    const backups = flags.backup
      ? await createPlanBackups(plan.files_to_backup ?? [])
      : [];

    const result = await installConnection({
      client: flags.client,
      scope,
      repoRoot,
      model: flags.model,
      verifyImpl: async (installPlan) =>
        verifyConnection({
          client: flags.client,
          repoRoot,
          plan: normalizeVerificationPlan(installPlan),
        }),
    });
    const payload = normalizeConnectVerificationForCli(result);

    if (flags.backup) {
      payload.backups = backups;
    }

    writeOutput(flags.json ? payload : formatConnectInstallOutput(payload), flags.json, io);
    return connectVerificationExitCode(payload);
  } catch (error) {
    io.stderr.write(`Connect install failed: ${formatConnectInstallError(error)}\n`);
    return 1;
  }
}

async function handleConnectVerify(flags, io) {
  if (!flags.client) {
    io.stderr.write(
      "Usage: heart connect verify --client CLIENT [--json] [--root PATH]\n",
    );
    return EXIT_USAGE_ERROR;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const client = flags.client;
  const scope = flags.scope ?? "repo";
  const scopeError = validateConnectScope(scope);
  if (scopeError) {
    io.stderr.write(`${scopeError}\n`);
    return EXIT_USAGE_ERROR;
  }

  let plan;
  try {
    plan = await buildInstallPlan({
      client,
      scope,
      repoRoot,
      modelRuntime: flags.model,
    });
  } catch (error) {
    io.stderr.write(`${formatConnectClientError(error, client)}\n`);
    return EXIT_USAGE_ERROR;
  }

  const result = await verifyConnection({
    client,
    repoRoot,
    plan: normalizeVerificationPlan(plan),
  });

  const payload = normalizeConnectVerificationForCli(result);
  writeOutput(flags.json ? payload : formatConnectVerifyOutput(payload), flags.json, io);
  return connectVerificationExitCode(payload);
}

async function handleConnectDoctor(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const result = await runConnectDoctor({ repoRoot });
  writeOutput(flags.json ? result : formatConnectDoctorOutput(result), flags.json, io);
  return 0;
}

async function handleService(subcommand, flags, io) {
  if (subcommand !== "export" && subcommand !== undefined) {
    io.stderr.write("Usage: heart service export [--json] [--root PATH] [--out PATH]\n");
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const serviceStorageRoot = resolveServiceStorageRoot({ repoRoot });
  const result = await writeCanonicalSnapshot({
    serviceStorageRoot,
    outputPath: flags.out ? path.resolve(io.cwd, flags.out) : undefined,
  });

  writeOutput(
    {
      output_path: result.output_path,
      source: result.snapshot.source,
      table_counts: Object.fromEntries(
        Object.entries(result.snapshot.tables).map(([tableName, rows]) => [tableName, rows.length]),
      ),
      postgres_migration: result.snapshot.postgres_migration,
    },
    flags.json,
    io,
  );
  return 0;
}

async function handleLogin(flags, positional, io) {
  const env = io.env ?? process.env;
  let apiUrl = resolveLoginApiUrl(flags, env);
  let stdinApiKey = "";
  if (flags.apiKeyStdin) {
    try {
      stdinApiKey = await readApiKeyFromStdin(io.stdin);
    } catch (error) {
      io.stderr.write(`${error.message}\n`);
      return EXIT_USAGE_ERROR;
    }
  }
  let apiKey = String(flags.apiKey ?? stdinApiKey ?? positional[0] ?? "").trim();
  const canOpenBrowser =
    !flags.noOpen &&
    !flags.json &&
    detectInteractiveTerminal(io, env);

  if (!apiUrl) {
    io.stderr.write("Usage: heart login [--api-key KEY | --api-key-stdin] [--url BASE_URL]\n");
    return EXIT_USAGE_ERROR;
  }

  if (!apiKey) {
    if (canOpenBrowser) {
      let browserLogin;
      try {
        browserLogin = await startBrowserLogin({
          apiUrl,
          portalUrl: flags.portalUrl ?? env.BEHEART_PORTAL_URL ?? env.BE_AI_HEART_PORTAL_BASE_URL,
          timeoutMs: Number(env.BEHEART_LOGIN_TIMEOUT_MS ?? 120_000),
        });
      } catch (error) {
        io.stderr.write(`Login failed: ${error.message}\n`);
        return 1;
      }

      const opened = openExternalUrl(browserLogin.portal_url);
      io.stdout.write(formatLoginBrowserStartOutput({
        portal_url: browserLogin.portal_url,
        opened,
      }));
      try {
        const received = await browserLogin.waitForApiKey();
        apiKey = received.api_key;
        apiUrl = received.api_url || apiUrl;
      } catch (error) {
        io.stderr.write(`Login failed: ${error.message}\n`);
        return 1;
      } finally {
        await browserLogin.close();
      }
    } else {
      const portalUrl = buildPortalApiKeyUrl({
        apiUrl,
        portalUrl: flags.portalUrl ?? env.BEHEART_PORTAL_URL ?? env.BE_AI_HEART_PORTAL_BASE_URL,
      });
      const payload = {
        status: "needs_browser_login",
        api_url: apiUrl,
        portal_url: portalUrl,
        opened: false,
        next_command: "heart login --api-key=<api-key>",
      };

      writeOutput(flags.json ? payload : formatLoginNeedsKeyOutput(payload), flags.json, io);
      return 0;
    }
  }

  if (!apiKey) {
    const payload = {
      status: "needs_api_key",
      api_url: apiUrl,
      next_command: "heart login --api-key=<api-key>",
    };

    writeOutput(flags.json ? payload : formatLoginNeedsKeyOutput(payload), flags.json, io);
    return 0;
  }

  let sessionPayload;
  try {
    sessionPayload = await resolveSessionRemote({
      baseUrl: apiUrl,
      sessionToken: apiKey,
    });
  } catch (error) {
    io.stderr.write(`Login failed: ${error.message}\n`);
    return 1;
  }

  if (!sessionPayload?.session) {
    io.stderr.write("Login failed: API key was not accepted by the BeHeart API.\n");
    return 1;
  }

  const saved = await saveCliCredentials({
    apiUrl,
    apiKey,
    actor: sessionPayload.actor,
    workspace: sessionPayload.workspace,
    credentialPath: flags.credentialPath,
    env,
  });
  const payload = {
    status: "authenticated",
    api_url: saved.api_url,
    credential_path: saved.credential_path,
    actor_slug: saved.actor_slug,
    workspace_slug: saved.workspace_slug,
    saved_at: saved.saved_at,
    api_key: redactSecret(apiKey),
    next_commands: [
      "heart sync setup",
      "heart sync benchmark <scenario>",
    ],
  };

  writeOutput(flags.json ? payload : formatLoginOutput(payload), flags.json, io);
  return 0;
}

async function handleLogout(flags, io) {
  const result = await deleteCliCredentials({
    credentialPath: flags.credentialPath,
    env: io.env ?? process.env,
  });
  const payload = {
    status: "logged_out",
    credential_path: result.credential_path,
  };

  writeOutput(flags.json ? payload : formatLogoutOutput(payload), flags.json, io);
  return 0;
}

async function resolveSyncCredentials(flags, io) {
  if (flags.url && flags.session) {
    return {
      api_url: flags.url,
      session_token: flags.session,
      source: "flags",
    };
  }

  const saved = await loadCliCredentials({
    credentialPath: flags.credentialPath,
    env: io.env ?? process.env,
  });
  return {
    api_url: flags.url ?? saved?.api_url ?? "",
    session_token: flags.session ?? saved?.api_key ?? "",
    source: saved ? "credentials" : "none",
  };
}

function resolveLoginApiUrl(flags, env = process.env) {
  return String(
    flags.url ??
      env.BEHEART_API_URL ??
      env.BE_AI_HEART_API_BASE_URL ??
      DEFAULT_BEHEART_API_URL,
  ).trim();
}

function buildPortalApiKeyUrl({ apiUrl, portalUrl, callbackUrl, state } = {}) {
  const rawPortalUrl = String(portalUrl ?? "").trim();
  const resolvedPortalUrl = rawPortalUrl || inferPortalUrlFromApiUrl(apiUrl);
  const url = new URL("/settings", ensureTrailingSlash(resolvedPortalUrl));
  url.searchParams.set("open", "api-keys");
  if (callbackUrl) {
    url.searchParams.set("cli_callback", callbackUrl);
  }
  if (state) {
    url.searchParams.set("cli_state", state);
  }
  url.searchParams.set("cli_api_url", apiUrl);
  return url.toString();
}

function inferPortalUrlFromApiUrl(apiUrl) {
  const url = new URL(ensureTrailingSlash(apiUrl || DEFAULT_BEHEART_API_URL));
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    url.port = "3001";
  } else if (url.hostname === "api.beheart.dev") {
    return DEFAULT_BEHEART_PORTAL_URL;
  }
  return url.toString();
}

function ensureTrailingSlash(value) {
  const raw = String(value ?? "").trim();
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function openExternalUrl(url) {
  try {
    const platform = process.platform;
    const command =
      platform === "darwin"
        ? "open"
        : platform === "win32"
          ? "cmd"
          : "xdg-open";
    const args =
      platform === "win32"
        ? ["/c", "start", "", url]
        : [url];
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function readApiKeyFromStdin(stdin) {
  if (!stdin?.[Symbol.asyncIterator]) {
    throw new Error("--api-key-stdin requires stdin.");
  }

  let raw = "";
  for await (const chunk of stdin) {
    raw += chunk.toString();
  }
  return raw.trim();
}

async function startBrowserLogin({ apiUrl, portalUrl, timeoutMs = 120_000 } = {}) {
  const state = randomUUID();
  let resolved = false;
  let timeout = null;
  let resolveWait;
  let rejectWait;
  const waitForApiKey = new Promise((resolve, reject) => {
    resolveWait = resolve;
    rejectWait = reject;
  });

  const server = http.createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      response.end();
      return;
    }

    if (!request.url?.startsWith("/callback")) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found.");
      return;
    }

    if (request.method !== "GET" && request.method !== "POST") {
      response.writeHead(405, {
        "Allow": "GET, POST, OPTIONS",
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end("Method not allowed.");
      return;
    }

    const callbackUrl = new URL(request.url, "http://127.0.0.1");
    const body = request.method === "POST" ? await readRequestBody(request) : "";
    const params = new URLSearchParams(body || callbackUrl.searchParams.toString());
    const receivedState = String(params.get("state") ?? params.get("cli_state") ?? "").trim();
    const receivedApiKey = String(params.get("api_key") ?? params.get("key") ?? "").trim();
    const receivedApiUrl = String(params.get("api_url") ?? apiUrl ?? "").trim();

    if (receivedState !== state || !receivedApiKey) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("BeHeart CLI login failed. Return to the terminal and try again.");
      return;
    }

    resolved = true;
    clearTimeout(timeout);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>BeHeart CLI login</title><p>BeHeart CLI login complete. You can close this tab.</p>");
    resolveWait({
      api_key: receivedApiKey,
      api_url: receivedApiUrl,
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const callbackUrl = `http://127.0.0.1:${address.port}/callback`;
  timeout = setTimeout(() => {
    if (!resolved) {
      rejectWait(new Error("Timed out waiting for browser login."));
    }
  }, Math.max(1_000, Number(timeoutMs || 120_000)));

  return {
    portal_url: buildPortalApiKeyUrl({
      apiUrl,
      portalUrl,
      callbackUrl,
      state,
    }),
    callback_url: callbackUrl,
    state,
    waitForApiKey: () => waitForApiKey,
    close: () =>
      new Promise((resolve) => {
        clearTimeout(timeout);
        server.close(() => resolve());
      }),
  };
}

async function readRequestBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString();
    if (Buffer.byteLength(body, "utf8") > 16 * 1024) {
      break;
    }
  }
  return body;
}

async function handleAuth(subcommand, flags, positional, io) {
  if (subcommand !== "provider-session" && subcommand !== undefined) {
    io.stderr.write(
      "Usage: heart auth provider-session --url BASE_URL [--provider NAME] [--surface portal|admin] [--workspace NAME] [--customer NAME] [--id-token TOKEN] [--out PATH]\n",
    );
    return 1;
  }

  const idToken = flags.idToken ?? positional[0];
  if (!flags.url || !idToken) {
    io.stderr.write(
      "Usage: heart auth provider-session --url BASE_URL [--provider NAME] [--surface portal|admin] [--workspace NAME] [--customer NAME] [--id-token TOKEN] [--out PATH]\n",
    );
    return 1;
  }

  if (flags.issuer || flags.audience) {
    io.stderr.write(
      "Hosted auth exchange no longer accepts --issuer or --audience overrides. Configure the provider on the service and use --provider NAME instead.\n",
    );
    return 1;
  }

  const result = await exchangeProviderSessionRemote({
    baseUrl: flags.url,
    idToken,
    workspaceSlug: flags.workspace ?? flags.slug,
    customerSlug: flags.customer,
    providerId: flags.provider,
  });

  if (flags.out) {
    await fs.writeFile(path.resolve(io.cwd, flags.out), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  writeOutput(result, flags.json, io);
  return 0;
}

async function handleSync(subcommand, flags, positional, io) {
  if (!["setup", "profile", "docs", "benchmark"].includes(subcommand ?? "")) {
    io.stderr.write(
      "Usage: heart sync setup [--url BASE_URL --session TOKEN] [--root PATH] [--slug NAME] [--task TEXT] [--token-budget N]\n",
    );
    io.stderr.write(
      "Usage: heart sync profile [--url BASE_URL --session TOKEN] [--root PATH] [--slug NAME]\n",
    );
    io.stderr.write(
      "       heart sync docs [--url BASE_URL --session TOKEN] [--root PATH] [--slug NAME]\n",
    );
    io.stderr.write(
      "       heart sync benchmark [--url BASE_URL --session TOKEN] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] <scenario-name-or-path>\n",
    );
    return 1;
  }

  const credentials = await resolveSyncCredentials(flags, io);
  if (!credentials.api_url || !credentials.session_token) {
    io.stderr.write("Remote sync needs credentials. Run heart login, heart login --api-key=KEY, or pass --url and --session.\n");
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const profileSlug = flags.slug ?? path.basename(repoRoot);
  const workspaceSlug = flags.workspace ?? profileSlug;
  const customerSlug = flags.customer ?? workspaceSlug;

  if (subcommand === "setup") {
    const workspaceState = await buildWorkspaceState(repoRoot);
    const bundle = generateDiagramBundle({
      workspaceState,
      task: flags.task,
      target: flags.target,
    });
    const artifacts = await writeDiagramBundle(repoRoot, bundle);
    const profile = {
      ...prepareRepositoryProfileArtifact({
        repoRoot,
        workspaceState,
        bundle,
        artifacts,
        slug: profileSlug,
      }),
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
    };
    const profileResult = await syncRepositoryProfileRemote({
      baseUrl: credentials.api_url,
      sessionToken: credentials.session_token,
      profile,
      workspaceMetadata: {
        benchmark_runner: {
          repo_root: repoRoot,
          connected_at: profile.generated_at,
          source: "remote-setup-sync",
        },
      },
    });
    const artifact = {
      ...prepareRepositoryDocumentArtifact({
        profileSlug,
        repo: path.basename(repoRoot),
        documentIndex: workspaceState.documentIndex,
      }),
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
    };
    const documentsResult = await syncRepositoryDocumentsRemote({
      baseUrl: credentials.api_url,
      sessionToken: credentials.session_token,
      artifact,
    });
    const contextTask = String(flags.task ?? positional.join(" ") ?? "").trim() || "prepare first BeHeart context pack";
    const contextPackResult = await createRepositoryContextPackRemote({
      baseUrl: credentials.api_url,
      sessionToken: credentials.session_token,
      profileSlug,
      task: contextTask,
      tokenBudget: flags.tokenBudget ?? 1600,
    });
    const payload = {
      schema_version: 1,
      status: "synced",
      api_url: credentials.api_url,
      profile_slug: profileSlug,
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
      repo: path.basename(repoRoot),
      profile: {
        profile_slug: profileSlug,
        workspace_slug: workspaceSlug,
        customer_slug: customerSlug,
        generated_at: profile.generated_at,
        remote_status: profileResult.status ?? (profileResult.ok ? "synced" : "accepted"),
      },
      documents: {
        profile_slug: profileSlug,
        workspace_slug: workspaceSlug,
        document_count: artifact.documents?.length ?? artifact.summary?.document_count ?? 0,
        generated_at: artifact.generated_at,
        remote_status: documentsResult.status ?? (documentsResult.ok ? "synced" : "accepted"),
      },
      context_pack: contextPackResult,
      next_actions: [
        "Open portal workspace and confirm repo readiness.",
        "Open /models and test the selected provider.",
        `Open /workbench and attach ${contextPackResult.pack_id ?? "the new context pack"}.`,
      ],
    };
    writeOutput(flags.json ? payload : formatSyncSetupOutput(payload), flags.json, io);
    return 0;
  }

  if (subcommand === "profile") {
    const workspaceState = await buildWorkspaceState(repoRoot);
    const bundle = generateDiagramBundle({
      workspaceState,
      task: flags.task,
      target: flags.target,
    });
    const artifacts = await writeDiagramBundle(repoRoot, bundle);
    const profile = {
      ...prepareRepositoryProfileArtifact({
        repoRoot,
        workspaceState,
        bundle,
        artifacts,
        slug: profileSlug,
      }),
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
    };
    const result = await syncRepositoryProfileRemote({
      baseUrl: credentials.api_url,
      sessionToken: credentials.session_token,
      profile,
      workspaceMetadata: {
        benchmark_runner: {
          repo_root: repoRoot,
          connected_at: profile.generated_at,
          source: "remote-profile-sync",
        },
      },
    });
    writeOutput(result, flags.json, io);
    return 0;
  }

  if (subcommand === "docs") {
    const workspaceState = await buildWorkspaceState(repoRoot);
    const artifact = {
      ...prepareRepositoryDocumentArtifact({
        profileSlug,
        repo: path.basename(repoRoot),
        documentIndex: workspaceState.documentIndex,
      }),
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
    };
    const result = await syncRepositoryDocumentsRemote({
      baseUrl: credentials.api_url,
      sessionToken: credentials.session_token,
      artifact,
    });
    writeOutput(result, flags.json, io);
    return 0;
  }

  if (positional.length < 1) {
    io.stderr.write(
      "Usage: heart sync benchmark [--url BASE_URL --session TOKEN] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] <scenario-name-or-path>\n",
    );
    return 1;
  }

  const benchmarkWorkspaceState = await buildWorkspaceState(repoRoot);
  const scenario = await loadBenchmarkScenario(positional[0], repoRoot);
  const scenarioReport = await runBenchmarkScenario(positional[0], {
    repoRoot,
    repo: path.basename(repoRoot),
    profile_slug: profileSlug,
    scenario: flags.scenario,
    provider: flags.provider,
    model: flags.model,
    scenarioManifest: scenario,
  });
  const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, scenarioReport, {
    baselineInput: scenario.baseline,
    assistedInput: scenario.assisted,
    evaluation: {
      scenario_path: scenario.path,
    },
    scenario,
    dataset: scenario.dataset ?? null,
    scanProvenance: benchmarkWorkspaceState.scanProvenance,
    readiness: benchmarkWorkspaceState.readiness,
  });
  const report = {
    ...prepareBenchmarkReportArtifact({
      ...scenarioReport,
      evidence_bundle: evidenceBundle,
    }),
    workspace_slug: workspaceSlug,
    customer_slug: customerSlug,
  };
  const result = await syncBenchmarkReportRemote({
    baseUrl: credentials.api_url,
    sessionToken: credentials.session_token,
    report,
  });
  writeOutput(result, flags.json, io);
  return 0;
}

function parseArgs(argv) {
  const tokens = [...argv];
  const flags = {};
  const positional = [];
  let command;
  let subcommand;
  const flagDefinitions = createFlagDefinitions();

  while (tokens.length > 0) {
    const token = tokens.shift();

    if (token === "--") {
      flags.command = [...tokens];
      break;
    }

    if (token.startsWith("--")) {
      const equalsIndex = token.indexOf("=");
      const flagToken = equalsIndex > 2 ? token.slice(0, equalsIndex) : token;
      const inlineValue = equalsIndex > 2 ? token.slice(equalsIndex + 1) : undefined;
      const definition = flagDefinitions[flagToken];
      if (!definition) {
        return {
          error: `Unknown flag: ${flagToken}`,
          command,
          subcommand,
          flags,
          positional,
        };
      }

      if (definition.type === "boolean") {
        if (inlineValue !== undefined) {
          return {
            error: `${flagToken} does not accept a value.`,
            command,
            subcommand,
            flags,
            positional,
          };
        }
        flags[definition.key] = true;
      } else {
        const rawValue = inlineValue ?? tokens.shift();
        if (rawValue === undefined || (inlineValue === undefined && rawValue.startsWith("--"))) {
          return {
            error: `${flagToken} requires a value.`,
            command,
            subcommand,
            flags,
            positional,
          };
        }

        const parsedValue = parseFlagValue(flagToken, rawValue, definition);
        if (parsedValue.error) {
          return {
            error: parsedValue.error,
            command,
            subcommand,
            flags,
            positional,
          };
        }
        flags[definition.key] = parsedValue.value;
      }
      continue;
    }

    if (!command) {
      command = token;
      continue;
    }

    if (
      (command === "mcp" ||
        command === "packs" ||
        command === "connect" ||
        command === "docs" ||
        command === "diagram" ||
        command === "benchmark" ||
        command === "models" ||
        command === "agent" ||
        command === "service" ||
        command === "auth" ||
        command === "ide" ||
        command === "sync" ||
        command === "policy" ||
        command === "find") &&
      !subcommand
    ) {
      subcommand = token;
      continue;
    }

    positional.push(token);
  }

  const validationError = validateAllowedFlags(command, subcommand, flags);
  if (validationError) {
    return {
      error: validationError,
      command,
      subcommand,
      flags,
      positional,
    };
  }

  return {
    command,
    subcommand,
    flags,
    positional,
  };
}

function resolveRepoRoot(rootFlag, cwd) {
  return path.resolve(cwd, rootFlag ?? ".");
}

function writeOutput(payload, jsonMode, io) {
  if (jsonMode) {
    io.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  if (typeof payload === "string") {
    io.stdout.write(`${payload}\n`);
    return;
  }

  io.stdout.write(`${formatObject(payload)}\n`);
}

async function buildIdeMemoryPanel({ repoRoot, query = "", view = "summary", select = "" } = {}) {
  const workspaceState = await buildWorkspaceState(repoRoot);
  const overview = createProjectOverview(
    workspaceState.graph,
    workspaceState.policyReport,
    workspaceState.documentIndex,
    workspaceState.heartModel,
  );
  const documents = workspaceState.documentIndex?.documents ?? [];
  const documentMatches = query
    ? findRelevantDocuments(workspaceState.documentIndex, query, 6)
    : documents.slice(0, 6).map((document) => ({
        path: document.path,
        title: document.title,
        category: document.category,
        sensitivity: document.sensitivity,
      }));
  const policyViolations = workspaceState.policyReport?.violations ?? [];
  const domainPacks = await listDomainPacks({ repoRoot }).catch(() => []);
  const suggestedAttachments = [
    {
      type: "repo_graph",
      label: overview.repo ?? path.basename(repoRoot),
      summary: `${overview.file_count ?? 0} files, ${overview.symbol_count ?? 0} symbols`,
    },
    ...(documentMatches.length > 0
      ? [{
          type: "docs_spec",
          label: "docs/spec",
          summary: `${documentMatches.length} relevant document(s)`,
        }]
      : []),
    ...(policyViolations.length > 0
      ? [{
          type: "policy_report",
          label: "policy",
          summary: `${policyViolations.length} warning(s)`,
        }]
      : []),
    ...(query
      ? [{
          type: "context_pack",
          label: query,
          summary: "Build task-specific implementation context before editing.",
        }]
      : []),
    ...(domainPacks.length > 0
      ? [{
          type: "domain_pack",
          label: domainPacks[0].pack_id,
          summary: domainPacks[0].name ?? "Domain pack",
        }]
      : []),
  ];
  const artifacts = buildMemoryArtifacts({
    view,
    query,
    graph: overview,
    documentMatches,
    policyViolations,
    domainPacks,
    suggestedAttachments,
  });
  const selectedArtifact = select
    ? artifacts.find((artifact) => artifact.artifact_id === select) ?? null
    : null;

  return {
    schema_version: 1,
    repo_root: repoRoot,
    view,
    query,
    graph: {
      repo: overview.repo,
      file_count: overview.file_count ?? 0,
      symbol_count: overview.symbol_count ?? 0,
      domain_count: overview.domain_count ?? 0,
      relationship_count: overview.relationship_count ?? 0,
      top_directories: overview.top_directories ?? [],
    },
    docs: {
      document_count: workspaceState.documentIndex?.totals?.document_count ?? documents.length,
      category_counts: workspaceState.documentIndex?.totals?.category_counts ?? {},
      matches: documentMatches,
    },
    policy: {
      warning_count: policyViolations.length,
      violations: policyViolations.slice(0, 8),
    },
    domain_packs: {
      count: domainPacks.length,
      packs: domainPacks.slice(0, 8),
    },
    suggested_attachments: suggestedAttachments,
    artifacts,
    selected_artifact: selectedArtifact,
    selection_status: select ? (selectedArtifact ? "selected" : "not_found") : "none",
    next_actions: [
      query ? `heart ide context ${JSON.stringify(query)}` : `heart ide context ${JSON.stringify("your task")}`,
      query ? `heart ide memory docs ${JSON.stringify(query)}` : "heart ide memory docs",
      "heart ide memory graph",
      "heart ide memory policy",
      "heart ide memory domain",
      artifacts[0] ? `heart ide memory ${view} ${query ? `${quoteCliArg(query)} ` : ""}--select ${quoteCliArg(artifacts[0].artifact_id)}` : "",
    ].filter(Boolean),
  };
}

function buildMemoryArtifacts({
  view = "summary",
  query = "",
  graph = {},
  documentMatches = [],
  policyViolations = [],
  domainPacks = [],
  suggestedAttachments = [],
} = {}) {
  const artifacts = [];
  if (view === "summary" || view === "graph") {
    artifacts.push({
      artifact_id: "graph:overview",
      type: "repo_graph",
      label: graph.repo ?? "repo graph",
      summary: `${graph.file_count ?? 0} files, ${graph.symbol_count ?? 0} symbols, ${graph.relationship_count ?? 0} relationships`,
      next_actions: ["heart ide graph", query ? `heart ide context ${quoteCliArg(query)}` : "heart ide context \"your task\""],
    });
    for (const [index, directory] of (graph.top_directories ?? []).slice(0, 5).entries()) {
      const label = typeof directory === "string" ? directory : directory.path ?? directory.name ?? `directory ${index + 1}`;
      artifacts.push({
        artifact_id: `graph:dir:${index + 1}`,
        type: "repo_graph",
        label,
        summary: typeof directory === "string" ? "Top graph directory" : `${directory.file_count ?? directory.count ?? 0} file(s)`,
        next_actions: [`heart ide files ${quoteCliArg(label)}`, "heart ide graph"],
      });
    }
  }

  if (view === "summary" || view === "docs") {
    for (const [index, document] of documentMatches.slice(0, 8).entries()) {
      const label = document.title ?? document.path ?? `document ${index + 1}`;
      artifacts.push({
        artifact_id: `docs:${index + 1}`,
        type: "docs_spec",
        label,
        path: document.path,
        summary: document.category ?? document.sensitivity?.level ?? document.sensitivity ?? "document memory",
        next_actions: [
          document.path ? `heart ide open ${quoteCliArg(document.path)}` : "heart ide docs",
          query ? `heart ide docs ${quoteCliArg(query)}` : "heart ide docs",
        ],
      });
    }
  }

  if (view === "summary" || view === "policy") {
    for (const [index, violation] of policyViolations.slice(0, 8).entries()) {
      artifacts.push({
        artifact_id: `policy:${index + 1}`,
        type: "policy_warning",
        label: violation.rule_id ?? violation.rule ?? `policy warning ${index + 1}`,
        path: violation.path,
        summary: violation.message ?? violation.summary ?? "Policy warning",
        next_actions: ["heart ide policy", violation.path ? `heart ide open ${quoteCliArg(violation.path)}` : "heart ide policy"],
      });
    }
  }

  if (view === "summary" || view === "domain") {
    for (const pack of domainPacks.slice(0, 8)) {
      artifacts.push({
        artifact_id: `domain:${pack.pack_id}`,
        type: "domain_pack",
        label: pack.name ?? pack.pack_id,
        summary: pack.description ?? "Domain pack",
        next_actions: [`heart ide domain show ${quoteCliArg(pack.pack_id)}`, `heart ide domain build ${quoteCliArg(pack.pack_id)}`],
      });
    }
  }

  if (view === "summary" || view === "attachments") {
    for (const [index, attachment] of suggestedAttachments.slice(0, 8).entries()) {
      artifacts.push({
        artifact_id: `attachment:${index + 1}`,
        type: "context_attachment",
        label: attachment.label,
        summary: `${attachment.type}: ${attachment.summary}`,
        next_actions: [query ? `heart ide context ${quoteCliArg(query)}` : "heart ide context \"your task\""],
      });
    }
  }

  return artifacts;
}

function formatObject(value) {
  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${typeof entry === "string" ? entry : JSON.stringify(entry)}`)
    .join("\n");
}

function formatIdeList(title, items = []) {
  return [title, ...items.slice(0, 40).map((entry) => `- ${entry}`)].join("\n");
}

function formatKeymap(keymap) {
  return [
    `Keymap: ${keymap.profile}`,
    `Bindings: ${keymap.bindings.length}`,
    `Conflicts: ${keymap.conflicts.length}`,
    ...keymap.bindings.slice(0, 24).map((entry) => `- ${entry.key}: ${entry.action} (${entry.when})`),
  ].join("\n");
}

function formatPalette(commands = []) {
  return ["Command palette", ...commands.map((entry) => `- ${entry.action}: ${entry.label} [${entry.safety_level}]`)].join("\n");
}

function formatTasks(tasks = []) {
  return ["Tasks", ...tasks.map((entry) => `- ${entry.script_name}: ${entry.kind}, ${entry.safety_level}`)].join("\n");
}

function formatToolRun(result = {}) {
  return [
    `Task: ${result.status}`,
    result.command_preview ? `Command: ${result.command_preview}` : "",
    result.message ? `Message: ${result.message}` : "",
    result.exit_code !== null && result.exit_code !== undefined ? `Exit: ${result.exit_code}` : "",
    result.diagnostics?.length ? `Diagnostics: ${result.diagnostics.length}` : "",
    result.stdout_preview ? `Stdout:\n${result.stdout_preview}` : "",
    result.stderr_preview ? `Stderr:\n${result.stderr_preview}` : "",
  ].filter(Boolean).join("\n");
}

function formatDiagnosticsPanel(payload = {}) {
  const summary = payload.summary
    ? ` errors ${payload.summary.error ?? 0}, warnings ${payload.summary.warning ?? 0}, info ${payload.summary.info ?? 0}, hints ${payload.summary.hint ?? 0}`
    : "";
  const grouped = groupDiagnosticsByFile(payload.diagnostics ?? []);
  return [
    `Diagnostics: ${payload.diagnostics?.length ?? 0} (${payload.format ?? "text"}/${payload.source ?? "task"})${summary}`,
    ...Object.entries(grouped).slice(0, 16).flatMap(([filePath, diagnostics]) => [
      `- ${filePath}`,
      ...diagnostics.slice(0, 8).map((entry) => {
        const location = `${entry.range?.start?.line ?? 0}:${entry.range?.start?.column ?? 0}`;
        return `  ${entry.severity} ${location}${entry.code ? ` ${entry.code}` : ""}: ${entry.message}`;
      }),
    ]),
  ].join("\n");
}

function formatDiagnosticsNavigation(payload = {}) {
  return [
    `Diagnostics navigation: ${payload.items?.length ?? 0} item(s)`,
    ...((payload.items ?? []).slice(0, 40).map((entry) => `${entry.key}. ${entry.path}:${entry.line}:${entry.column} ${entry.severity}${entry.code ? ` ${entry.code}` : ""} ${entry.label.replace(/^.*?\s+(error|warning|info|hint)\s*/i, "")}`)),
    "Next:",
    ...((payload.next_actions ?? []).map((entry) => `  ${entry}`)),
  ].join("\n");
}

function formatGitWorkflow(payload = {}) {
  const files = payload.status?.files ?? [];
  return [
    `Git: ${payload.status?.branch ?? "unknown"} (${files.length} changed file(s))`,
    ...files.slice(0, 24).map((entry) => `- ${entry.status} ${entry.path}`),
    "",
    `Commit draft: ${payload.commit_summary?.subject ?? ""}`,
  ].join("\n");
}

function formatIdeDiff(payload = {}) {
  return [
    `Diff: ${payload.file_count ?? 0} file(s)${payload.staged ? " staged" : ""}`,
    payload.diff ?? "",
  ].filter(Boolean).join("\n");
}

function formatGitReview(payload = {}) {
  return [
    `Review: ${payload.status?.branch ?? "unknown"} (${payload.status?.changed_file_count ?? 0} changed file(s))`,
    `Staged: ${payload.staged?.file_count ?? 0}`,
    ...(payload.files ?? [])
      .filter((entry) => entry.index_status && entry.index_status !== " " && entry.index_status !== "?")
      .slice(0, 16)
      .map((entry) => `- [staged ${entry.index_status}] ${entry.path}`),
    `Unstaged: ${payload.unstaged?.file_count ?? 0}`,
    ...(payload.files ?? [])
      .filter((entry) => entry.worktree_status && entry.worktree_status !== " ")
      .slice(0, 16)
      .map((entry) => `- [worktree ${entry.worktree_status}] ${entry.path}`),
    "Next:",
    ...(payload.next_actions ?? []).map((entry) => `  ${entry}`),
  ].join("\n");
}

function formatStagePicker(payload = {}) {
  return [
    `Stage picker: ${payload.branch ?? "unknown"} (${payload.choices?.length ?? 0} choice(s))`,
    ...(payload.choices ?? []).slice(0, 40).map((entry) => `${entry.key}. ${entry.action} ${entry.path} [${entry.index_status}${entry.worktree_status}]`),
    "Next:",
    ...((payload.next_actions ?? []).map((entry) => `  ${entry}`)),
  ].join("\n");
}

function formatStagePickerPayload(payload = {}) {
  if (payload.selected_choices) {
    return [
      `Stage picker: ${payload.status}`,
      payload.message ?? "",
      ...(payload.selected_choices ?? []).map((entry) => `- ${entry.key}. ${entry.action} ${entry.path} [${entry.index_status}${entry.worktree_status}]`),
      payload.next_action ? `Next: ${payload.next_action}` : "",
    ].filter(Boolean).join("\n");
  }
  if (payload.status && !payload.choices) {
    return [
      `Stage picker: ${payload.status}`,
      payload.message ?? "",
      payload.next_action ? `Next: ${payload.next_action}` : "",
    ].filter(Boolean).join("\n");
  }
  return formatStagePicker(payload);
}

function formatLspProbe(payload = {}) {
  const summary = payload.capabilities_summary ?? {};
  return [
    `LSP probe: ${payload.status}`,
    payload.server?.server_id ? `Server: ${payload.server.server_id} (${payload.server.command_preview || "unresolved"})` : "",
    payload.message ? `Message: ${payload.message}` : "",
    `Capabilities: completion=${Boolean(summary.completion_provider)} hover=${Boolean(summary.hover_provider)} definition=${Boolean(summary.definition_provider)} codeAction=${Boolean(summary.code_action_provider)}`,
  ].filter(Boolean).join("\n");
}

function formatLspDiagnosticsStream(payload = {}) {
  return [
    `LSP diagnostics: ${payload.status}`,
    payload.server?.server_id ? `Server: ${payload.server.server_id} (${payload.server.command_preview || "unresolved"})` : "",
    payload.opened_file ? `File: ${payload.opened_file}` : "",
    payload.message ? `Message: ${payload.message}` : "",
    formatDiagnosticsPanel(payload),
  ].filter(Boolean).join("\n");
}

function formatGitStageResult(payload = {}) {
  return [
    `Git index: ${payload.status}`,
    payload.message ?? "",
    ...(payload.files ?? []).map((entry) => `- ${entry}`),
  ].filter(Boolean).join("\n");
}

function formatDocsPanel(payload = {}) {
  return [
    `Docs/specs: ${payload.document_count ?? 0} document(s)`,
    ...Object.entries(payload.category_counts ?? {}).slice(0, 8).map(([name, count]) => `- ${name}: ${count}`),
    ...(payload.documents ?? []).slice(0, 12).map((entry) => `- ${entry.path}: ${entry.title ?? entry.category ?? "document"}`),
  ].join("\n");
}

function formatMemoryPanel(payload = {}) {
  return [
    `Memory: ${payload.graph?.repo ?? path.basename(payload.repo_root ?? "")}`,
    `Graph: ${payload.graph?.file_count ?? 0} files, ${payload.graph?.symbol_count ?? 0} symbols, ${payload.graph?.relationship_count ?? 0} relationships`,
    `Docs/spec: ${payload.docs?.document_count ?? 0} document(s)`,
    ...((payload.docs?.matches ?? []).slice(0, 6).map((entry) => `- doc ${entry.path}: ${entry.title ?? entry.category ?? "document"}`)),
    `Policy: ${payload.policy?.warning_count ?? 0} warning(s)`,
    `Domain packs: ${payload.domain_packs?.count ?? 0}`,
    payload.selected_artifact ? `Selected: ${payload.selected_artifact.artifact_id} ${payload.selected_artifact.label}` : "",
    "Artifacts:",
    ...((payload.artifacts ?? []).slice(0, 10).map((entry) => `- ${entry.artifact_id}: ${entry.label} (${entry.type})`)),
    "Attachments:",
    ...((payload.suggested_attachments ?? []).map((entry) => `- ${entry.type}: ${entry.label} (${entry.summary})`)),
    "Next:",
    ...((payload.next_actions ?? []).map((entry) => `  ${entry}`)),
  ].join("\n");
}

async function promptGitStagePicker({ repoRoot, flags = {}, io } = {}) {
  if (!io.stdin?.isTTY || !io.stdout?.isTTY) {
    return {
      schema_version: 1,
      status: "needs_tty",
      message: "Interactive stage picker requires a TTY. Use --select with --confirm for scripted usage.",
      next_action: "heart ide stage-picker --select 1 --confirm",
    };
  }

  const picker = await buildGitStagePicker({ repoRoot });
  io.stdout.write(`${formatStagePicker(picker)}\n`);
  const rl = createPromptInterface({
    input: io.stdin,
    output: io.stdout,
    terminal: true,
  });
  try {
    const selection = String(await rl.question("Select numbers to apply, or q to cancel: ")).trim();
    if (!selection || /^q(?:uit)?$/i.test(selection)) {
      return {
        schema_version: 1,
        status: "cancelled",
        message: "Stage picker cancelled.",
        selected_choices: [],
      };
    }
    const confirmed = flags.confirm || /^yes$/i.test(String(await rl.question("Apply selected stage/unstage actions? Type yes: ")).trim());
    return selectGitStagePickerChoices({ repoRoot, selection, confirmed });
  } finally {
    rl.close();
  }
}

function groupDiagnosticsByFile(diagnostics = []) {
  const grouped = {};
  for (const diagnostic of diagnostics) {
    const filePath = diagnostic.path ?? "(unknown)";
    grouped[filePath] ??= [];
    grouped[filePath].push(diagnostic);
  }
  return grouped;
}

function quoteCliArg(value) {
  const text = String(value ?? "");
  return /^[a-zA-Z0-9_./:@-]+$/.test(text) ? text : JSON.stringify(text);
}

function formatPatchPreview(preview = {}) {
  return [
    `Patch preview: ${preview.status}`,
    `Files: ${(preview.hunks ?? []).length}`,
    ...(preview.conflict_warnings ?? []).map((entry) => `Conflict: ${entry}`),
    ...(preview.secret_warnings ?? []).map((entry) => `Warning: ${entry}`),
    ...(preview.hunks ?? []).flatMap((hunk) => [``, `# ${hunk.path}`, hunk.diff]),
  ].join("\n");
}

function formatPatchApply(result = {}) {
  return [
    `Patch: ${result.status}`,
    result.message ?? "",
    result.rollback_id ? `Rollback: ${result.rollback_id}` : "",
    ...(result.files_changed ?? result.files_restored ?? []).map((entry) => `- ${entry}`),
  ].filter(Boolean).join("\n");
}

async function readPatchProposal(patchPath, io) {
  if (patchPath) {
    return JSON.parse(await fs.readFile(path.resolve(io.cwd, patchPath), "utf8"));
  }
  const raw = await readStdinFully(io);
  if (!raw) {
    throw new Error("Patch proposal JSON is required.");
  }
  return JSON.parse(raw);
}

async function readStdinFully(io) {
  const chunks = [];
  for await (const chunk of io.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
  }
  return chunks.join("").trim();
}

function formatModelProviders(payload) {
  const lines = [
    "Model providers:",
    ...payload.providers.map((provider) => {
      const marker = payload.selected?.provider_id === provider.provider_id ? "*" : "-";
      const key = provider.configured ? `${provider.key_source}:${provider.masked_key}` : "missing";
      return `${marker} ${provider.provider_id} (${provider.label}) key=${key} default=${provider.default_model}`;
    }),
    "",
    "Next: heart models add-key --provider openai --api-key-stdin",
  ];
  return lines.join("\n");
}

function formatModelList(payload) {
  const lines = [];
  for (const result of payload.providers) {
    lines.push(`${result.provider_id}: ${result.source}`);
    for (const warning of result.warnings ?? []) {
      lines.push(`  warning: ${warning}`);
    }
    for (const modelEntry of result.models.slice(0, 30)) {
      const selected =
        payload.selected?.provider_id === result.provider_id &&
        payload.selected?.model_id === modelEntry.model_id
          ? "*"
          : "-";
      const capabilities = Object.entries(modelEntry.capabilities ?? {})
        .filter(([, value]) => value === true)
        .map(([key]) => key)
        .join(",");
      lines.push(`  ${selected} ${modelEntry.model_id}${capabilities ? ` [${capabilities}]` : ""}`);
    }
  }
  return lines.join("\n");
}

function helpText() {
  return `BeHeart CLI

Start here
  heart             Open interactive BeHeart repo memory workbench in a TTY
  heart ide         Open terminal-first AI coding workbench
  heart chat        Explicitly open the BeHeart workbench
  heart init        Create or repair local BeHeart scaffold
  heart login       Open browser login and save sync credentials
  heart doctor      Check config, parser, cache, and MCP readiness
  heart scan        Build or refresh the local graph
  heart sync setup  Publish profile, docs, and starter context pack
  heart overview    Summarize domains, docs, and policy hotspots

Core commands
  heart find symbol <query>
  heart deps <file-or-symbol>
  heart impact <file-or-symbol>
  heart policy check
  heart pack "<task description>"
  heart packs list | show | build | validate
  heart generate tolling-management --stack next-fullstack-postgres

AI workflow
  heart login
  heart login --api-key=<key>
  heart ide
  heart ide files auth
  heart ide patch-preview proposal.json
  heart connect detect | install | verify | doctor
  heart mcp tools | serve
  heart models providers | list | pricing | validate | add-key | test | select | remove-key
  heart chat --model openai/gpt-5.1 --context repo "plan auth refactor"

Benchmark
  heart benchmark run <scenario>
  heart benchmark compare <baseline.json> <assisted.json>

More
  docs, diagram, packs, agent, service, sync, auth

Examples:
  heart init
  heart login
  heart login --api-key=<key>
  heart sync setup
  heart doctor
  heart pack --token-budget 1200 "add login audit logging"
  heart packs build tolling-management --output sales-demo-kit
  heart generate tolling-management --stack next-fullstack-postgres
  heart connect detect

Use "heart <command> --help" for command usage.
`;
}

function connectHelpText() {
  return `heart connect

Usage:
  heart connect detect [--json] [--root PATH] [--agents] [--models]
  heart connect install --client CLIENT [--json] [--root PATH] [--scope user|repo] [--model RUNTIME] [--dry-run] [--backup]
  heart connect verify --client CLIENT [--json] [--root PATH] [--scope user|repo]
  heart connect doctor [--json] [--root PATH]

Examples:
  heart connect detect
  heart connect install --client cursor --scope repo
  heart connect verify --client cursor --scope repo
`;
}

function defaultIo() {
  return {
    cwd: process.cwd(),
    env: process.env,
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function countSkillFiles(skillsRoot) {
  try {
    const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

function normalizeVerificationPlan(plan) {
  const directEntry = plan?.mcp_entry;
  if (isSpawnableMcpEntry(directEntry)) {
    return plan;
  }

  const firstEntry = directEntry?.mcpServers?.find?.((entry) => isSpawnableMcpEntry(entry));
  if (firstEntry) {
    return {
      ...plan,
      mcp_entry: firstEntry,
    };
  }

  return plan;
}

function isSpawnableMcpEntry(entry) {
  return entry && typeof entry.command === "string" && Array.isArray(entry.args);
}

function validateConnectScope(scope) {
  if (scope !== "repo" && scope !== "user") {
    return `Invalid --scope value: ${scope}. Expected repo or user.`;
  }

  return null;
}

function connectVerificationExitCode(result) {
  return result?.status === "failed" ? 1 : 0;
}

function normalizeConnectDetectionForCli(result, repoRoot) {
  const agents = Array.isArray(result?.agents)
    ? result.agents.filter((agent) => agent?.detected || agent?.configured)
    : [];
  const models = Array.isArray(result?.models) ? result.models : [];
  const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
  const recommendations =
    Array.isArray(result?.recommendations) && result.recommendations.length > 0
      ? result.recommendations
      : agents.length === 0 && models.length === 0
        ? [`heart connect install --client cursor --scope repo --root ${repoRoot}`]
        : [];

  return {
    repo_root: result?.repo_root ?? repoRoot,
    agents,
    models,
    warnings,
    recommendations,
  };
}

function normalizeConnectVerificationForCli(result) {
  const normalizeStep = (value) => (value === "ok" ? "ready" : value);
  return {
    ...result,
    config_status: normalizeStep(result?.config_status),
    spawn_status: normalizeStep(result?.spawn_status),
    initialize_status: normalizeStep(result?.initialize_status),
    tools_list_status: normalizeStep(result?.tools_list_status),
    model_runtime_status: normalizeStep(result?.model_runtime_status),
  };
}

function formatConnectClientError(error, client) {
  if (error instanceof Error && error.message.startsWith("Unsupported install client:")) {
    return `Unsupported connect client: ${client}.`;
  }

  return error instanceof Error ? error.message : String(error);
}

function formatConnectInstallError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function createPlanBackups(filePaths) {
  const backups = [];

  for (const source of filePaths) {
    const backup = await createDeterministicBackupPath(source);
    await fs.mkdir(path.dirname(backup), { recursive: true });
    await fs.copyFile(source, backup);
    backups.push({ source, backup });
  }

  return backups;
}

async function createDeterministicBackupPath(source) {
  let suffix = "";
  let attempt = 0;

  while (true) {
    const backup = `${source}.bak${suffix}`;
    try {
      await fs.access(backup);
      attempt += 1;
      suffix = `.${attempt}`;
    } catch {
      return backup;
    }
  }
}

async function syncRepositoryDocumentsToWeb({
  repoRoot,
  profileSlug,
  portalRoot,
  adminRoot,
  cwd,
}) {
  const destinations = await resolveDocumentSurfaceDestinations(repoRoot, {
    portalRoot,
    adminRoot,
    cwd,
  });

  if (destinations.length === 0) {
    return {
      synced_destinations: [],
    };
  }

  const workspaceState = await buildWorkspaceState(repoRoot);
  const published = await syncRepositoryDocumentsToSurfaces({
    repoRoot,
    profileSlug,
    repo: path.basename(repoRoot),
    documentIndex: workspaceState.documentIndex,
    portalRoot: destinations.find((destination) => destination.kind === "portal")?.root,
    adminRoot: destinations.find((destination) => destination.kind === "admin")?.root,
  });

  return {
    document_count: workspaceState.documentIndex.totals.document_count,
    service_storage_root: published.service_storage_root,
    repository_path: published.repository_path,
    synced_destinations: published.synced_destinations,
  };
}

async function resolveDocumentSurfaceDestinations(repoRoot, { portalRoot, adminRoot, cwd }) {
  const destinations = [];
  const candidates = [
    {
      kind: "portal",
      root: portalRoot ? path.resolve(cwd, portalRoot) : path.join(repoRoot, "apps", "portal"),
      explicit: Boolean(portalRoot),
    },
    {
      kind: "admin",
      root: adminRoot ? path.resolve(cwd, adminRoot) : path.join(repoRoot, "apps", "admin"),
      explicit: Boolean(adminRoot),
    },
  ];

  for (const candidate of candidates) {
    if (candidate.explicit || (await fileExists(candidate.root))) {
      destinations.push(candidate);
    }
  }

  return destinations;
}

async function executeAgentRunCapture({
  repoRoot,
  slug,
  workspace,
  customer,
  scenario,
  dataset,
  mode,
  provider,
  model,
  agentClient,
  upstreamBaseUrl,
  command,
  pricing,
} = {}) {
  const monorepoRoot = resolveMonorepoRoot(repoRoot);
  const serviceStorageRoot = resolveServiceStorageRoot({ repoRoot });
  const runId = createAgentRunId(slug ?? path.basename(repoRoot));
  const normalizedProvider = String(provider ?? "openai").trim().toLowerCase();
  const normalizedModel = String(model ?? "").trim();
  const profileSlug = String(slug ?? path.basename(repoRoot));
  const workspaceSlug = String(workspace ?? profileSlug);
  const customerSlug = String(customer ?? workspaceSlug);
  const normalizedMode = String(mode ?? "baseline");
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  const serviceHost = await startServiceHost({
    monorepoRoot,
    serviceStorageRoot,
    port: 0,
  });
  let commandResult = {
    exit_code: 1,
    signal: null,
    stdout: "",
    stderr: "",
  };

  await writeAgentRunRecord({
    serviceStorageRoot,
    run: {
      run_id: runId,
      profile_slug: profileSlug,
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
      repo: path.basename(repoRoot),
      scenario_id: String(scenario ?? ""),
      dataset_id: String(dataset ?? ""),
      mode: normalizedMode,
      status: "running",
      provider: normalizedProvider,
      model: normalizedModel,
      agent_client: String(agentClient ?? "shell"),
      upstream_base_url: String(upstreamBaseUrl ?? ""),
      created_at: startedAtIso,
      started_at: startedAtIso,
      pricing: pricing ?? {},
      command: {
        argv: command,
        cwd_hash: hashValue(repoRoot),
      },
    },
  });

  const proxyBaseUrl = `${serviceHost.url}/proxy/openai/runs/${runId}/v1`;
  try {
    commandResult = await runObservedCommand(command, {
      cwd: repoRoot,
      env: {
        ...process.env,
        OPENAI_BASE_URL: proxyBaseUrl,
        OPENAI_API_BASE: proxyBaseUrl,
        OPENAI_API_BASE_URL: proxyBaseUrl,
        BE_AI_HEART_AGENT_RUN_ID: runId,
        BE_AI_HEART_BENCHMARK_MODE: normalizedMode,
        BE_AI_HEART_BENCHMARK_SCENARIO: String(scenario ?? ""),
      },
    });
  } finally {
    await closeServiceHost(serviceHost.server);
  }

  const endedAtIso = new Date().toISOString();
  const capture = await loadAgentRunCapture({
    serviceStorageRoot,
    runId,
  });
  const persistedRun = await writeAgentRunRecord({
    serviceStorageRoot,
    run: {
      ...(capture?.run ?? {}),
      run_id: runId,
      profile_slug: profileSlug,
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
      repo: path.basename(repoRoot),
      scenario_id: String(scenario ?? ""),
      dataset_id: String(dataset ?? ""),
      mode: normalizedMode,
      status: commandResult.exit_code === 0 ? "completed" : "failed",
      provider: normalizedProvider,
      model: normalizedModel,
      agent_client: String(agentClient ?? "shell"),
      upstream_base_url: String(upstreamBaseUrl ?? ""),
      created_at: startedAtIso,
      started_at: startedAtIso,
      ended_at: endedAtIso,
      exit_code: commandResult.exit_code,
      total_tokens: capture?.summary?.total_tokens ?? 0,
      token_cost_usd: capture?.summary?.token_cost_usd ?? 0,
      observed_usage_coverage_pct: capture?.summary?.observed_usage_coverage_pct ?? 0,
      pricing: pricing ?? capture?.run?.pricing ?? {},
      measurement: capture?.summary ?? {},
      command: {
        argv: command,
        cwd_hash: hashValue(repoRoot),
      },
    },
  });
  const refreshedCapture = await loadAgentRunCapture({
    serviceStorageRoot,
    runId,
  });
  const summary = refreshedCapture?.summary ?? {
    run_id: runId,
    measurement_mode: "estimated",
    total_tokens: 0,
  };

  return {
    run: persistedRun,
    proxy: {
      provider: normalizedProvider,
      base_url: proxyBaseUrl,
      upstream_base_url: upstreamBaseUrl,
      service_url: serviceHost.url,
    },
    command: {
      argv: command,
      exit_code: commandResult.exit_code,
      signal: commandResult.signal,
      duration_ms: Date.now() - startedAt,
      stdout: commandResult.stdout,
      stderr: commandResult.stderr,
    },
    summary,
  };
}

async function writeAgentRunCaptureArtifact(repoRoot, capture = {}) {
  const captureRoot = path.join(repoRoot, ".heart", "benchmarks", "captures");
  await fs.mkdir(captureRoot, { recursive: true });

  const payload = {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    scenario: compactObject({
      id: capture.scenario?.id ?? capture.run?.scenario_id,
      title: capture.scenario?.title,
      path: capture.scenario?.path,
      dataset_id: capture.scenario?.dataset_id ?? capture.scenario?.dataset?.id ?? capture.run?.dataset_id,
    }),
    mode: String(capture.mode ?? capture.run?.mode ?? ""),
    run: capture.run ?? null,
    summary: capture.summary ?? null,
    proxy: capture.proxy ?? null,
    command: capture.command ?? null,
  };
  const capturePath = path.join(captureRoot, `${capture.run?.run_id ?? createAgentRunId("capture")}.json`);
  await fs.writeFile(capturePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return {
    capture_root: captureRoot,
    capture_path: capturePath,
  };
}

async function loadObservedRunSummary({ serviceStorageRoot, runId } = {}) {
  const capture = await loadAgentRunCapture({
    serviceStorageRoot,
    runId,
  });
  if (!capture) {
    throw new Error(`Observed agent run not found: ${runId}`);
  }
  return {
    ...capture.summary,
    run_id: capture.run.run_id,
    mode: capture.run.mode,
    status: capture.run.status,
    scenario_id: capture.run.scenario_id,
    dataset_id: capture.run.dataset_id,
    provider: capture.run.provider || capture.summary.provider,
    model: capture.run.model || capture.summary.model,
    duration_ms: capture.summary.duration_ms,
    command: capture.run.command ?? {},
    source: "agent_run",
  };
}

function validateObservedBenchmarkRunPair({ scenario = {}, baselineRun = null, assistedRun = null } = {}) {
  if (!baselineRun && !assistedRun) {
    return null;
  }

  const baselineError = validateObservedBenchmarkRun({
    run: baselineRun,
    expectedMode: "baseline",
    scenarioId: scenario.id,
  });
  if (baselineError) {
    return baselineError;
  }

  const assistedError = validateObservedBenchmarkRun({
    run: assistedRun,
    expectedMode: "assisted",
    scenarioId: scenario.id,
  });
  if (assistedError) {
    return assistedError;
  }

  if (baselineRun.provider && assistedRun.provider && baselineRun.provider !== assistedRun.provider) {
    return `Observed run provider mismatch: baseline=${baselineRun.provider} assisted=${assistedRun.provider}.`;
  }

  if (baselineRun.model && assistedRun.model && baselineRun.model !== assistedRun.model) {
    return `Observed run model mismatch: baseline=${baselineRun.model} assisted=${assistedRun.model}.`;
  }

  return null;
}

function validateObservedBenchmarkRun({ run = null, expectedMode, scenarioId } = {}) {
  if (!run) {
    return null;
  }

  const label = expectedMode === "assisted" ? "assisted" : "baseline";
  if (run.mode && run.mode !== expectedMode) {
    return `Observed ${label} run mode must be ${expectedMode}; received ${run.mode}.`;
  }

  if (run.status && run.status !== "completed") {
    return `Observed ${label} run must be completed before benchmark compare; received ${run.status}.`;
  }

  if (run.scenario_id && scenarioId && run.scenario_id !== scenarioId) {
    return `Observed ${label} run scenario ${run.scenario_id} does not match benchmark scenario ${scenarioId}.`;
  }

  if (run.measurement_mode !== "observed" || numberOrZero(run.observed_usage_coverage_pct) < 100) {
    return `Observed ${label} run does not have fully observed usage; rerun it through the BeHeart proxy before comparing.`;
  }

  return null;
}

function createPricingConfig(flags = {}) {
  const pricing = compactObject({
    input_cost_per_1m: finiteNumberOrNull(flags.inputCostPer1m),
    cached_input_cost_per_1m: finiteNumberOrNull(flags.cachedInputCostPer1m),
    output_cost_per_1m: finiteNumberOrNull(flags.outputCostPer1m),
  });
  return Object.keys(pricing).length > 0 ? pricing : {};
}

function createAgentRunId(slug) {
  return `${sanitizeSlug(slug || "agent-run")}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function resolveMonorepoRoot(repoRoot) {
  const normalizedRepoRoot = path.resolve(repoRoot);
  return hasServiceApi(normalizedRepoRoot) ? normalizedRepoRoot : path.dirname(normalizedRepoRoot);
}

function hasServiceApi(root) {
  try {
    return Boolean(process.getBuiltinModule("fs").existsSync(path.join(root, "services", "api")));
  } catch {
    return false;
  }
}

async function closeServiceHost(server) {
  await new Promise((resolve) => server.close(resolve));
}

function hashValue(value) {
  return Buffer.from(String(value ?? ""), "utf8").toString("base64url");
}

async function runObservedCommand(command, { cwd, env }) {
  return await new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      stderr += String(error?.message ?? error);
      resolve({
        exit_code: 1,
        signal: null,
        stdout,
        stderr,
      });
    });
    child.on("close", (code, signal) => {
      resolve({
        exit_code: code ?? 1,
        signal: signal ?? null,
        stdout,
        stderr,
      });
    });
  });
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundNumber(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(numberOrZero(value) * factor) / factor;
}

function finiteNumberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function parseFlagValue(token, rawValue, definition) {
  if (definition.type === "positiveInteger") {
    const parsedValue = Number(rawValue);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      return {
        error: `${token} must be a positive integer.`,
      };
    }

    return { value: parsedValue };
  }

  if (definition.type === "number") {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      return {
        error: `${token} must be a valid number.`,
      };
    }

    return { value: parsedValue };
  }

  if (definition.type === "nonNegativeNumber") {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return {
        error: `${token} must be a non-negative number.`,
      };
    }

    return { value: parsedValue };
  }

  return { value: rawValue };
}

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""));
}

function sanitizeSlug(value) {
  return String(value ?? "heart")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "heart";
}

function createFlagDefinitions() {
  return {
    "--json": { key: "json", type: "boolean" },
    "--help": { key: "help", type: "boolean" },
    "--force": { key: "force", type: "boolean" },
    "--rebuild": { key: "rebuild", type: "boolean" },
    "--all": { key: "all", type: "boolean" },
    "--agents": { key: "agents", type: "boolean" },
    "--models": { key: "models", type: "boolean" },
    "--dry-run": { key: "dryRun", type: "boolean" },
    "--backup": { key: "backup", type: "boolean" },
    "--confirm": { key: "confirm", type: "boolean" },
    "--interactive": { key: "interactive", type: "boolean" },
    "--live": { key: "live", type: "boolean" },
    "--staged": { key: "staged", type: "boolean" },
    "--preview": { key: "preview", type: "boolean" },
    "--stacks": { key: "stacks", type: "boolean" },
    "--root": { key: "root", type: "string" },
    "--task": { key: "task", type: "string" },
    "--prompt": { key: "prompt", type: "string" },
    "--target": { key: "target", type: "string" },
    "--context": { key: "context", type: "string" },
    "--pack": { key: "pack", type: "string" },
    "--token-budget": { key: "tokenBudget", type: "positiveInteger" },
    "--output": { key: "output", type: "string" },
    "--regional": { key: "regional", type: "string" },
    "--agency": { key: "agency", type: "string" },
    "--customer-requirements": { key: "customerRequirements", type: "string" },
    "--artifact": { key: "artifact", type: "string" },
    "--scope": { key: "scope", type: "string" },
    "--source": { key: "source", type: "string" },
    "--format": { key: "format", type: "string" },
    "--server": { key: "server", type: "string" },
    "--select": { key: "select", type: "string" },
    "--timeout-ms": { key: "timeoutMs", type: "positiveInteger" },
    "--diagnostic-timeout-ms": { key: "diagnosticTimeoutMs", type: "positiveInteger" },
    "--slug": { key: "slug", type: "string" },
    "--category": { key: "category", type: "string" },
    "--title": { key: "title", type: "string" },
    "--summary": { key: "summary", type: "string" },
    "--scenario": { key: "scenario", type: "string" },
    "--dataset": { key: "dataset", type: "string" },
    "--mode": { key: "mode", type: "string" },
    "--stack": { key: "stack", type: "string" },
    "--domain": { key: "domain", type: "string" },
    "--output-dir": { key: "outputDir", type: "string" },
    "--provider": { key: "provider", type: "string" },
    "--model": { key: "model", type: "string" },
    "--client": { key: "client", type: "string" },
    "--agent-client": { key: "agentClient", type: "string" },
    "--baseline-run": { key: "baselineRun", type: "string" },
    "--assisted-run": { key: "assistedRun", type: "string" },
    "--upstream-base-url": { key: "upstreamBaseUrl", type: "string" },
    "--input-cost-per-1m": { key: "inputCostPer1m", type: "nonNegativeNumber" },
    "--cached-input-cost-per-1m": { key: "cachedInputCostPer1m", type: "nonNegativeNumber" },
    "--output-cost-per-1m": { key: "outputCostPer1m", type: "nonNegativeNumber" },
    "--url": { key: "url", type: "string" },
    "--session": { key: "session", type: "string" },
    "--api-key": { key: "apiKey", type: "string" },
    "--api-key-stdin": { key: "apiKeyStdin", type: "boolean" },
    "--portal-url": { key: "portalUrl", type: "string" },
    "--credential-path": { key: "credentialPath", type: "string" },
    "--no-open": { key: "noOpen", type: "boolean" },
    "--workspace": { key: "workspace", type: "string" },
    "--customer": { key: "customer", type: "string" },
    "--surface": { key: "surface", type: "string" },
    "--id-token": { key: "idToken", type: "string" },
    "--issuer": { key: "issuer", type: "string" },
    "--audience": { key: "audience", type: "string" },
    "--portal-root": { key: "portalRoot", type: "string" },
    "--admin-root": { key: "adminRoot", type: "string" },
    "--out": { key: "out", type: "string" },
    "--profile": { key: "profile", type: "string" },
    "--keymap": { key: "keymap", type: "string" },
    "--editor": { key: "editor", type: "string" },
  };
}

function validateAllowedFlags(command, subcommand, flags) {
  if (!command) {
    return null;
  }

  const allowedFlags = resolveAllowedFlags(command, subcommand);
  if (!allowedFlags) {
    return null;
  }

  const invalidFlag = Object.keys(flags).find((flag) => flag !== "command" && flag !== "help" && !allowedFlags.has(flag));
  if (!invalidFlag) {
    return null;
  }

  return `Flag --${toKebabCase(invalidFlag)} is not supported for ${formatCommandPath(command, subcommand)}.`;
}

function resolveAllowedFlags(command, subcommand) {
  const directAllowlists = {
    init: new Set(["json", "force", "root"]),
    doctor: new Set(["json", "root"]),
    scan: new Set(["json", "rebuild", "root"]),
    overview: new Set(["json", "root"]),
    deps: new Set(["json", "root"]),
    impact: new Set(["json", "root"]),
    pack: new Set(["json", "root", "tokenBudget"]),
    generate: new Set([
      "json",
      "root",
      "stack",
      "domain",
      "mode",
      "output",
      "outputDir",
      "regional",
      "agency",
      "customerRequirements",
      "tokenBudget",
      "prompt",
      "preview",
      "confirm",
      "stacks",
    ]),
    chat: new Set(["json", "root", "provider", "model", "context", "pack", "tokenBudget", "prompt", "credentialPath"]),
    login: new Set(["json", "url", "apiKey", "apiKeyStdin", "portalUrl", "credentialPath", "noOpen"]),
    logout: new Set(["json", "credentialPath"]),
  };

  if (directAllowlists[command]) {
    return directAllowlists[command];
  }

  const nestedAllowlists = {
    find: {
      symbol: new Set(["json", "root"]),
    },
    policy: {
      check: new Set(["json", "root"]),
    },
    diagram: {
      generate: new Set(["json", "task", "target", "root"]),
      sync: new Set(["json", "slug", "portalRoot", "adminRoot", "task", "target", "root"]),
    },
    packs: {
      list: new Set(["json", "root"]),
      show: new Set(["json", "root"]),
      layers: new Set(["json", "root", "regional", "agency"]),
      build: new Set(["json", "root", "output", "regional", "agency", "customerRequirements", "tokenBudget"]),
      validate: new Set(["json", "root"]),
      conflicts: new Set(["json", "root", "regional", "agency", "customerRequirements"]),
      sync: new Set(["json", "root", "artifact"]),
      open: new Set(["json", "root", "artifact"]),
      artifacts: new Set(["json", "root"]),
    },
    benchmark: {
      run: new Set([
        "all",
        "json",
        "root",
        "slug",
        "scenario",
        "provider",
        "model",
        "portalRoot",
        "adminRoot",
        "baselineRun",
        "assistedRun",
      ]),
      compare: new Set(["json", "root", "slug", "scenario", "provider", "model", "portalRoot", "adminRoot"]),
      capture: new Set([
        "json",
        "root",
        "slug",
        "workspace",
        "customer",
        "provider",
        "model",
        "agentClient",
        "upstreamBaseUrl",
        "inputCostPer1m",
        "cachedInputCostPer1m",
        "outputCostPer1m",
      ]),
    },
    agent: {
      settings: new Set(["json", "credentialPath"]),
      run: new Set([
        "json",
        "root",
        "slug",
        "workspace",
        "customer",
        "scenario",
        "dataset",
        "mode",
        "provider",
        "model",
        "agentClient",
        "upstreamBaseUrl",
        "inputCostPer1m",
        "cachedInputCostPer1m",
        "outputCostPer1m",
      ]),
    },
    models: {
      providers: new Set(["json", "credentialPath"]),
      list: new Set(["json", "provider", "credentialPath"]),
      pricing: new Set(["json", "provider"]),
      validate: new Set(["json", "credentialPath", "live"]),
      "add-key": new Set(["json", "provider", "apiKey", "apiKeyStdin", "credentialPath"]),
      test: new Set(["json", "provider", "credentialPath"]),
      select: new Set(["json", "provider", "model", "credentialPath"]),
      "remove-key": new Set(["json", "provider", "credentialPath"]),
    },
    docs: {
      search: new Set(["json", "root"]),
      import: new Set(["json", "root", "slug", "category", "title", "summary", "portalRoot", "adminRoot"]),
      "sync-web": new Set(["json", "root", "slug", "portalRoot", "adminRoot"]),
    },
    auth: {
      "provider-session": new Set(["json", "url", "provider", "surface", "workspace", "customer", "idToken", "out"]),
    },
    sync: {
      setup: new Set(["json", "url", "session", "root", "slug", "workspace", "customer", "task", "tokenBudget", "credentialPath"]),
      profile: new Set(["json", "url", "session", "root", "slug", "workspace", "customer", "credentialPath"]),
      docs: new Set(["json", "url", "session", "root", "slug", "workspace", "customer", "credentialPath"]),
      benchmark: new Set(["json", "url", "session", "root", "slug", "workspace", "customer", "scenario", "provider", "model", "credentialPath"]),
    },
    service: {
      export: new Set(["json", "root", "out"]),
    },
    mcp: {
      tools: new Set(["json", "root"]),
      serve: new Set(["root"]),
    },
    connect: {
      detect: new Set(["json", "root", "agents", "models"]),
      install: new Set(["json", "root", "client", "scope", "model", "dryRun", "backup"]),
      verify: new Set(["json", "root", "client", "scope", "model"]),
      doctor: new Set(["json", "root"]),
    },
    ide: {
      status: new Set(["json", "root", "model", "credentialPath"]),
      files: new Set(["json", "root"]),
      open: new Set(["json", "root", "editor"]),
      keymap: new Set(["json", "root", "profile", "keymap"]),
      palette: new Set(["json"]),
      tasks: new Set(["json", "root"]),
      run: new Set(["json", "root", "confirm"]),
      diagnostics: new Set(["json", "root", "source", "format"]),
      "diagnostics-nav": new Set(["json", "root", "source", "format"]),
      git: new Set(["json", "root"]),
      diff: new Set(["json", "root", "staged"]),
      review: new Set(["json", "root"]),
      "stage-picker": new Set(["json", "root", "select", "confirm", "interactive"]),
      stage: new Set(["json", "root", "confirm"]),
      unstage: new Set(["json", "root", "confirm"]),
      "lsp-probe": new Set(["json", "root", "server", "timeoutMs"]),
      "lsp-diagnostics": new Set(["json", "root", "server", "timeoutMs", "diagnosticTimeoutMs"]),
      context: new Set(["json", "root", "tokenBudget"]),
      graph: new Set(["json", "root"]),
      docs: new Set(["json", "root"]),
      policy: new Set(["json", "root"]),
      domain: new Set(["json", "root", "output", "regional", "agency", "customerRequirements", "tokenBudget", "artifact"]),
      memory: new Set(["json", "root", "select"]),
      generate: new Set(["json", "root", "stack", "domain", "mode", "output", "outputDir", "regional", "agency", "customerRequirements", "tokenBudget", "prompt", "preview", "confirm", "stacks"]),
      "patch-preview": new Set(["json", "root"]),
      "patch-apply": new Set(["json", "root", "confirm"]),
      "patch-rollback": new Set(["json", "root"]),
    },
  };

  return nestedAllowlists[command]?.[subcommand ?? defaultSubcommandFor(command)] ?? null;
}

function defaultSubcommandFor(command) {
  if (command === "mcp") {
    return "tools";
  }
  if (command === "packs") {
    return "list";
  }
  if (command === "models") {
    return "list";
  }
  if (command === "agent") {
    return "settings";
  }
  if (command === "ide") {
    return "status";
  }

  return null;
}

function resolveHelpText(command, subcommand) {
  if (!command || command === "help") {
    return helpText();
  }

  const nestedKey = subcommand ? `${command}:${subcommand}` : null;
  const helpByCommand = {
    init: `heart init

Usage:
  heart init [--json] [--force] [--root PATH]

Creates or repairs heart.config.yaml and .heart/policies.yaml, reports detected language/runtime, and suggests next commands.`,
    doctor: `heart doctor

Usage:
  heart doctor [--json] [--root PATH]

Runs preflight checks for config, policy, parser availability, cache state, and MCP tool exposure.`,
    scan: `heart scan

Usage:
  heart scan [--json] [--rebuild] [--root PATH]

Builds or refreshes the local graph cache.`,
    overview: `heart overview

Usage:
  heart overview [--json] [--root PATH]

Summarizes the indexed repository domains and architecture hotspots.`,
    deps: `heart deps

Usage:
  heart deps [--json] [--root PATH] <file-or-symbol>

Explains dependencies for a file or symbol. Missing targets return status=not_found and exit code 3.`,
    impact: `heart impact

Usage:
  heart impact [--json] [--root PATH] <file-or-symbol>

Estimates likely dependent files, symbols, and tests. Missing targets return status=not_found and exit code 3.`,
    pack: `heart pack

Usage:
  heart pack [--json] [--token-budget N] [--root PATH] <task description>

Builds a focused context pack for a concrete coding task.`,
    packs: `heart packs

Usage:
  heart packs list [--json] [--root PATH]
  heart packs show <pack-id> [--json] [--root PATH]
  heart packs layers <pack-id> [--json] [--root PATH]
  heart packs build <pack-id> --output <type> [--regional REGION] [--agency OVERLAY] [--json] [--root PATH]
  heart packs validate <pack-id> [--json] [--root PATH]
  heart packs conflicts <pack-id> [--regional REGION] [--agency OVERLAY] [--json] [--root PATH]
  heart packs sync <pack-id> [--artifact ID] [--json] [--root PATH]
  heart packs open <pack-id> [--artifact ID] [--json] [--root PATH]

Builds source-backed domain pack and demo artifacts without arbitrary shell execution.`,
    generate: `heart generate

Usage:
  heart generate stacks [--json]
  heart generate stack <stack-id> [--json]
  heart generate modes [--json]
  heart generate <domain-id> --stack <stack-id> [--mode MODE] [--output-dir PATH] [--regional REGION] [--agency OVERLAY] [--json]
  heart generate <domain-id> --stack <stack-id> --confirm [--output-dir PATH] [--json]

Creates a Domain-to-Project generation plan by default. File writes require --confirm.`,
    login: `heart login

Usage:
  heart login
  heart login --api-key KEY
  heart login --api-key=KEY
  heart login --api-key-stdin
  heart login --url BASE_URL --api-key=KEY

Opens the BeHeart portal sign-in flow and saves a CLI credential.
Use --api-key for manual portal keys. Use --url only for local or self-hosted BeHeart APIs.`,
    logout: `heart logout

Usage:
  heart logout

Removes the saved local BeHeart credential.`,
    ide: ideHelpText(),
    chat: `heart chat

Usage:
  heart chat [--root PATH]
  heart chat [--json] [--provider PROVIDER] [--model PROVIDER/MODEL|MODEL] [--context repo|graph] [--pack PACK] <prompt>

Opens the interactive BeHeart workbench in a TTY, or sends one non-interactive model-backed chat prompt when a prompt is provided.`,
    models: `heart models

Usage:
  heart models providers [--json]
  heart models list [--provider PROVIDER] [--json]
  heart models pricing [--provider PROVIDER] [--json]
  heart models validate [--live] [--json]
  heart models add-key --provider PROVIDER --api-key-stdin
  heart models test --provider PROVIDER [--json]
  heart models select PROVIDER/MODEL [--json]
  heart models remove-key --provider PROVIDER [--json]

Manages BYOK provider keys, pricing metadata, live validation planning, and default model selection. API keys are masked in CLI output.`,
    "models:providers": `heart models providers

Usage:
  heart models providers [--json]

Lists supported providers and key status without exposing secrets.`,
    "models:list": `heart models list

Usage:
  heart models list [--provider PROVIDER] [--json]

Lists provider models. Uses dynamic discovery when a key is available and a versioned fallback list otherwise.`,
    "models:pricing": `heart models pricing

Usage:
  heart models pricing [--provider PROVIDER] [--json]

Shows BeHeart's versioned pricing catalog overlay. Provider-returned dynamic pricing still wins when available.`,
    "models:validate": `heart models validate

Usage:
  heart models validate [--live] [--json]

Prints a safe live-validation plan. Use --live to test configured provider keys and local runtimes without exposing secrets.`,
    "models:add-key": `heart models add-key

Usage:
  heart models add-key --provider PROVIDER --api-key-stdin
  heart models add-key --provider PROVIDER --api-key KEY

Stores a local model provider key with user-only file permissions. Prefer --api-key-stdin to avoid shell history.`,
    "models:test": `heart models test

Usage:
  heart models test --provider PROVIDER [--json]

Tests a provider key by calling the provider model-list endpoint.`,
    "models:select": `heart models select

Usage:
  heart models select PROVIDER/MODEL [--json]
  heart models select --provider PROVIDER --model MODEL [--json]

Persists the default provider/model for heart chat.`,
    "models:remove-key": `heart models remove-key

Usage:
  heart models remove-key --provider PROVIDER [--json]

Deletes the local provider key from BeHeart CLI storage.`,
    agent: `heart agent

Usage:
  heart agent settings [--json]
  heart agent run [--json] [--root PATH] --upstream-base-url URL -- <command ...>

Shows AI-agent settings or captures benchmarked agent runs.`,
    connect: connectHelpText(),
    mcp: `heart mcp

Usage:
  heart mcp tools [--json] [--root PATH]
  heart mcp serve [--root PATH]

Lists the effective MCP tool surface or serves BeHeart over stdio MCP.`,
    benchmark: `heart benchmark

Usage:
  heart benchmark run [--all] [--json] [--root PATH] <scenario-name-or-path>
  heart benchmark compare [--json] [--root PATH] <baseline.json> <assisted.json>

Runs or compares benchmark scenarios.`,
    "find:symbol": `heart find symbol

Usage:
  heart find symbol [--json] [--root PATH] <query>

Finds symbol matches without failing when nothing is found.`,
    "policy:check": `heart policy check

Usage:
  heart policy check [--json] [--root PATH]

Evaluates repository policy rules against the current source graph.`,
  };

  return helpByCommand[nestedKey] ?? helpByCommand[command] ?? helpText();
}

function formatCommandPath(command, subcommand) {
  return subcommand ? `heart ${command} ${subcommand}` : `heart ${command}`;
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function formatInitOutput(payload) {
  const title =
    payload.status === "created"
      ? "Init: created local scaffold"
      : payload.status === "updated"
        ? "Init: repaired local scaffold"
        : "Init: scaffold already present";
  const lines = [
    title,
    `Repo: ${payload.repo_root}`,
    `Config: ${payload.config_path}`,
    `Policy: ${payload.policy_path}`,
    `Detected: ${formatDetectedEnvironment(payload.detected)}`,
    "Next:",
    ...payload.next_commands.map((command) => `  ${command}`),
  ];

  if (payload.message) {
    lines.splice(2, 0, payload.message);
  }

  return lines.join("\n");
}

function formatLoginNeedsKeyOutput(payload) {
  return [
    "Login: browser required",
    payload.portal_url ? `Portal: ${payload.portal_url}` : "",
    payload.opened === true || payload.opened === false
      ? payload.opened
        ? "Browser: opened"
        : "Browser: not opened"
      : "",
    "Next:",
    `  ${payload.next_command}`,
  ].filter(Boolean).join("\n");
}

function formatLoginBrowserStartOutput(payload) {
  return [
    payload.opened ? "Login: opened BeHeart in your browser." : "Login: open this URL in your browser:",
    `Portal: ${payload.portal_url}`,
    "Waiting for browser sign-in...",
    "",
  ].join("\n");
}

function formatLoginOutput(payload) {
  return [
    "Login: authenticated",
    `API: ${payload.api_url}`,
    `Credential: ${payload.credential_path}`,
    `Actor: ${payload.actor_slug || "unknown"}`,
    `Workspace: ${payload.workspace_slug || "tenant"}`,
    `Key: ${payload.api_key}`,
    "Next:",
    ...payload.next_commands.map((command) => `  ${command}`),
  ].join("\n");
}

function formatSyncSetupOutput(payload) {
  return [
    "Sync setup: synced",
    `Workspace: ${payload.workspace_slug}`,
    `Repository: ${payload.repo}`,
    `Profile: ${payload.profile?.remote_status ?? "synced"}`,
    `Docs: ${payload.documents?.document_count ?? 0} document(s)`,
    `Context pack: ${payload.context_pack?.pack_id ?? "created"}`,
    "Next:",
    ...payload.next_actions.map((action) => `  ${action}`),
  ].join("\n");
}

function formatLogoutOutput(payload) {
  return [
    "Logout: local credential removed",
    `Credential: ${payload.credential_path}`,
  ].join("\n");
}

function formatDoctorOutput(payload) {
  const warnings = payload.warnings.length > 0 ? payload.warnings.map((warning) => `  - ${warning}`) : ["  - none"];
  const parserStatus = payload.parser.available ? "ready" : "limited";
  const mcpStatus = `${payload.mcp.effective_enabled_tools.length} enabled`;
  const firstRunSteps = payload.first_run?.steps ?? [];

  return [
    `Doctor: ${payload.status === "ready" ? "ready" : "attention required"}`,
    `Repo: ${payload.repo_root}`,
    `Config: ${payload.config.status} (${payload.config.path})`,
    `Policy: ${payload.policy.status} (${payload.policy.path})`,
    `Detected: ${formatDetectedEnvironment(payload.detected)}`,
    `Parser: ${parserStatus} (${payload.parser.engine}, ${payload.parser.source_file_count} source files)`,
    `Docs: ${payload.parser.document_count} indexed from ${formatInlineList(payload.document_roots, 3)}`,
    `Ignore: ${formatInlineList(payload.ignore_paths, 4)}`,
    `Cache: ${payload.cache.status} (${payload.cache.path})`,
    `MCP: ${mcpStatus}`,
    "Warnings:",
    ...warnings,
    "First-run:",
    ...firstRunSteps.map((step) => `  [${step.status}] ${step.id}: ${step.command}`),
    "Next:",
    ...payload.actions.map((action) => `  ${action}`),
  ].join("\n");
}

function formatOverviewOutput(payload, repoRoot) {
  const readiness = payload.readiness ?? {};
  const topDirectories = (payload.top_directories ?? [])
    .slice(0, 4)
    .map((entry) => `${entry.name} (${entry.count})`);
  const documentCategories = Object.entries(payload.document_categories ?? {})
    .slice(0, 4)
    .map(([name, count]) => `${name} (${count})`);
  const warnings = [
    ...(readiness.warnings ?? []),
    ...(readiness.blocking_errors ?? []),
  ];

  return [
    `Overview: ${payload.repo}`,
    `Memory: ${readiness.status ?? "unknown"} (${payload.file_count} files, ${payload.symbol_count} symbols, ${payload.document_count} docs)`,
    `Parser: ${payload.parser_engine} (${payload.parse_warnings} warnings)`,
    `Domains: ${payload.domain_count} domains, ${payload.relationship_count} links`,
    `Top dirs: ${formatInlineList(topDirectories, 4)}`,
    `Docs/spec: ${formatInlineList(documentCategories, 4)}`,
    `Policies: ${payload.policy_warnings} warnings`,
    "Warnings:",
    ...(warnings.length > 0 ? warnings.map((warning) => `  - ${warning}`) : ["  - none"]),
    "Next:",
    `  heart pack --root ${repoRoot} "your task"`,
    `  heart mcp tools --root ${repoRoot}`,
  ].join("\n");
}

function formatPackOutput(payload, repoRoot) {
  const topFiles = payload.relevant_files.slice(0, 3).map((file) => file.path);
  const topSymbols = payload.relevant_symbols.slice(0, 4).map((symbol) => symbol.name);
  const topDocs = payload.relevant_documents.slice(0, 2).map((document) => document.path);
  const warnings = payload.risks.length > 0 ? payload.risks.join(" | ") : "none";

  return [
    `Pack: ready for "${payload.task}"`,
    `Summary: ${payload.summary}`,
    `Files: ${formatInlineList(topFiles, 3)}`,
    `Symbols: ${formatInlineList(topSymbols, 4)}`,
    `Docs: ${formatInlineList(topDocs, 2)}`,
    `Warnings: ${warnings}`,
    "Next:",
    `  heart deps --root ${repoRoot} ${payload.relevant_files[0]?.path ?? "path/to/file"}`,
    `  heart policy check --root ${repoRoot}`,
  ].join("\n");
}

function formatPacksListOutput(payload) {
  return [
    "Domain packs",
    ...(payload.packs.length > 0
      ? payload.packs.map((pack) => `  ${pack.pack_id}: ${pack.name} (${pack.status})`)
      : ["  none"]),
    "Next:",
    ...payload.next_actions.map((action) => `  ${action}`),
  ].join("\n");
}

function formatPackDetailOutput(pack) {
  return [
    `Pack: ${pack.name}`,
    `ID: ${pack.pack_id}`,
    `Status: ${pack.status}`,
    `Layers: ${formatInlineList((pack.layers_available ?? []).map((layer) => layer.id), 8)}`,
    `Outputs: ${formatInlineList((pack.artifacts_available ?? []).map((artifact) => artifact.id), 8)}`,
    `Security: ${(pack.security_warnings ?? []).length} warning(s)`,
    "Next:",
    `  heart packs build ${pack.pack_id} --output sales-demo-kit`,
    `  heart packs conflicts ${pack.pack_id} --regional texas --agency hctra-example`,
  ].join("\n");
}

function formatPackLayersOutput(payload) {
  return [
    `Layers: ${payload.pack_id}`,
    ...payload.layers.map((layer) => `  ${layer.id}: ${layer.description}`),
    `Next: ${payload.next_action}`,
  ].join("\n");
}

function formatPackBuildOutput(result) {
  return [
    `Pack artifact: ${result.status}`,
    `Artifact: ${result.artifact_id}`,
    `Output: ${result.manifest.output_type}`,
    `Manifest: ${result.manifest_path}`,
    `Files: ${formatInlineList(result.generated_files, 4)}`,
    "Next:",
    ...result.next_actions.map((action) => `  ${action}`),
  ].join("\n");
}

function formatPackValidationOutput(validation) {
  return [
    `Pack validation: ${validation.status}`,
    `Errors: ${validation.errors.length > 0 ? validation.errors.join(" | ") : "none"}`,
    `Warnings: ${validation.warnings.length > 0 ? validation.warnings.join(" | ") : "none"}`,
    `Next: ${validation.next_action}`,
  ].join("\n");
}

function formatPackConflictsOutput(payload) {
  return [
    `Pack conflicts: ${payload.status}`,
    ...(payload.conflicts.length > 0
      ? payload.conflicts.map((conflict) => `  ${conflict.severity}: ${conflict.rule_id} (${conflict.earlier_layer} -> ${conflict.later_layer})`)
      : ["  none"]),
    `Next: ${payload.next_action}`,
  ].join("\n");
}

function formatPackSyncOutput(result) {
  return [
    `Pack sync: ${result.status}`,
    `Artifact: ${result.artifact_id ?? "none"}`,
    `Target: ${result.target_dir ?? "not synced"}`,
    `Next: ${result.next_action}`,
  ].join("\n");
}

function formatPackOpenOutput(payload) {
  return [
    `Pack artifact: ${payload.artifact.artifact_id}`,
    `Output: ${payload.artifact.output_type}`,
    ...(payload.files ?? []).map((file) => `  ${file.path}`),
    `Next: ${payload.next_action}`,
  ].join("\n");
}

function formatPackArtifactsOutput(payload) {
  return [
    `Pack artifacts: ${payload.pack_id}`,
    ...(payload.artifacts.length > 0
      ? payload.artifacts.map((artifact) => `  ${artifact.artifact_id}: ${artifact.output_type} (${artifact.created_at})`)
      : ["  none"]),
    `Next: ${payload.next_action}`,
  ].join("\n");
}

function formatStackPresetsOutput(payload) {
  return [
    "Stack presets",
    ...payload.presets.map((preset) => `  ${preset.stack_id}: ${preset.display_name}`),
    `Next: ${payload.next_action}`,
  ].join("\n");
}

function formatGenerationModesOutput(payload) {
  return [
    "Generation modes",
    ...payload.modes.map((mode) => `  ${mode}`),
    `Next: ${payload.next_action}`,
  ].join("\n");
}

function formatStackTradeoffsOutput(payload) {
  return [
    `Stack: ${payload.display_name}`,
    `ID: ${payload.stack_id}`,
    `Best use: ${payload.best_use}`,
    `Deploy: ${payload.deployment_path}`,
    "Pros:",
    ...payload.pros.map((item) => `  - ${item}`),
    "Cons:",
    ...payload.cons.map((item) => `  - ${item}`),
    "Commands:",
    `  dev: ${payload.commands.dev}`,
    `  build: ${payload.commands.build}`,
  ].join("\n");
}

function formatGenerationPreviewOutput(preview) {
  return [
    `Generation plan: ${preview.status}`,
    `Plan: ${preview.plan_id}`,
    `Domain: ${preview.domain_pack_id}`,
    `Mode: ${preview.mode}`,
    `Stack: ${preview.stack_preset_id || "select required"}`,
    `Output: ${preview.output_dir}`,
    `Modules: ${formatInlineList(preview.modules, 8)}`,
    `Files: ${preview.estimated_file_count}`,
    ...(preview.blocking_questions?.length
      ? ["Questions:", ...preview.blocking_questions.map((question) => `  ${question.question_id}: ${question.prompt}`)]
      : []),
    ...(preview.warnings?.length
      ? ["Warnings:", ...preview.warnings.slice(0, 8).map((warning) => `  ${warning.severity ?? "warning"}: ${warning.message ?? warning}`)]
      : []),
    "Next:",
    `  ${preview.next_action}`,
  ].join("\n");
}

function formatGenerationResultOutput(result) {
  if (!["generated", "generated_with_warnings"].includes(result.status)) {
    return formatGenerationPreviewOutput(result.preview ?? previewGenerationPlan(result.plan ?? {}));
  }
  return [
    `Generated project: ${result.status}`,
    `Root: ${result.project.root}`,
    `Manifest: ${result.project.manifest_path}`,
    `Files: ${result.generated_files.length}`,
    "Validation:",
    ...result.validation_results.map((entry) => `  ${entry.status}: ${entry.check_id} - ${entry.message}`),
    "Next:",
    ...result.next_actions.map((action) => `  ${action}`),
  ].join("\n");
}

function formatNotFoundAwareOutput(command, payload, repoRoot) {
  if (payload.found !== false) {
    return formatObject(payload);
  }

  return [
    `Target not found for ${command}: ${payload.target}`,
    `Next: heart find symbol --root ${repoRoot} ${payload.target}`,
  ].join("\n");
}

function formatMcpToolsOutput(payload) {
  return [
    `MCP tools`,
    `Repo: ${payload.repo_root}`,
    `Enabled: ${formatInlineList(payload.enabled_tools, 6)}`,
    `Disabled: ${formatInlineList(payload.disabled_tools, 6)}`,
  ].join("\n");
}

function formatConnectDetectOutput(payload) {
  return [
    `Connect: detection`,
    `Repo: ${payload.repo_root}`,
    `Agents: ${payload.agents.length > 0 ? payload.agents.map((agent) => agent.display_name).join(", ") : "none detected"}`,
    `Models: ${payload.models.length > 0 ? payload.models.map((model) => model.display_name).join(", ") : "none detected"}`,
    `Warnings: ${payload.warnings.length > 0 ? payload.warnings.join(" | ") : "none"}`,
    "Next:",
    ...(payload.recommendations.length > 0
      ? payload.recommendations.map((command) => `  ${command}`)
      : [`  heart connect doctor --root ${payload.repo_root}`]),
  ].join("\n");
}

function formatConnectInstallPlanOutput(plan) {
  return [
    `Connect install plan`,
    `Client: ${plan.client}`,
    `Scope: ${plan.scope}`,
    `Repo: ${plan.repo_root}`,
    `Writes: ${formatInlineList(plan.files_to_modify, 3)}`,
    `Command: ${describeMcpEntry(plan.mcp_entry)}`,
    "Next:",
    `  heart connect install --client ${plan.client} --scope ${plan.scope} --root ${plan.repo_root}`,
  ].join("\n");
}

function formatConnectInstallOutput(payload) {
  const warnings = payload.warnings?.length > 0 ? payload.warnings.join(" | ") : "none";
  return [
    `Connect install: ${payload.status}`,
    `Client: ${payload.client}`,
    `Writes: ${formatInlineList(payload.plan.files_to_modify, 3)}`,
    `Warnings: ${warnings}`,
    "Next:",
    `  heart connect verify --client ${payload.client} --scope ${payload.scope} --root ${payload.repo_root}`,
  ].join("\n");
}

function formatConnectVerifyOutput(payload) {
  const warnings = payload.warnings?.length > 0 ? payload.warnings.join(" | ") : "none";
  return [
    `Connect verify: ${payload.status}`,
    `Client: ${payload.client}`,
    `Config: ${payload.config_status}`,
    `Initialize: ${payload.initialize_status}`,
    `Tools: ${payload.tools_list_status}`,
    `Warnings: ${warnings}`,
  ].join("\n");
}

function formatConnectDoctorOutput(payload) {
  const inventory = payload.inventory ?? { agents: [], models: [], recommendations: [] };
  return [
    `Connect doctor: ${payload.status === "ready" ? "ready" : "action required"}`,
    `Repo: ${payload.repo_root}`,
    `Agents: ${inventory.agents.length > 0 ? inventory.agents.map((agent) => agent.display_name ?? agent.id).join(", ") : "none detected"}`,
    `Models: ${inventory.models.length > 0 ? inventory.models.map((model) => model.display_name ?? model.id).join(", ") : "none detected"}`,
    `Warnings: ${payload.warnings.length > 0 ? payload.warnings.join(" | ") : "none"}`,
    "Next:",
    ...payload.actions.map((action) => `  ${action}`),
  ].join("\n");
}

function formatDetectedEnvironment(detected) {
  const language = detected?.primary_language ?? "unknown";
  const runtime = detected?.runtime ?? "unknown";
  return `${language} on ${runtime}`;
}

function formatInlineList(values, limit = 4) {
  if (!Array.isArray(values) || values.length === 0) {
    return "none";
  }

  const visible = values.slice(0, limit);
  const remainder = values.length - visible.length;
  return remainder > 0 ? `${visible.join(", ")} (+${remainder} more)` : visible.join(", ");
}

function describeMcpEntry(entry) {
  if (entry?.command && Array.isArray(entry.args)) {
    return `${entry.command} ${entry.args.join(" ")}`;
  }

  const firstServer = entry?.mcpServers?.[0];
  if (firstServer?.command && Array.isArray(firstServer.args)) {
    return `${firstServer.command} ${firstServer.args.join(" ")}`;
  }

  return "unavailable";
}
