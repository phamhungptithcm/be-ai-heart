import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export const DEV_RUNNER_SCHEMA_VERSION = 1;
const managedProcesses = new Map();

export async function discoverPackageScripts({ repoRoot = process.cwd() } = {}) {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8").catch(() => "{}"));
  const scripts = Object.entries(packageJson.scripts ?? {}).map(([name, command]) => createRunTask({
    repoRoot,
    name,
    command,
    packagePath: packageJsonPath,
  }));
  return {
    schema_version: DEV_RUNNER_SCHEMA_VERSION,
    repo_root: repoRoot,
    package_path: packageJsonPath,
    scripts,
  };
}

export async function runTests(options = {}) {
  return runNamedScript({ ...options, names: ["test"] });
}

export async function runLint(options = {}) {
  return runNamedScript({ ...options, names: ["lint"] });
}

export async function runTypecheck(options = {}) {
  return runNamedScript({ ...options, names: ["typecheck", "type-check", "tsc"] });
}

export async function runProjectTask({ repoRoot = process.cwd(), task, confirmed = false, spawnImpl = spawn, env = process.env } = {}) {
  const normalizedTask = normalizeRunTask(task, repoRoot);
  if (normalizedTask.safety_level === "denied") {
    return toolRun(normalizedTask, {
      status: "denied",
      message: "Command is blocked by workbench command policy.",
    });
  }
  if (normalizedTask.safety_level === "confirmation_required" && !confirmed) {
    return toolRun(normalizedTask, {
      status: "needs_confirmation",
      message: "This task requires confirmation before execution.",
    });
  }
  return await runCommand(normalizedTask, { spawnImpl, env });
}

export function parseDiagnosticsFromOutput({ output = "", source = "task" } = {}) {
  const diagnostics = [];
  for (const line of String(output ?? "").split(/\r?\n/)) {
    const diagnostic = parseDiagnosticLine(line, source);
    if (diagnostic) {
      diagnostics.push(diagnostic);
    }
  }
  return {
    schema_version: DEV_RUNNER_SCHEMA_VERSION,
    source,
    summary: summarizeDiagnostics(diagnostics),
    diagnostics,
  };
}

export function buildDiagnosticsNavigation({ diagnostics = [], limit = 50 } = {}) {
  const items = (diagnostics ?? [])
    .slice()
    .sort(compareDiagnostics)
    .slice(0, limit)
    .map((diagnostic, index) => {
      const line = Number(diagnostic.range?.start?.line ?? 0);
      const column = Number(diagnostic.range?.start?.column ?? 0);
      const code = String(diagnostic.code ?? "").trim();
      const pathLabel = String(diagnostic.path ?? "(unknown)");
      const severity = String(diagnostic.severity ?? "info");
      return {
        key: String(index + 1),
        severity,
        path: pathLabel,
        line,
        column,
        code,
        label: [
          `${pathLabel}:${line}:${column}`,
          severity,
          code,
          String(diagnostic.message ?? "").trim(),
        ].filter(Boolean).join(" "),
        command: `heart ide open ${quotePathForCommand(pathLabel)}`,
      };
    });

  return {
    schema_version: DEV_RUNNER_SCHEMA_VERSION,
    summary: summarizeDiagnostics(diagnostics),
    items,
    next_actions: items.length > 0
      ? [`heart ide open ${quotePathForCommand(items[0].path)}`]
      : ["No diagnostics to navigate."],
  };
}

