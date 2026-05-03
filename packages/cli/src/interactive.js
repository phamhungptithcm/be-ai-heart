import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

import { runWorkspaceDoctor } from "../../core/src/index.js";
import { listAllowedTools } from "../../agent-tools/src/index.js";
import { listProviders } from "../../model-registry/src/index.js";
import { loadCliModelConfig } from "./model-credentials.js";

const EXIT_COMMANDS = new Set(["exit", "/exit", "quit", "/quit"]);

export const SLASH_COMMANDS = Object.freeze([
  { name: "/help", description: "Show interactive commands" },
  { name: "/init", description: "Create or repair BeHeart config" },
  { name: "/login", description: "Open portal API-key login" },
  { name: "/model", description: "List or select AI model" },
  { name: "/provider", description: "Show model providers" },
  { name: "/providers", description: "Show model providers" },
  { name: "/keys", description: "Show model key status" },
  { name: "/chat", description: "Send a one-shot AI chat prompt" },
  { name: "/context", description: "Show active context settings" },
  { name: "/tools", description: "Show allowlisted tools" },
  { name: "/artifact", description: "Show generated pack artifacts" },
  { name: "/settings", description: "Show AI-agent settings" },
  { name: "/doctor", description: "Check repo memory readiness" },
  { name: "/scan", description: "Refresh repo memory" },
  { name: "/overview", description: "Summarize architecture and memory" },
  { name: "/pack", description: "Build context pack for a task" },
  { name: "/packs", description: "Browse or show domain packs" },
  { name: "/build", description: "Build tolling pack artifacts" },
  { name: "/validate", description: "Validate a domain pack" },
  { name: "/show", description: "Show pack layers or conflicts" },
  { name: "/select", description: "Select pack layer or agency overlay" },
  { name: "/find", description: "Find a symbol" },
  { name: "/impact", description: "Show impact for a file or symbol" },
  { name: "/docs", description: "Search project documents" },
  { name: "/graph", description: "Show repo graph memory" },
  { name: "/policy", description: "Check architecture policies" },
  { name: "/benchmark", description: "Run benchmark suite" },
  { name: "/connect", description: "Detect or install MCP client connection" },
  { name: "/mcp", description: "Show effective MCP tools" },
  { name: "/clear", description: "Clear the screen" },
  { name: "/exit", description: "Exit BeHeart workbench" },
]);

export function detectInteractiveTerminal(io = {}, env = process.env) {
  if (env.CI === "true" || env.CI === "1") {
    return false;
  }

  if (env.HEART_FORCE_INTERACTIVE === "1") {
    return true;
  }

  return Boolean(io.stdin?.isTTY && io.stdout?.isTTY);
}

export function handleExitCommand(input) {
  return EXIT_COMMANDS.has(String(input ?? "").trim().toLowerCase());
}

export async function startHeartSession({
  io,
  flags = {},
  runCommand,
  env = process.env,
} = {}) {
  const sessionIo = normalizeInteractiveIo(io);
  const repoRoot = path.resolve(sessionIo.cwd, flags.root ?? ".");
  const state = await loadSessionState(repoRoot, { env });
  const color = createColor(sessionIo, env);

  sessionIo.stdout.write(`${renderWelcomePanel(state, { columns: getColumns(sessionIo), color })}\n`);
  sessionIo.stdout.write(`${renderCommandMenu("", { columns: getColumns(sessionIo), color })}\n`);

  const rl = readline.createInterface({
    input: sessionIo.stdin,
    output: sessionIo.stdout,
    prompt: renderPrompt({ color }),
    completer: completeSlashCommand,
    terminal: Boolean(sessionIo.stdout.isTTY),
  });

  safePrompt(rl);

  for await (const line of rl) {
    const rawInput = String(line ?? "").trim();
    if (!rawInput) {
      rl.prompt();
      continue;
    }

    if (handleExitCommand(rawInput)) {
      sessionIo.stdout.write("Session closed.\n");
      rl.close();
      return 0;
    }

    const parsed = parseInteractiveInput(rawInput);
    const command =
      rawInput.startsWith("/")
        ? resolveSlashCommand(parsed)
        : resolveNaturalCommand(rawInput);

    if (command.kind === "clear") {
      sessionIo.stdout.write("\x1b[2J\x1b[H");
      const refreshed = await loadSessionState(repoRoot, { env });
      sessionIo.stdout.write(`${renderWelcomePanel(refreshed, { columns: getColumns(sessionIo), color })}\n`);
      safePrompt(rl);
      continue;
    }

    if (command.kind === "help" || command.kind === "menu") {
      sessionIo.stdout.write(`${renderInteractiveHelp({ color })}\n`);
      safePrompt(rl);
      continue;
    }

    if (command.kind === "unknown") {
      sessionIo.stdout.write(`${renderCliError(command, { color })}\n`);
      safePrompt(rl);
      continue;
    }

    const result = await executeInteractiveCommand({
      command,
      repoRoot,
      cwd: sessionIo.cwd,
      runCommand,
      env,
    });
    sessionIo.stdout.write(`${renderCommandResult(result, { color })}\n`);
    safePrompt(rl);
  }

  return 0;
}

