import os from "node:os";
import path from "node:path";
import readline from "node:readline";

import { openFile, searchFiles } from "../../editor-core/src/index.js";
import { discoverPackageScripts } from "../../dev-runner/src/index.js";
import { getGitStatus } from "../../git-workflow/src/index.js";
import { loadKeymap, resolveKeybinding } from "../../keymap/src/index.js";
import { listStackPresets } from "../../project-generator/src/index.js";
import { listDomainPacks } from "../../domain-pack-registry/src/index.js";

export const WORKBENCH_SCHEMA_VERSION = 1;

export const WORKBENCH_COMMANDS = Object.freeze([
  command("workbench.file.search", "Open file", "file", ["file", "open", "search"]),
  command("workbench.symbol.search", "Search symbol", "file", ["symbol", "find"]),
  command("ai.chat.ask", "Ask AI", "ai", ["chat", "ask"]),
  command("ai.explain.file", "Explain file", "ai", ["explain"]),
  command("ai.edit.refactorSelection", "Refactor selection", "ai", ["refactor"]),
  command("ai.edit.generateTests", "Generate tests", "ai", ["tests"]),
  command("ai.edit.fixDiagnostics", "Fix diagnostics", "ai", ["diagnostics"]),
  command("beheart.contextPack.build", "Build context pack", "beheart", ["pack", "context"]),
  command("beheart.memory.show", "Show memory panel", "beheart", ["memory", "context", "graph", "docs"]),
  command("beheart.graph.show", "Show graph", "beheart", ["graph"]),
  command("beheart.docs.search", "Search docs", "beheart", ["docs", "spec"]),
  command("dev.run.tests", "Run tests", "dev", ["test"]),
  command("dev.run.server", "Run dev server", "dev", ["dev", "server"]),
  command("dev.diagnostics.show", "Show diagnostics", "dev", ["diagnostics", "errors"]),
  command("dev.diagnostics.navigate", "Navigate diagnostics", "dev", ["diagnostics", "jump", "nav"]),
  command("dev.lsp.probe", "Probe LSP server", "dev", ["lsp", "language", "diagnostics"]),
  command("dev.lsp.diagnostics", "Stream LSP diagnostics", "dev", ["lsp", "didopen", "didchange", "diagnostics"]),
  command("git.diff.show", "Show diff", "git", ["diff"]),
  command("git.stage.picker", "Open stage picker", "git", ["stage", "picker", "review"]),
  command("git.stage.selected", "Stage selected files", "git", ["stage", "git"], "confirmation_required"),
  command("patch.apply", "Apply patch", "git", ["apply"], "confirmation_required"),
  command("patch.rollbackAi", "Revert AI change", "git", ["rollback", "revert"], "confirmation_required"),
  command("beheart.domainPack.buildArtifact", "Build domain pack artifact", "beheart", ["domain", "artifact"]),
  command("beheart.domainPack.buildTollingDemoKit", "Build tolling demo kit", "beheart", ["tolling", "demo"]),
  command("beheart.domainProject.generate", "Generate project from domain", "beheart", ["generate", "project", "starter"], "confirmation_required"),
  command("beheart.domainProject.preview", "Preview domain project plan", "beheart", ["preview", "plan", "domain"]),
  command("beheart.docs.updateSpecProposal", "Update docs/spec", "beheart", ["docs", "update"]),
  command("git.summary.commitDraft", "Commit summary", "git", ["commit"]),
  command("git.summary.prDraft", "PR summary", "git", ["pr"]),
]);

export function detectTerminalCapabilities(io = {}, env = process.env) {
  const columns = Number(io.stdout?.columns ?? env.COLUMNS ?? 80);
  const rows = Number(io.stdout?.rows ?? env.LINES ?? 24);
  return {
    schema_version: WORKBENCH_SCHEMA_VERSION,
    is_tty: Boolean(io.stdin?.isTTY && io.stdout?.isTTY),
    color: env.NO_COLOR === "1" || env.NO_COLOR === "true" ? "none" : "auto",
    columns,
    rows,
    layout: columns >= 110 ? "wide" : columns >= 80 ? "standard" : "compact",
  };
}