export async function startDevServer({ repoRoot = process.cwd(), task, confirmed = false, spawnImpl = spawn, env = process.env } = {}) {
  const normalizedTask = normalizeRunTask(task, repoRoot);
  if (normalizedTask.safety_level === "denied") {
    return toolRun(normalizedTask, { status: "denied", message: "Command is blocked." });
  }
  if (!confirmed) {
    return toolRun(normalizedTask, { status: "needs_confirmation", message: "Starting a long-running task requires confirmation." });
  }
  const child = spawnImpl(normalizedTask.command[0], normalizedTask.command.slice(1), {
    cwd: normalizedTask.cwd,
    env: sanitizeEnv(env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const runId = `dev-${Date.now().toString(36)}`;
  managedProcesses.set(runId, child);
  return {
    schema_version: DEV_RUNNER_SCHEMA_VERSION,
    run_id: runId,
    tool_id: "dev_server",
    label: normalizedTask.label,
    status: "running",
    command_preview: previewCommand(normalizedTask.command),
  };
}

export async function stopDevServer({ runId } = {}) {
  const child = managedProcesses.get(runId);
  if (!child) {
    return {
      schema_version: DEV_RUNNER_SCHEMA_VERSION,
      run_id: String(runId ?? ""),
      status: "not_found",
    };
  }
  child.kill("SIGTERM");
  managedProcesses.delete(runId);
  return {
    schema_version: DEV_RUNNER_SCHEMA_VERSION,
    run_id: String(runId),
    status: "stopped",
  };
}

async function runNamedScript({ repoRoot = process.cwd(), names = [], confirmed = false, spawnImpl = spawn, env = process.env } = {}) {
  const discovery = await discoverPackageScripts({ repoRoot });
  const task = discovery.scripts.find((entry) => names.includes(entry.script_name));
  if (!task) {
    return {
      schema_version: DEV_RUNNER_SCHEMA_VERSION,
      status: "not_found",
      message: `No package script found for: ${names.join(", ")}`,
      available_scripts: discovery.scripts.map((entry) => entry.script_name),
    };
  }
  return runProjectTask({ repoRoot, task, confirmed, spawnImpl, env });
}

function createRunTask({ repoRoot, name, command, packagePath }) {
  return {
    schema_version: DEV_RUNNER_SCHEMA_VERSION,
    task_id: `npm:${name}`,
    label: `npm run ${name}`,
    script_name: name,
    kind: classifyScriptKind(name),
    command: ["npm", "run", name],
    raw_script: String(command ?? ""),
    cwd: repoRoot,
    package_path: packagePath,
    safety_level: classifyTaskSafety(name, command),
    env_policy: "inherit_redacted",
  };
}

function normalizeRunTask(task, repoRoot) {
  if (!task) {
    throw new Error("Run task is required.");
  }
  const command = Array.isArray(task.command) ? task.command.map(String) : ["npm", "run", String(task.script_name ?? task.name ?? task)];
  return {
    schema_version: DEV_RUNNER_SCHEMA_VERSION,
    task_id: String(task.task_id ?? command.join(":")),
    label: String(task.label ?? command.join(" ")),
    script_name: String(task.script_name ?? ""),
    kind: String(task.kind ?? "custom"),
    command,
    cwd: path.resolve(repoRoot, task.cwd ?? "."),
    safety_level: task.safety_level ?? classifyTaskSafety(task.script_name, task.raw_script ?? command.join(" ")),
    env_policy: task.env_policy ?? "inherit_redacted",
  };
}

async function runCommand(task, { spawnImpl, env }) {
  const startedAt = Date.now();
  return await new Promise((resolve) => {
    const child = spawnImpl(task.command[0], task.command.slice(1), {
      cwd: task.cwd,
      env: sanitizeEnv(env),
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
      const stderrPreview = redactOutput(error.message);
      resolve(toolRun(task, {
        status: "failed",
        exit_code: 1,
        stderr_preview: stderrPreview,
        diagnostics: parseDiagnosticsFromOutput({
          source: task.kind,
          output: stderrPreview,
        }).diagnostics,
        duration_ms: Date.now() - startedAt,
      }));
    });
    child.on("close", (code, signal) => {
      const stdoutPreview = redactOutput(stdout);
      const stderrPreview = redactOutput(stderr);
      resolve(toolRun(task, {
        status: code === 0 ? "completed" : "failed",
        exit_code: code ?? 1,
        signal: signal ?? null,
        stdout_preview: stdoutPreview,
        stderr_preview: stderrPreview,
        diagnostics: parseDiagnosticsFromOutput({
          source: task.kind,
          output: `${stdoutPreview}\n${stderrPreview}`,
        }).diagnostics,
        duration_ms: Date.now() - startedAt,
      }));
    });
  });
}

function toolRun(task, fields = {}) {
  return {
    schema_version: DEV_RUNNER_SCHEMA_VERSION,
    run_id: fields.run_id ?? `run-${Date.now().toString(36)}`,
    tool_id: task.task_id,
    label: task.label,
    status: fields.status,
    command_preview: previewCommand(task.command),
    started_at: new Date().toISOString(),
    completed_at: fields.status === "completed" || fields.status === "failed" ? new Date().toISOString() : "",
    exit_code: fields.exit_code ?? null,
    signal: fields.signal ?? null,
    stdout_preview: fields.stdout_preview ?? "",
    stderr_preview: fields.stderr_preview ?? "",
    diagnostics: fields.diagnostics ?? [],
    duration_ms: fields.duration_ms ?? 0,
    message: fields.message ?? "",
    redactions: [],
  };
}

function parseDiagnosticLine(line, source) {
  const text = String(line ?? "").trim();
  if (!text) return null;

  const tscMatch = text.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning|warn|info)\s+([A-Z]+[0-9]+)?:?\s*(.*)$/i);
  if (tscMatch) {
    return createDiagnostic({
      source,
      path: tscMatch[1],
      line: tscMatch[2],
      column: tscMatch[3],
      severity: tscMatch[4],
      code: tscMatch[5],
      message: tscMatch[6],
    });
  }

  const prettyMatch = text.match(/^(.+?):(\d+):(\d+)\s+-\s+(error|warning|warn|info)\s+([A-Z]+[0-9]+)?:?\s*(.*)$/i);
  if (prettyMatch) {
    return createDiagnostic({
      source,
      path: prettyMatch[1],
      line: prettyMatch[2],
      column: prettyMatch[3],
      severity: prettyMatch[4],
      code: prettyMatch[5],
      message: prettyMatch[6],
    });
  }

  const colonMatch = text.match(/^(.+?):(\d+):(\d+):\s*(error|warning|warn|info)\s*:?\s*(.*)$/i);
  if (colonMatch) {
    const parsed = splitTrailingRuleOrCode(colonMatch[5]);
    return createDiagnostic({
      source,
      path: colonMatch[1],
      line: colonMatch[2],
      column: colonMatch[3],
      severity: colonMatch[4],
      code: parsed.code,
      message: parsed.message,
    });
  }

  return null;
}

function createDiagnostic({ source, path: filePath, line, column, severity, code = "", message = "" }) {
  const normalizedLine = Number(line);
  const normalizedColumn = Number(column);
  return {
    schema_version: DEV_RUNNER_SCHEMA_VERSION,
    source,
    severity: normalizeSeverity(severity),
    path: normalizeDiagnosticPath(filePath),
    range: {
      start: { line: normalizedLine, column: normalizedColumn },
      end: { line: normalizedLine, column: normalizedColumn },
    },
    code: String(code ?? "").trim(),
    message: redactOutput(String(message ?? "").trim()),
  };
}

function normalizeSeverity(value) {
  const severity = String(value ?? "").toLowerCase();
  if (severity === "warn") return "warning";
  if (["error", "warning", "info"].includes(severity)) return severity;
  return "info";
}

function summarizeDiagnostics(diagnostics = []) {
  const summary = { error: 0, warning: 0, info: 0, hint: 0 };
  for (const diagnostic of diagnostics) {
    const severity = diagnostic.severity === "warn" ? "warning" : diagnostic.severity;
    if (Object.hasOwn(summary, severity)) {
      summary[severity] += 1;
    }
  }
  return summary;
}

function compareDiagnostics(left, right) {
  return severityRank(left.severity) - severityRank(right.severity) ||
    String(left.path ?? "").localeCompare(String(right.path ?? "")) ||
    Number(left.range?.start?.line ?? 0) - Number(right.range?.start?.line ?? 0) ||
    Number(left.range?.start?.column ?? 0) - Number(right.range?.start?.column ?? 0);
}

function severityRank(value) {
  const severity = String(value ?? "info");
  if (severity === "error") return 0;
  if (severity === "warning") return 1;
  if (severity === "warn") return 1;
  if (severity === "info") return 2;
  if (severity === "hint") return 3;
  return 4;
}

function normalizeDiagnosticPath(value) {
  return String(value ?? "").trim().replace(/\\/g, "/");
}

function splitTrailingRuleOrCode(value) {
  const text = String(value ?? "").trim();
  const ruleMatch = text.match(/^(.*)\s+(@?[a-z0-9_.-]+\/[a-z0-9_.-]+|[a-z0-9_.-]+\/[a-z0-9_.-]+)$/i);
  if (!ruleMatch) {
    return { message: text, code: "" };
  }
  return {
    message: ruleMatch[1].trim(),
    code: ruleMatch[2].trim(),
  };
}

function classifyScriptKind(name) {
  const value = String(name ?? "").toLowerCase();
  if (value.includes("test")) return "test";
  if (value.includes("lint")) return "lint";
  if (value.includes("type")) return "typecheck";
  if (value === "dev" || value.includes("server")) return "dev_server";
  return "custom";
}

function classifyTaskSafety(name, command) {
  const value = `${name ?? ""} ${command ?? ""}`.toLowerCase();
  if (/\b(rm\s+-rf|sudo|chmod|chown|drop\s+table|mkfs|dd\s+if=)\b/.test(value)) {
    return "denied";
  }
  if (/\b(install|add|deploy|publish|release|migrate|prisma\s+migrate)\b/.test(value)) {
    return "confirmation_required";
  }
  return "read_only";
}

function previewCommand(command = []) {
  return command.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function quotePathForCommand(filePath) {
  return /\s/.test(filePath) ? JSON.stringify(filePath) : filePath;
}

function sanitizeEnv(env = {}) {
  return { ...env };
}

function redactOutput(value) {
  return String(value ?? "")
    .replace(/(api[_-]?key|password|token)=\S+/gi, "$1=[redacted]")
    .replace(/sk-[a-z0-9_-]{12,}/gi, "[redacted]")
    .replace(/sk_[a-z0-9_-]{12,}/gi, "[redacted]")
    .slice(0, 8000);
}