function safePrompt(rl) {
  try {
    rl.prompt();
  } catch (error) {
    if (error?.code !== "ERR_USE_AFTER_CLOSE") {
      throw error;
    }
  }
}

export async function loadSessionState(repoRoot, { env = process.env } = {}) {
  let doctor = null;
  let doctorError = null;

  try {
    doctor = await runWorkspaceDoctor(repoRoot);
  } catch (error) {
    doctorError = error instanceof Error ? error.message : String(error);
  }

  const benchmark = await loadBenchmarkActivity(repoRoot);
  const agent = await loadAgentState({ env });
  const recentActivity = buildRecentActivity({ doctor, benchmark });
  const suggestedActions = buildSuggestedActions({ doctor, benchmark });

  return {
    product: "BeHeart",
    version: env.npm_package_version ?? "0.1.0",
    repoRoot,
    repoName: path.basename(repoRoot),
    safePath: formatSafePath(repoRoot, { home: os.homedir() }),
    doctor,
    doctorError,
    benchmark,
    agent,
    recentActivity,
    suggestedActions,
  };
}

async function loadAgentState({ env = process.env } = {}) {
  try {
    const modelConfig = await loadCliModelConfig({ env });
    const providers = listProviders({
      env,
      credentialState: modelConfig.credentials,
    });
    const selected = modelConfig.selected;
    const selectedProvider = providers.find((provider) => provider.provider_id === selected?.provider_id);
    const selectedModelLabel = selected
      ? `${selected.provider_id}/${selected.model_id}`
      : `${providers[0]?.provider_id ?? "openai"}/${providers[0]?.default_model ?? "provider-default"}`;
    return {
      selected_provider_id: selected?.provider_id ?? providers[0]?.provider_id ?? "openai",
      selected_model_id: selected?.model_id ?? providers[0]?.default_model ?? "",
      selected_model_label: selectedProvider
        ? selectedModelLabel
        : `${selectedModelLabel} (fallback)`,
      provider_count: providers.length,
      configured_provider_count: providers.filter((provider) => provider.configured).length,
      context_source: "repo memory + attached packs",
      tool_count: listAllowedTools().length,
      security_note: modelConfig.security?.note ?? "",
    };
  } catch {
    return {
      selected_provider_id: "openai",
      selected_model_id: "",
      selected_model_label: "openai/provider-default",
      provider_count: 0,
      configured_provider_count: 0,
      context_source: "repo memory",
      tool_count: listAllowedTools().length,
      security_note: "",
    };
  }
}