export async function buildWorkbenchSession({ repoRoot = process.cwd(), terminal, model = {}, doctor = null } = {}) {
  const [keymap, git, tasks] = await Promise.all([
    loadKeymap({ repoRoot }).catch((error) => ({ profile: "default", bindings: [], conflicts: [{ message: error.message }] })),
    getGitStatus({ repoRoot }).catch(() => ({ branch: "unknown", dirty: false, changed_file_count: 0, files: [] })),
    discoverPackageScripts({ repoRoot }).catch(() => ({ scripts: [] })),
  ]);
  return {
    schema_version: WORKBENCH_SCHEMA_VERSION,
    session_id: `ide-${Date.now().toString(36)}`,
    repo_root: repoRoot,
    safe_repo_path: formatSafePath(repoRoot),
    repo_name: path.basename(repoRoot),
    branch: git.branch,
    started_at: new Date().toISOString(),
    mode: "agent",
    terminal: terminal ?? detectTerminalCapabilities(),
    model,
    context_attachments: [],
    buffers: [],
    diagnostics: [],
    running_tools: [],
    git,
    tasks: tasks.scripts,
    keymap_profile: keymap.profile,
    keymap_conflicts: keymap.conflicts ?? [],
    doctor,
  };
}

export function renderWorkbenchLayout(session, options = {}) {
  const columns = Math.max(60, Number(options.columns ?? session?.terminal?.columns ?? 100));
  const width = Math.min(columns, 120);
  const line = "-".repeat(width - 2);
  const scanStatus = session?.doctor?.cache?.status ?? session?.doctor?.status ?? "unknown";
  const docsCount = session?.doctor?.documents?.count ?? session?.doctor?.document_roots?.length ?? 0;
  const modelLabel = session?.model?.selected_model_label ?? session?.model?.model_id ?? "provider-default";
  const rows = [
    `+${line}+`,
    row(`BeHeart IDE | repo ${session.repo_name} | branch ${session.branch} | model ${modelLabel}`, width),
    row(`scan ${scanStatus} | docs ${docsCount} | dirty files ${session.git?.changed_file_count ?? 0} | keymap ${session.keymap_profile}`, width),
    `+${line}+`,
    row("Ctrl+P files | Ctrl+Shift+P palette | Ctrl+K AI | Ctrl+R run | Ctrl+Shift+D diff | /exit", width),
    `+${line}+`,
  ];
  return rows.join("\n");
}

export async function startIdeWorkbench({ io, repoRoot = process.cwd(), flags = {}, runCommand, loadState } = {}) {
  const terminal = detectTerminalCapabilities(io, io?.env ?? process.env);
  if (!terminal.is_tty || flags.json) {
    const session = await buildWorkbenchSession({
      repoRoot,
      terminal,
      model: flags.model ? { model_id: flags.model } : {},
      doctor: typeof loadState === "function" ? await loadState(repoRoot) : null,
    });
    io.stdout.write(flags.json ? `${JSON.stringify(session, null, 2)}\n` : `${ideHelpText()}\n`);
    return 0;
  }

  const session = await buildWorkbenchSession({
    repoRoot,
    terminal,
    model: flags.model ? { model_id: flags.model } : {},
    doctor: typeof loadState === "function" ? await loadState(repoRoot) : null,
  });
  io.stdout.write(`${renderWorkbenchLayout(session, { columns: terminal.columns })}\n`);
  io.stdout.write("Type /help, /palette, /files <query>, /open <path>, /tasks, /git, /keymap, /chat <prompt>, /exit.\n");

  const rl = readline.createInterface({
    input: io.stdin,
    output: io.stdout,
    prompt: "heart ide> ",
    terminal: true,
  });
  rl.prompt();
  for await (const line of rl) {
    const input = String(line ?? "").trim();
    if (!input) {
      rl.prompt();
      continue;
    }
    if (input === "/exit" || input === "exit" || input === "q") {
      io.stdout.write("IDE session closed.\n");
      rl.close();
      return 0;
    }
    const result = await executeWorkbenchInput({ input, repoRoot, runCommand });
    io.stdout.write(`${formatWorkbenchResult(result)}\n`);
    rl.prompt();
  }
  return 0;
}

export function openCommandPalette({ query = "", commands = WORKBENCH_COMMANDS, limit = 12 } = {}) {
  const tokens = tokenize(query);
  return commands
    .map((entry) => ({ ...entry, score: scoreCommand(entry, tokens) }))
    .filter((entry) => tokens.length === 0 || entry.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, limit);
}