export function renderWelcomePanel(state, options = {}) {
  const columns = Math.max(52, Math.min(options.columns ?? 100, 120));
  const color = options.color ?? createColor();
  const width = Math.max(50, columns - 2);
  const contentWidth = width - 4;
  const twoColumn = width >= 88;
  const title = `${color.accent("BeHeart agent console")} ${color.dim(`v${state.version}`)}`;
  const top = `+-- ${stripAnsi(title)} ${"-".repeat(Math.max(0, width - stripAnsi(title).length - 6))}+`;
  const bottom = `+${"-".repeat(width - 2)}+`;
  const left = renderRepoStatus(state);
  const right = [
    color.accent("Command palette"),
    "Type /help for commands.",
    "Use natural language for common workflows.",
    "Exit with /exit or exit.",
    "",
    color.accent("Recent activity"),
    ...renderRecentActivity(state),
    "",
    color.accent("Suggested actions"),
    ...renderNextActions(state),
    "",
    color.accent("Workflow hints"),
    ...renderTips(state),
  ];

  const lines = [color.accent(top)];
  if (twoColumn) {
    const leftWidth = Math.floor((contentWidth - 3) * 0.52);
    const rightWidth = contentWidth - leftWidth - 3;
    const rowCount = Math.max(left.length, right.length);
    for (let index = 0; index < rowCount; index += 1) {
      const leftCell = padVisible(truncateMiddle(left[index] ?? "", leftWidth), leftWidth);
      const rightCell = padVisible(truncateMiddle(right[index] ?? "", rightWidth), rightWidth);
      lines.push(`| ${leftCell} ${color.dim("|")} ${rightCell} |`);
    }
  } else {
    for (const line of [...left, "", ...right]) {
      lines.push(`| ${padVisible(truncateMiddle(line, contentWidth), contentWidth)} |`);
    }
  }
  lines.push(color.accent(bottom));
  return lines.join("\n");
}

export function renderRepoStatus(state) {
  const doctor = state.doctor;
  const configStatus = doctor?.config?.status ?? "unknown";
  const policyStatus = doctor?.policy?.status ?? "unknown";
  const cache = doctor?.cache ?? {};
  const parser = doctor?.parser ?? {};
  const docs = doctor?.parser?.document_count ?? 0;
  const mcpTools = doctor?.mcp?.effective_enabled_tools?.length ?? 0;
  const warnings = doctor?.warnings?.length ?? 0;
  const status = doctorErrorStatus(state);
  const cacheSaved = cache.saved_at ? formatRelativeTimestamp(cache.saved_at) : "not saved";
  const benchmarkStatus = state.benchmark.available
    ? `${statusLabel("ready")}, ${state.benchmark.count} report${state.benchmark.count === 1 ? "" : "s"}`
    : statusLabel("needs_setup");

  return [
    "BeHeart repo memory workbench",
    "",
    "Session",
    formatStatusRow("Repo", state.repoName),
    formatStatusRow("Path", state.safePath),
    formatStatusRow("Memory", status),
    formatStatusRow("Model", state.agent.selected_model_label),
    formatStatusRow("Provider", `${state.agent.configured_provider_count}/${state.agent.provider_count} keys`),
    "",
    "Context",
    formatStatusRow("Config", statusLabel(configStatus)),
    formatStatusRow("Policy", policyStatus === "loaded" ? statusLabel("ready") : statusLabel(policyStatus)),
    formatStatusRow("Scan", `${statusLabel(cache.status === "ready" ? "ready" : cache.status)}; ${cacheSaved}`),
    formatStatusRow("Parser", `${parser.engine ?? "unknown"}; ${parser.source_file_count ?? 0} files`),
    formatStatusRow("Docs/spec", docs > 0 ? `${statusLabel("ready")}; ${docs} docs` : statusLabel("needs_setup")),
    formatStatusRow("MCP", mcpTools > 0 ? `${statusLabel("ready")}; ${mcpTools} tools` : statusLabel("blocked")),
    formatStatusRow("Benchmark", benchmarkStatus),
    formatStatusRow("Sources", state.agent.context_source),
    "",
    "Safety",
    formatStatusRow("Tools", `${state.agent.tool_count} allowlisted only`),
    formatStatusRow("Warnings", warnings > 0 ? `${warnings}` : "none"),
  ];
}

export function renderTips(state) {
  if (state.doctorError) {
    return ["Run /doctor to see setup details.", "Use /init if this repo has no BeHeart config."];
  }

  if (state.doctor?.config?.status === "missing") {
    return ["Run /init to create local config.", "Then run /scan to build memory."];
  }

  if (state.doctor?.cache?.status !== "ready") {
    return ["Run /scan after code or docs change.", "Use /pack <task> before agent work."];
  }

  return ["Use /pack <task> for focused AI context.", "Use /impact <path> before risky edits.", "Use /mcp to check agent tool surface."];
}

export function renderRecentActivity(state) {
  if (state.recentActivity.length === 0) {
    return ["No recent activity"];
  }
  return state.recentActivity.slice(0, 3);
}

export function renderNextActions(state) {
  return state.suggestedActions.slice(0, 3);
}

export function renderPrompt(options = {}) {
  const color = options.color ?? createColor();
  return `${color.accent("heart")} > `;
}

export function renderCommandMenu(query = "", options = {}) {
  const color = options.color ?? createColor();
  const normalized = query.trim().toLowerCase();
  const commands = SLASH_COMMANDS.filter((command) => command.name.startsWith(normalized || "/")).slice(0, 8);
  const nameWidth = Math.max(...commands.map((command) => command.name.length), 5);
  return [
    color.dim("Slash commands"),
    ...commands.map((command) => `  ${color.accent(padVisible(command.name, nameWidth))}  ${command.description}`),
  ].join("\n");
}

export function parseInteractiveInput(input) {
  const tokens = tokenizeInput(input.trim());
  if (tokens.length === 0) {
    return { raw: input, command: "", args: [] };
  }
  return {
    raw: input,
    command: tokens[0],
    args: tokens.slice(1),
  };
}

export function resolveSlashCommand(parsed) {
  const command = parsed.command.toLowerCase();
  const args = parsed.args;

  if (command === "/") {
    return { kind: "menu" };
  }

  if (command === "/help") return { kind: "help" };
  if (command === "/clear") return { kind: "clear" };
  if (command === "/exit" || command === "/quit") return { kind: "exit" };
  if (command === "/init") return cliCommand(["init"]);
  if (command === "/login") return cliCommand(["login"]);
  if (command === "/model") return args.length ? resolveModelCommand(args.join(" ")) : cliCommand(["models", "list"]);
  if (command === "/provider" || command === "/providers" || command === "/keys") return cliCommand(["models", "providers"]);
  if (command === "/chat") return args.length ? cliCommand(["chat", args.join(" ")]) : usageError("/chat requires a prompt.");
  if (command === "/context" || command === "/tools" || command === "/settings") return cliCommand(["agent", "settings"]);
  if (command === "/artifact") return cliCommand(["packs", "artifacts"]);
  if (command === "/doctor") return cliCommand(["doctor"]);
  if (command === "/scan") return cliCommand(["scan"]);
  if (command === "/overview") return cliCommand(["overview"]);
  if (command === "/graph") return cliCommand(["graph"]);
  if (command === "/policy") return cliCommand(["policy", "check"]);
  if (command === "/mcp") return cliCommand(["mcp", "tools"]);
  if (command === "/benchmark") return cliCommand(["benchmark", "run", "--all"]);
  if (command === "/pack") return args.length ? cliCommand(["pack", args.join(" ")]) : usageError("/pack requires a task.");
  if (command === "/packs") return args.length ? cliCommand(["packs", "show", resolvePackId(args.join(" "))]) : cliCommand(["packs", "list"]);
  if (command === "/build") return resolvePackBuildCommand(args.join(" "));
  if (command === "/validate") return cliCommand(["packs", "validate", resolvePackId(args.join(" "))]);
  if (command === "/show") return resolvePackShowCommand(args.join(" "));
  if (command === "/select") return resolvePackSelectCommand(args.join(" "));
  if (command === "/find") return args.length ? cliCommand(["find", "symbol", args.join(" ")]) : usageError("/find requires a symbol.");
  if (command === "/impact") return args.length ? cliCommand(["impact", args.join(" ")]) : usageError("/impact requires a path or symbol.");
  if (command === "/docs") return args.length ? cliCommand(["docs", "search", args.join(" ")]) : usageError("/docs requires a query.");
  if (command === "/connect") {
    return args.length
      ? cliCommand(["connect", "install", "--client", args[0], "--scope", "repo"])
      : cliCommand(["connect", "detect"]);
  }

  return unknownCommand(parsed.raw);
}