export async function executeWorkbenchCommand({ commandId, repoRoot = process.cwd(), args = [], runCommand } = {}) {
  switch (commandId) {
    case "workbench.file.search":
      return { kind: "files", files: await searchFiles({ repoRoot, query: args.join(" ") }) };
    case "beheart.contextPack.build":
      return runCommand ? runCommand(["pack", ...args]) : { kind: "cli", args: ["pack", ...args] };
    case "beheart.domainProject.preview":
    case "beheart.domainProject.generate":
      return runCommand ? runCommand(["generate", ...args]) : { kind: "cli", args: ["generate", ...args] };
    case "beheart.docs.search":
      return runCommand ? runCommand(["docs", "search", ...args]) : { kind: "cli", args: ["docs", "search", ...args] };
    case "dev.run.tests":
      return runCommand ? runCommand(["ide", "run", "test"]) : { kind: "cli", args: ["ide", "run", "test"] };
    default:
      return { kind: "command", status: "prepared", command_id: commandId, args };
  }
}

export async function executeWorkbenchInput({ input, repoRoot, runCommand } = {}) {
  if (input === "/help") {
    return { kind: "text", text: ideHelpText() };
  }
  if (input === "/domains") {
    return { kind: "domains", packs: await listDomainPacks({ repoRoot }) };
  }
  if (input.startsWith("/domain select")) {
    const domainId = input.replace(/^\/domain\s+select\s*/, "").trim() || "tolling-management";
    return { kind: "domain", text: `Selected domain pack: ${domainId}`, domain_id: domainId };
  }
  if (input.startsWith("/generate") || input.startsWith("/preview")) {
    const args = parseGenerateInput(input);
    return runCommand ? runCommand(["generate", ...args]) : { kind: "cli", args: ["generate", ...args] };
  }
  if (/start .*tolling|tolling .*project|generate .*tolling/i.test(input)) {
    const args = ["tolling-management"];
    if (/sales|demo|showcase|pitch/i.test(input)) {
      args.push("--mode", "sales-demo");
    }
    return runCommand ? runCommand(["generate", ...args]) : { kind: "cli", args: ["generate", ...args] };
  }
  if (input.startsWith("/palette")) {
    return { kind: "palette", commands: openCommandPalette({ query: input.replace(/^\/palette\s*/, "") }) };
  }
  if (input.startsWith("/files")) {
    return { kind: "files", files: await searchFiles({ repoRoot, query: input.replace(/^\/files\s*/, "") }) };
  }
  if (input.startsWith("/open")) {
    const filePath = input.replace(/^\/open\s*/, "").trim();
    const buffer = await openFile({ repoRoot, filePath });
    return { kind: "file", buffer: { ...buffer, content: buffer.content.split(/\r?\n/).slice(0, 80).join("\n") } };
  }
  if (input === "/tasks") {
    return { kind: "tasks", tasks: (await discoverPackageScripts({ repoRoot })).scripts };
  }
  if (input === "/git") {
    return { kind: "git", git: await getGitStatus({ repoRoot }) };
  }
  if (input === "/keymap") {
    const keymap = await loadKeymap({ repoRoot });
    return { kind: "keymap", keymap, sample: resolveKeybinding({ keymap, key: "Ctrl+P", context: "global" }) };
  }
  if (input.startsWith("/chat")) {
    const prompt = input.replace(/^\/chat\s*/, "").trim();
    return runCommand ? runCommand(["chat", prompt]) : { kind: "cli", args: ["chat", prompt] };
  }
  return { kind: "text", text: "Unknown IDE command. Try /help or /palette." };
}