function resolveModelCommand(raw) {
  const input = String(raw ?? "").trim();
  if (!input) {
    return cliCommand(["models", "list"]);
  }
  if (input.includes("/")) {
    return cliCommand(["models", "select", input]);
  }
  const lower = input.toLowerCase();
  if (lower.includes("claude") || lower.includes("anthropic")) {
    return cliCommand(["models", "select", "anthropic/claude-sonnet-4-5-20250929"]);
  }
  if (lower.includes("gemini") || lower.includes("google")) {
    return cliCommand(["models", "select", "gemini/gemini-2.5-pro"]);
  }
  if (lower.includes("openai") || lower.includes("gpt")) {
    return cliCommand(["models", "select", "openai/gpt-5.1"]);
  }
  return cliCommand(["models", "list", "--provider", input]);
}

export function resolveNaturalCommand(input) {
  const text = input.trim();
  const lower = text.toLowerCase();

  if (handleExitCommand(lower)) return { kind: "exit" };
  if (lower === "help") return { kind: "help" };
  if (lower === "login" || lower === "sign in" || lower === "connect portal") return cliCommand(["login"]);
  if (/^use claude( sonnet)?$/i.test(text) || /^use anthropic/i.test(text)) {
    return cliCommand(["models", "select", "anthropic/claude-sonnet-4-5-20250929"]);
  }
  if (/^use openai/i.test(text) || /^use gpt/i.test(text)) {
    return cliCommand(["models", "select", "openai/gpt-5.1"]);
  }
  if (lower === "scan this repo" || lower === "scan repo" || lower === "scan") return cliCommand(["scan"]);
  if (lower === "show overview" || lower === "overview") return cliCommand(["overview"]);
  if (/^show graph(?: for .+)?$/i.test(text) || /^graph(?: .+)?$/i.test(text)) return cliCommand(["graph"]);
  if (lower === "check policies" || lower === "check policy" || lower === "policy") return cliCommand(["policy", "check"]);
  if (lower === "run benchmark" || lower === "benchmark") return cliCommand(["benchmark", "run", "--all"]);
  if (lower === "show available packs" || lower === "available packs" || lower === "packs") return cliCommand(["packs", "list"]);
  if (lower === "select tolling management" || lower === "show tolling management pack") {
    return cliCommand(["packs", "show", "tolling-management"]);
  }
  if (/^build tolling (sales )?demo kit$/i.test(text)) {
    return cliCommand(["packs", "build", "tolling-management", "--output", "sales-demo-kit"]);
  }
  if (/^generate tolling website$/i.test(text) || /^create demo website copy$/i.test(text)) {
    return cliCommand(["packs", "build", "tolling-management", "--output", "website"]);
  }
  if (/^create tolling proposal$/i.test(text) || /^generate proposal starter$/i.test(text)) {
    return cliCommand(["packs", "build", "tolling-management", "--output", "proposal"]);
  }
  if (/^generate benchmark scenarios$/i.test(text)) {
    return cliCommand(["packs", "build", "tolling-management", "--output", "benchmarks"]);
  }
  if (/^show agency overlays$/i.test(text)) {
    return cliCommand(["packs", "layers", "tolling-management"]);
  }
  if (/^use texas regional layer$/i.test(text)) {
    return cliCommand(["packs", "layers", "tolling-management", "--regional", "texas"]);
  }
  if (/^use hctra-style agency overlay$/i.test(text)) {
    return cliCommand(["packs", "conflicts", "tolling-management", "--agency", "hctra-example"]);
  }
  if (/^validate (this )?(tolling )?pack$/i.test(text)) {
    return cliCommand(["packs", "validate", "tolling-management"]);
  }
  if (/^show conflicts( in selected overlay| between core and agency overlay)?$/i.test(text)) {
    return cliCommand(["packs", "conflicts", "tolling-management", "--agency", "hctra-example"]);
  }

  const packMatch =
    text.match(/^(?:make|build|create|generate) (?:a )?context pack for\s+(.+)$/i) ??
    text.match(/^pack\s+(.+)$/i);
  if (packMatch) return cliCommand(["pack", stripOuterQuotes(packMatch[1])]);

  const findMatch = text.match(/^find(?: symbol)?\s+(.+)$/i);
  if (findMatch) return cliCommand(["find", "symbol", stripOuterQuotes(findMatch[1])]);

  const impactMatch = text.match(/^show impact for\s+(.+)$/i) ?? text.match(/^impact\s+(.+)$/i);
  if (impactMatch) return cliCommand(["impact", stripOuterQuotes(impactMatch[1])]);

  const docsMatch = text.match(/^search docs for\s+(.+)$/i) ?? text.match(/^docs\s+(.+)$/i);
  if (docsMatch) return cliCommand(["docs", "search", stripOuterQuotes(docsMatch[1])]);

  const connectMatch = text.match(/^connect\s+([a-z0-9-]+)$/i);
  if (connectMatch) return cliCommand(["connect", "install", "--client", connectMatch[1], "--scope", "repo"]);

  return unknownCommand(input);
}

export async function executeInteractiveCommand({
  command,
  repoRoot,
  cwd,
  runCommand,
  env = process.env,
} = {}) {
  if (command.kind !== "cli") {
    return command;
  }

  const stdout = [];
  const stderr = [];
  const args = appendRoot(command.args, repoRoot);
  const exitCode = await runCommand(args, {
    cwd,
    env,
    stdout: {
      write: (chunk) => stdout.push(String(chunk)),
    },
    stderr: {
      write: (chunk) => stderr.push(String(chunk)),
    },
  });

  return {
    kind: "result",
    args,
    exitCode,
    stdout: stdout.join("").trimEnd(),
    stderr: stderr.join("").trimEnd(),
  };
}

export function renderCommandResult(result, options = {}) {
  const color = options.color ?? createColor();
  if (result.kind === "usage_error") {
    return renderCliError(result, { color });
  }
  if (result.kind !== "result") {
    return "";
  }

  const title = result.exitCode === 0 ? color.accent("Done") : color.accent(`Exit ${result.exitCode}`);
  const body = result.stdout || result.stderr || "No output.";
  const next = renderResultNextActions(result);
  const command = color.dim(`heart ${formatResultCommandArgs(result.args).join(" ")}`);
  return [title, command, body, next].filter(Boolean).join("\n");
}

export function renderCliError(error, options = {}) {
  const color = options.color ?? createColor();
  if (error.kind === "usage_error") {
    return `${color.accent("Usage")}: ${error.message}\nType /help for examples.`;
  }

  return [
    `${color.accent("Unknown command")}: ${error.input ?? ""}`,
    "Try /help, /scan, /overview, or /pack \"your task\".",
  ].join("\n");
}

function renderInteractiveHelp(options = {}) {
  const color = options.color ?? createColor();
  return [
    color.accent("BeHeart workbench"),
    "Model-neutral AI agent console for repo memory, docs, graph, packs, benchmarks, and safe tools.",
    "",
    "Slash commands:",
    "  /model, /providers, /keys",
    "  /chat, /scan, /pack, /docs, /graph",
    "  /packs, /build, /benchmark, /mcp",
    "  /settings, /clear, /exit",
    "",
    "Natural commands:",
    "  use Claude Sonnet",
    "  use OpenAI GPT for planning",
    "  login",
    '  scan this repo',
    "  show overview",
    '  build a context pack for "add SSO login audit logging"',
    "  show graph for auth module",
    "  check policies",
    "  find loginUser",
    "  show impact for src/auth/login.ts",
    "  search docs for billing requirements",
    "  run benchmark",
    "  connect cursor",
    "  show available packs",
    "  build tolling sales demo kit",
    "  generate tolling website",
    "  validate tolling pack",
    "",
    "Command palette preview:",
    renderCommandMenu("/", { color }),
  ].join("\n");
}

function renderResultNextActions(result) {
  const command = result.args[0];
  if (result.exitCode !== 0) {
    return "Next: /doctor or /help";
  }
  if (command === "init") return "Next: /doctor, then /scan";
  if (command === "scan") return 'Next: /overview or /pack "your task"';
  if (command === "overview") return 'Next: /pack "your task"';
  if (command === "pack") return "Next: /impact <path> or /policy";
  if (command === "packs") return "Next: /packs tolling-management or /build tolling demo kit";
  if (command === "connect") return "Next: /mcp";
  if (command === "benchmark") return "Next: review .heart/benchmarks/";
  return "";
}