export function ideHelpText() {
  const stacks = listStackPresets().map((preset) => `    - ${preset.stack_id}`).join("\n");
  return `heart ide

Usage:
  heart ide [--json] [--root PATH]
  heart ide status [--json] [--root PATH]
  heart ide files [--json] [--root PATH] [query]
  heart ide open [--json] [--root PATH] <file>
  heart ide keymap [--json] [--root PATH]
  heart ide palette [--json] [query]
  heart ide tasks [--json] [--root PATH]
  heart ide run <test|lint|typecheck|script> [--json] [--root PATH] [--confirm]
  heart ide diagnostics [--json] [--root PATH] [--source NAME] [--format text|lsp] [output-file]
  heart ide diagnostics-nav [--json] [--root PATH] [--source NAME] [--format text|lsp] [output-file]
  heart ide lsp-probe [--json] [--root PATH] [--server PRESET] [--timeout-ms N]
  heart ide lsp-diagnostics [--json] [--root PATH] [--server PRESET] [--timeout-ms N] <file>
  heart ide git [--json] [--root PATH]
  heart ide diff [--json] [--root PATH] [--staged]
  heart ide review [--json] [--root PATH]
  heart ide stage-picker [--json] [--root PATH] [--interactive] [--select NUMBERS] [--confirm]
  heart ide stage [--json] [--root PATH] --confirm <file...>
  heart ide unstage [--json] [--root PATH] --confirm <file...>
  heart ide context [--json] [--root PATH] <task>
  heart ide graph [--json] [--root PATH]
  heart ide docs [--json] [--root PATH] [query]
  heart ide policy [--json] [--root PATH]
  heart ide domain [--json] [--root PATH] [list|show|build] [pack-id]
  heart ide generate [--json] [--root PATH] <domain-id> --stack <stack-id> [--mode MODE] [--confirm]
  heart ide memory [--json] [--root PATH] [summary|graph|docs|policy|domain|attachments] [query] [--select ARTIFACT_ID]
  heart ide patch-preview [--json] [--root PATH] <patch.json>
  heart ide patch-apply [--json] [--root PATH] --confirm <patch.json>
  heart ide patch-rollback [--json] [--root PATH] <rollback-id>

Interactive commands:
  /domains, /domain select <id>, /generate <domain>, /preview <domain>, /palette, /files <query>, /open <path>, /tasks, /git, /keymap, /chat <prompt>, /exit

Stack presets:
${stacks}`;
}

function formatWorkbenchResult(result) {
  if (typeof result === "string") return result;
  if (result?.kind === "text") return result.text;
  if (result?.kind === "files") return ["Files:", ...(result.files ?? []).slice(0, 20).map((entry) => `- ${entry}`)].join("\n");
  if (result?.kind === "palette") return ["Commands:", ...(result.commands ?? []).map((entry) => `- ${entry.action}: ${entry.label}`)].join("\n");
  if (result?.kind === "domains") return ["Domain packs:", ...(result.packs ?? []).map((entry) => `- ${entry.pack_id}: ${entry.name}`)].join("\n");
  if (result?.kind === "domain") return result.text;
  if (result?.kind === "file") return `File: ${result.buffer.path}\n${result.buffer.content}`;
  if (result?.kind === "tasks") return ["Tasks:", ...(result.tasks ?? []).map((entry) => `- ${entry.script_name}: ${entry.safety_level}`)].join("\n");
  if (result?.kind === "git") return `Git: ${result.git.branch}, ${result.git.changed_file_count} changed file(s)`;
  if (result?.kind === "keymap") return `Keymap: ${result.keymap.profile}, ${result.keymap.bindings.length} binding(s), ${result.keymap.conflicts.length} conflict(s)`;
  return JSON.stringify(result, null, 2);
}

function parseGenerateInput(input) {
  const cleaned = input.replace(/^\/(?:generate|preview)\s*/, "").trim();
  if (!cleaned) return ["tolling-management"];
  return cleaned.split(/\s+/);
}

function row(content, width) {
  const text = String(content ?? "");
  return `| ${text.slice(0, width - 4).padEnd(width - 4, " ")} |`;
}

function formatSafePath(repoRoot) {
  const home = os.homedir();
  return path.resolve(repoRoot).startsWith(home) ? `~${path.resolve(repoRoot).slice(home.length)}` : path.resolve(repoRoot);
}

function command(action, label, category, aliases, safetyLevel = "read_only") {
  return {
    schema_version: WORKBENCH_SCHEMA_VERSION,
    command_id: action,
    action,
    label,
    aliases,
    category,
    safety_level: safetyLevel,
  };
}

function tokenize(value) {
  return String(value ?? "").toLowerCase().split(/[^a-z0-9_.-]+/).filter(Boolean);
}

function scoreCommand(commandEntry, tokens) {
  if (tokens.length === 0) return 1;
  const haystack = `${commandEntry.action} ${commandEntry.label} ${(commandEntry.aliases ?? []).join(" ")}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}