function formatResultCommandArgs(args = []) {
  const visible = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--root") {
      index += 1;
      continue;
    }
    visible.push(args[index]);
  }
  return visible.slice(0, 6);
}

function cliCommand(args) {
  return {
    kind: "cli",
    args,
  };
}

function resolvePackBuildCommand(raw) {
  const input = String(raw ?? "").trim().toLowerCase();
  if (!input) {
    return usageError("/build requires an output, for example /build tolling demo kit.");
  }
  const output = input.includes("website")
    ? "website"
    : input.includes("proposal")
      ? "proposal"
      : input.includes("benchmark")
        ? "benchmarks"
        : input.includes("context")
          ? "context-pack"
          : input.includes("prototype")
            ? "ui-prototype"
            : "sales-demo-kit";
  return cliCommand(["packs", "build", "tolling-management", "--output", output]);
}

function resolvePackShowCommand(raw) {
  const input = String(raw ?? "").trim().toLowerCase();
  if (input.includes("conflict")) {
    return cliCommand(["packs", "conflicts", "tolling-management", "--agency", "hctra-example"]);
  }
  if (input.includes("layer") || input.includes("overlay") || input.includes("agency")) {
    return cliCommand(["packs", "layers", "tolling-management"]);
  }
  if (input.includes("pack") || input.includes("tolling")) {
    return cliCommand(["packs", "show", "tolling-management"]);
  }
  return usageError("/show supports tolling pack, agency overlays, or tolling conflicts.");
}

function resolvePackSelectCommand(raw) {
  const input = String(raw ?? "").trim().toLowerCase();
  if (input.includes("hctra")) {
    return cliCommand(["packs", "conflicts", "tolling-management", "--agency", "hctra-example"]);
  }
  if (input.includes("txdot")) {
    return cliCommand(["packs", "conflicts", "tolling-management", "--agency", "txdot-example"]);
  }
  if (input.includes("texas")) {
    return cliCommand(["packs", "layers", "tolling-management", "--regional", "texas"]);
  }
  return usageError("/select supports agency hctra-example, agency txdot-example, or regional texas.");
}

function resolvePackId(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized.includes("tolling")) {
    return "tolling-management";
  }
  return normalized.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "tolling-management";
}

function usageError(message) {
  return {
    kind: "usage_error",
    message,
  };
}

function unknownCommand(input) {
  return {
    kind: "unknown",
    input,
  };
}

function appendRoot(args, repoRoot) {
  if (args.includes("--root")) {
    return args;
  }

  const [command, subcommand] = args;
  if (command === "mcp" && subcommand === "serve") {
    return [...args, "--root", repoRoot];
  }
  if (command === "models" || (command === "agent" && subcommand === "settings")) {
    return args;
  }

  return [...args, "--root", repoRoot];
}

function tokenizeInput(input) {
  const tokens = [];
  const matcher = /"([^"]*)"|'([^']*)'|[^\s]+/g;
  let match;
  while ((match = matcher.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[0]);
  }
  return tokens;
}

function completeSlashCommand(line) {
  if (!line.startsWith("/")) {
    return [[], line];
  }

  const hits = SLASH_COMMANDS.map((command) => command.name).filter((name) => name.startsWith(line));
  return [hits.length > 0 ? hits : SLASH_COMMANDS.map((command) => command.name), line];
}

function buildRecentActivity({ doctor, benchmark }) {
  const activity = [];
  if (doctor?.cache?.saved_at) {
    activity.push(`scan cache saved ${formatRelativeTimestamp(doctor.cache.saved_at)}`);
  }
  if (benchmark.available) {
    activity.push(`latest benchmark ${benchmark.latestReportId}`);
  }
  if (doctor?.parser?.document_count > 0) {
    activity.push(`${doctor.parser.document_count} docs indexed`);
  }
  return activity;
}

function buildSuggestedActions({ doctor, benchmark }) {
  if (!doctor) {
    return ["/doctor", "/init", "/scan"];
  }
  if (doctor.config?.status === "missing") {
    return ["/init", "/doctor", "/scan"];
  }
  if (doctor.cache?.status !== "ready") {
    return ["/scan", "/doctor", "/overview"];
  }
  if (doctor.warnings?.length > 0) {
    return ["/doctor", "/policy", "/scan"];
  }
  if (!benchmark.available) {
    return ["/overview", '/pack "your task"', "/benchmark"];
  }
  return ["/overview", '/pack "your task"', "/mcp"];
}

async function loadBenchmarkActivity(repoRoot) {
  const benchmarkRoot = path.join(repoRoot, ".heart", "benchmarks");
  try {
    const entries = await fs.readdir(benchmarkRoot, { withFileTypes: true });
    const reports = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }
      const reportPath = path.join(benchmarkRoot, entry.name);
      const stats = await fs.stat(reportPath);
      reports.push({
        report_id: entry.name.replace(/\.json$/, ""),
        path: reportPath,
        mtimeMs: stats.mtimeMs,
      });
    }
    reports.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return {
      available: reports.length > 0,
      count: reports.length,
      latestReportId: reports[0]?.report_id ?? "",
      latestPath: reports[0]?.path ?? "",
    };
  } catch {
    return {
      available: false,
      count: 0,
      latestReportId: "",
      latestPath: "",
    };
  }
}

function doctorErrorStatus(state) {
  if (state.doctorError) {
    return statusLabel("blocked");
  }
  const status = state.doctor?.status;
  if (status === "ready") return statusLabel("ready");
  if (status === "blocked") return statusLabel("blocked");
  if (status === "attention_required") return statusLabel("warning");
  return statusLabel("needs_setup");
}

function statusLabel(status) {
  const normalized = String(status ?? "").toLowerCase();
  if (["ready", "loaded", "hit"].includes(normalized)) return "Ready";
  if (["blocked", "invalid", "failed"].includes(normalized)) return "Blocked";
  if (["attention_required", "warning", "updated", "rebuild"].includes(normalized)) return "Warning";
  return "Needs setup";
}

function formatStatusRow(label, value) {
  return `${label.padEnd(11)} ${value}`;
}

function formatSafePath(repoRoot, { home = "" } = {}) {
  const normalized = repoRoot.split(path.sep).join("/");
  const normalizedHome = home.split(path.sep).join("/");
  return normalizedHome && normalized.startsWith(normalizedHome)
    ? `~${normalized.slice(normalizedHome.length)}`
    : normalized;
}

function formatRelativeTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function stripOuterQuotes(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

function truncateMiddle(value, maxLength) {
  const input = String(value ?? "");
  const visibleLength = stripAnsi(input).length;
  if (visibleLength <= maxLength) {
    return input;
  }

  if (maxLength <= 5) {
    return stripAnsi(input).slice(0, maxLength);
  }

  const clean = stripAnsi(input);
  const left = Math.ceil((maxLength - 1) / 2);
  const right = Math.floor((maxLength - 1) / 2);
  return `${clean.slice(0, left)}…${clean.slice(clean.length - right)}`;
}

function padVisible(value, width) {
  const input = String(value ?? "");
  const length = stripAnsi(input).length;
  return length >= width ? input : `${input}${" ".repeat(width - length)}`;
}

function stripAnsi(value) {
  return String(value ?? "").replace(/\x1B\[[0-9;]*m/g, "");
}

function createColor(io = {}, env = process.env) {
  const enabled = Boolean(io.stdout?.isTTY) && env.NO_COLOR !== "1" && env.NO_COLOR !== "true";
  const wrap = (code, value) => (enabled ? `\x1b[${code}m${value}\x1b[0m` : String(value));
  return {
    accent: (value) => wrap("38;5;173", value),
    dim: (value) => wrap("2", value),
  };
}

function normalizeInteractiveIo(io = {}) {
  return {
    cwd: io.cwd ?? process.cwd(),
    env: io.env ?? process.env,
    stdin: io.stdin ?? process.stdin,
    stdout: io.stdout ?? process.stdout,
    stderr: io.stderr ?? process.stderr,
  };
}

function getColumns(io = {}) {
  return Number(io.stdout?.columns) > 0 ? Number(io.stdout.columns) : 100;
}
