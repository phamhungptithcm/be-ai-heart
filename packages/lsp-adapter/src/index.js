import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LSP_ADAPTER_SCHEMA_VERSION = 1;

export const LSP_SERVER_PRESETS = Object.freeze({
  typescript: { command: "typescript-language-server", args: ["--stdio"], language_id: "typescript" },
  eslint: { command: "vscode-eslint-language-server", args: ["--stdio"], language_id: "javascript" },
  json: { command: "vscode-json-language-server", args: ["--stdio"], language_id: "json" },
  css: { command: "vscode-css-language-server", args: ["--stdio"], language_id: "css" },
  html: { command: "vscode-html-language-server", args: ["--stdio"], language_id: "html" },
  pyright: { command: "pyright-langserver", args: ["--stdio"], language_id: "python" },
  rust: { command: "rust-analyzer", args: [], language_id: "rust" },
  go: { command: "gopls", args: [], language_id: "go" },
  clangd: { command: "clangd", args: [], language_id: "cpp" },
});

export function parseLspDiagnosticsPayload({ repoRoot = process.cwd(), input = "", source = "lsp" } = {}) {
  const messages = parseLspMessages(input);
  const diagnostics = messages.flatMap((message) => {
    const params = extractPublishDiagnosticsParams(message);
    if (!params) return [];
    return normalizeLspDiagnostics({
      repoRoot,
      uri: params.uri,
      diagnostics: params.diagnostics,
      source,
    }).diagnostics;
  });

  return {
    schema_version: LSP_ADAPTER_SCHEMA_VERSION,
    source,
    format: "lsp",
    summary: summarizeDiagnostics(diagnostics),
    diagnostics,
  };
}

export function normalizeLspDiagnostics({ repoRoot = process.cwd(), uri = "", diagnostics = [], source = "lsp" } = {}) {
  const filePath = normalizeLspUriPath({ repoRoot, uri });
  const normalized = (diagnostics ?? []).map((diagnostic) => ({
    schema_version: LSP_ADAPTER_SCHEMA_VERSION,
    source: String(diagnostic.source ?? source),
    severity: normalizeSeverity(diagnostic.severity),
    path: filePath,
    range: normalizeRange(diagnostic.range),
    code: diagnostic.code === undefined || diagnostic.code === null ? "" : String(diagnostic.code),
    message: redactDiagnosticMessage(diagnostic.message),
  }));

  return {
    schema_version: LSP_ADAPTER_SCHEMA_VERSION,
    source,
    format: "lsp",
    summary: summarizeDiagnostics(normalized),
    diagnostics: normalized,
  };
}

export function summarizeDiagnostics(diagnostics = []) {
  const summary = { error: 0, warning: 0, info: 0, hint: 0 };
  for (const diagnostic of diagnostics) {
    const severity = diagnostic.severity === "warn" ? "warning" : diagnostic.severity;
    if (Object.hasOwn(summary, severity)) {
      summary[severity] += 1;
    }
  }
  return summary;
}

export async function probeLspServer({
  repoRoot = process.cwd(),
  server,
  command,
  args = [],
  allowedCommands,
  timeoutMs = 2000,
  spawnImpl = spawn,
  env = process.env,
  clientCapabilities = {},
} = {}) {
  const startedAt = Date.now();
  const resolved = resolveLspServer({ server, command, args });
  const allowed = isAllowedLspCommand(resolved.command, allowedCommands);
  if (!resolved.command || !allowed.ok) {
    return {
      schema_version: LSP_ADAPTER_SCHEMA_VERSION,
      status: "denied",
      server: resolved,
      message: allowed.message ?? "Unsupported LSP server preset. Use a built-in server preset.",
      duration_ms: Date.now() - startedAt,
    };
  }

  let child;
  try {
    child = spawnImpl(resolved.command, resolved.args, {
      cwd: path.resolve(repoRoot),
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    return {
      schema_version: LSP_ADAPTER_SCHEMA_VERSION,
      status: "failed",
      server: resolved,
      message: redactDiagnosticMessage(error?.message ?? error),
      duration_ms: Date.now() - startedAt,
    };
  }

  return await new Promise((resolve) => {
    let settled = false;
    let buffer = "";
    let stderr = "";
    const requestId = 1;
    const timeout = setTimeout(() => finish({
      status: "timeout",
      message: `LSP initialize timed out after ${timeoutMs}ms.`,
    }), timeoutMs);

    const finish = (fields) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanupLspChild(child);
      resolve({
        schema_version: LSP_ADAPTER_SCHEMA_VERSION,
        status: fields.status,
        server: resolved,
        capabilities: fields.capabilities ?? {},
        capabilities_summary: summarizeCapabilities(fields.capabilities ?? {}),
        message: fields.message ?? "",
        stderr_preview: redactDiagnosticMessage(stderr).slice(0, 2000),
        duration_ms: Date.now() - startedAt,
      });
    };

    child.stdout?.on("data", (chunk) => {
      buffer += chunk.toString();
      const parsed = readLspMessagesFromBuffer(buffer);
      buffer = parsed.remaining;
      for (const message of parsed.messages) {
        if (message.id !== requestId) continue;
        if (message.error) {
          finish({
            status: "failed",
            message: redactDiagnosticMessage(message.error.message ?? "LSP initialize failed."),
          });
          return;
        }
        finish({
          status: "ready",
          capabilities: message.result?.capabilities ?? {},
        });
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on?.("error", (error) => {
      finish({
        status: "failed",
        message: redactDiagnosticMessage(error?.message ?? error),
      });
    });
    child.on?.("close", (code, signal) => {
      if (settled) return;
      finish({
        status: "failed",
        message: `LSP server exited before initialize completed (${signal ?? code ?? "unknown"}).`,
      });
    });

    child.stdin?.write(encodeLspMessage({
      jsonrpc: "2.0",
      id: requestId,
      method: "initialize",
      params: {
        processId: process.pid,
        rootUri: pathToFileUri(path.resolve(repoRoot)),
        capabilities: clientCapabilities,
        workspaceFolders: [{
          uri: pathToFileUri(path.resolve(repoRoot)),
          name: path.basename(path.resolve(repoRoot)),
        }],
      },
    }));
  });
}

export function createLspSession(options = {}) {
  return new LspSession(options);
}

class LspSession {
  constructor({
    repoRoot = process.cwd(),
    server,
    command,
    args = [],
    allowedCommands,
    timeoutMs = 3000,
    spawnImpl = spawn,
    env = process.env,
    clientCapabilities = {},
  } = {}) {
    this.repoRoot = path.resolve(repoRoot);
    this.server = resolveLspServer({ server, command, args });
    this.allowed = isAllowedLspCommand(this.server.command, allowedCommands);
    this.timeoutMs = timeoutMs;
    this.spawnImpl = spawnImpl;
    this.env = env;
    this.clientCapabilities = clientCapabilities;
    this.child = null;
    this.state = "idle";
    this.startedAt = Date.now();
    this.nextRequestId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.stderr = "";
    this.capabilities = {};
    this.documents = new Map();
    this.diagnosticsByUri = new Map();
    this.initializedNotificationSent = false;
  }

  async initialize({ timeoutMs = this.timeoutMs, clientCapabilities = this.clientCapabilities } = {}) {
    if (!this.server.command || !this.allowed.ok) {
      this.state = "denied";
      return this.#result({
        status: "denied",
        message: this.allowed.message ?? "Unsupported LSP server preset. Use a built-in server preset.",
      });
    }
    if (this.state === "ready") {
      return this.#result({ status: "ready" });
    }

    try {
      this.child = this.spawnImpl(this.server.command, this.server.args, {
        cwd: this.repoRoot,
        env: this.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      this.state = "failed";
      return this.#result({
        status: "failed",
        message: redactDiagnosticMessage(error?.message ?? error),
      });
    }

    this.state = "initializing";
    this.#attachChildHandlers();
    const requestId = this.nextRequestId++;
    const result = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        this.state = "timeout";
        cleanupLspChild(this.child);
        resolve(this.#result({
          status: "timeout",
          message: `LSP initialize timed out after ${timeoutMs}ms.`,
        }));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, timeout });
      this.#write({
        jsonrpc: "2.0",
        id: requestId,
        method: "initialize",
        params: {
          processId: process.pid,
          rootUri: pathToFileUri(this.repoRoot),
          capabilities: mergeClientCapabilities(clientCapabilities),
          workspaceFolders: [{
            uri: pathToFileUri(this.repoRoot),
            name: path.basename(this.repoRoot),
          }],
        },
      });
    });

    if (result.status === "ready") {
      this.#sendInitialized();
    }
    return result;
  }

  async openDocument({ filePath, content, languageId } = {}) {
    if (this.state !== "ready") {
      const initialized = await this.initialize();
      if (initialized.status !== "ready") return initialized;
    }
    const document = await resolveLspTextDocument({
      repoRoot: this.repoRoot,
      filePath,
      content,
      languageId: languageId ?? this.server.language_id,
    });
    document.version = 1;
    this.documents.set(document.path, document);
    this.#write({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: document.uri,
          languageId: document.languageId,
          version: document.version,
          text: document.text,
        },
      },
    });
    return {
      schema_version: LSP_ADAPTER_SCHEMA_VERSION,
      status: "opened",
      path: document.path,
      uri: document.uri,
      language_id: document.languageId,
      version: document.version,
    };
  }

  async changeDocument({ filePath, text, languageId } = {}) {
    if (this.state !== "ready") {
      const initialized = await this.initialize();
      if (initialized.status !== "ready") return initialized;
    }
    const requestedPath = normalizeRepoRelativePath(this.repoRoot, filePath);
    let document = this.documents.get(requestedPath);
    if (!document) {
      await this.openDocument({ filePath, languageId });
      document = this.documents.get(requestedPath);
    }
    document.version += 1;
    document.text = String(text ?? "");
    this.#write({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        textDocument: {
          uri: document.uri,
          version: document.version,
        },
        contentChanges: [{ text: document.text }],
      },
    });
    return {
      schema_version: LSP_ADAPTER_SCHEMA_VERSION,
      status: "changed",
      path: document.path,
      uri: document.uri,
      version: document.version,
    };
  }

  async waitForDiagnostics({ timeoutMs = 1500 } = {}) {
    await wait(Math.max(1, Number(timeoutMs)));
    const diagnostics = this.#diagnostics();
    return {
      schema_version: LSP_ADAPTER_SCHEMA_VERSION,
      status: this.state === "closed" ? "closed" : "completed",
      server: this.server,
      capabilities: this.capabilities,
      capabilities_summary: summarizeCapabilities(this.capabilities),
      summary: summarizeDiagnostics(diagnostics),
      diagnostics,
      navigation: buildLspDiagnosticsNavigation(diagnostics),
      stderr_preview: redactDiagnosticMessage(this.stderr).slice(0, 2000),
      duration_ms: Date.now() - this.startedAt,
    };
  }

  async shutdown() {
    cleanupLspChild(this.child);
    this.state = "closed";
    return this.#result({ status: "closed" });
  }

  #attachChildHandlers() {
    this.child.stdout?.on("data", (chunk) => {
      this.buffer += chunk.toString();
      const parsed = readLspMessagesFromBuffer(this.buffer);
      this.buffer = parsed.remaining;
      for (const message of parsed.messages) {
        this.#handleMessage(message);
      }
    });
    this.child.stderr?.on("data", (chunk) => {
      this.stderr += chunk.toString();
    });
    this.child.on?.("error", (error) => {
      this.state = "failed";
      this.#failPending(redactDiagnosticMessage(error?.message ?? error));
    });
    this.child.on?.("close", (code, signal) => {
      if (this.state === "closed" || this.state === "timeout") return;
      this.state = this.state === "ready" ? "closed" : "failed";
      this.#failPending(`LSP server exited before initialize completed (${signal ?? code ?? "unknown"}).`);
    });
  }

  #handleMessage(message) {
    if (message?.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) {
        this.state = "failed";
        pending.resolve(this.#result({
          status: "failed",
          message: redactDiagnosticMessage(message.error.message ?? "LSP initialize failed."),
        }));
        return;
      }
      this.state = "ready";
      this.capabilities = message.result?.capabilities ?? {};
      pending.resolve(this.#result({ status: "ready" }));
      return;
    }

    const params = extractPublishDiagnosticsParams(message);
    if (!params) return;
    const normalized = normalizeLspDiagnostics({
      repoRoot: this.repoRoot,
      uri: params.uri,
      diagnostics: params.diagnostics,
      source: this.server.server_id || "lsp",
    });
    this.diagnosticsByUri.set(params.uri, normalized.diagnostics);
  }

  #failPending(message) {
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.resolve(this.#result({ status: "failed", message }));
      this.pending.delete(requestId);
    }
  }

  #sendInitialized() {
    if (this.initializedNotificationSent) return;
    this.initializedNotificationSent = true;
    this.#write({ jsonrpc: "2.0", method: "initialized", params: {} });
  }

  #write(message) {
    this.child?.stdin?.write?.(encodeLspMessage(message));
  }

  #diagnostics() {
    return [...this.diagnosticsByUri.values()].flat();
  }

  #result(fields = {}) {
    return {
      schema_version: LSP_ADAPTER_SCHEMA_VERSION,
      status: fields.status,
      server: this.server,
      capabilities: this.capabilities,
      capabilities_summary: summarizeCapabilities(this.capabilities),
      message: fields.message ?? "",
      stderr_preview: redactDiagnosticMessage(this.stderr).slice(0, 2000),
      duration_ms: Date.now() - this.startedAt,
    };
  }
}

export async function collectLspDiagnosticsStream({
  repoRoot = process.cwd(),
  server,
  command,
  args = [],
  allowedCommands,
  filePath,
  content,
  changes = [],
  languageId,
  timeoutMs = 3000,
  diagnosticTimeoutMs = 1500,
  spawnImpl = spawn,
  env = process.env,
  clientCapabilities = {},
} = {}) {
  const startedAt = Date.now();
  const session = createLspSession({
    repoRoot,
    server,
    command,
    args,
    allowedCommands,
    timeoutMs,
    spawnImpl,
    env,
    clientCapabilities,
  });
  const initialized = await session.initialize({ timeoutMs, clientCapabilities });
  if (initialized.status !== "ready") {
    return {
      ...initialized,
      diagnostics: [],
      summary: summarizeDiagnostics([]),
      navigation: buildLspDiagnosticsNavigation([]),
      duration_ms: Date.now() - startedAt,
    };
  }

  let opened;
  try {
    opened = await session.openDocument({
      filePath,
      content,
      languageId,
    });
    for (const change of normalizeLspChanges(changes)) {
      await session.changeDocument({ filePath, text: change.text, languageId });
    }
  } catch (error) {
    await session.shutdown();
    return {
      schema_version: LSP_ADAPTER_SCHEMA_VERSION,
      status: "failed",
      server: initialized.server,
      message: redactDiagnosticMessage(error?.message ?? error),
      diagnostics: [],
      summary: summarizeDiagnostics([]),
      navigation: buildLspDiagnosticsNavigation([]),
      duration_ms: Date.now() - startedAt,
    };
  }

  const result = await session.waitForDiagnostics({ timeoutMs: diagnosticTimeoutMs });
  await session.shutdown();
  return {
    ...result,
    status: result.status === "closed" ? "completed" : result.status,
    opened_file: opened.path,
    language_id: opened.language_id,
    change_count: normalizeLspChanges(changes).length,
    duration_ms: Date.now() - startedAt,
  };
}

export function resolveLspServer({ server, command, args = [] } = {}) {
  if (command) {
    return {
      server_id: server || path.basename(String(command)),
      command: String(command),
      args: (args ?? []).map(String),
      command_preview: previewCommand([String(command), ...(args ?? []).map(String)]),
      preset: false,
    };
  }
  const presetId = String(server ?? "typescript").trim().toLowerCase();
  const preset = LSP_SERVER_PRESETS[presetId];
  if (!preset) {
    return {
      server_id: presetId,
      command: "",
      args: [],
      command_preview: "",
      preset: false,
    };
  }
  return {
    server_id: presetId,
    command: preset.command,
    args: preset.args,
    language_id: preset.language_id,
    command_preview: previewCommand([preset.command, ...preset.args]),
    preset: true,
  };
}

export function encodeLspMessage(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

export function parseLspMessages(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") return [input];
  const text = String(input ?? "").trim();
  if (!text) return [];

  const contentLengthMessages = parseContentLengthMessages(text);
  if (contentLengthMessages.length > 0) return contentLengthMessages;

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const parsed = JSON.parse(line);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [];
        }
      });
  }
}

function parseContentLengthMessages(text) {
  const messages = [];
  let cursor = 0;
  while (cursor < text.length) {
    const headerMatch = text.slice(cursor).match(/^Content-Length:\s*(\d+)\r?\n\r?\n/i);
    if (!headerMatch) break;
    const headerLength = headerMatch[0].length;
    const bodyLength = Number(headerMatch[1]);
    const bodyStart = cursor + headerLength;
    const body = text.slice(bodyStart, bodyStart + bodyLength);
    if (body.length < bodyLength) break;
    try {
      messages.push(JSON.parse(body));
    } catch {
      break;
    }
    cursor = bodyStart + bodyLength;
    while (text[cursor] === "\r" || text[cursor] === "\n") cursor += 1;
  }
  return messages;
}

function readLspMessagesFromBuffer(buffer) {
  const messages = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const headerMatch = buffer.slice(cursor).match(/^Content-Length:\s*(\d+)\r?\n\r?\n/i);
    if (!headerMatch) break;
    const headerLength = headerMatch[0].length;
    const bodyLength = Number(headerMatch[1]);
    const bodyStart = cursor + headerLength;
    const bodyEnd = bodyStart + bodyLength;
    if (buffer.length < bodyEnd) break;
    try {
      messages.push(JSON.parse(buffer.slice(bodyStart, bodyEnd)));
    } catch {
      break;
    }
    cursor = bodyEnd;
    while (buffer[cursor] === "\r" || buffer[cursor] === "\n") cursor += 1;
  }
  return {
    messages,
    remaining: buffer.slice(cursor),
  };
}

function extractPublishDiagnosticsParams(message) {
  if (!message || typeof message !== "object") return null;
  if (message.method === "textDocument/publishDiagnostics" && message.params?.diagnostics) {
    return message.params;
  }
  if (message.uri && Array.isArray(message.diagnostics)) {
    return message;
  }
  if (message.params?.uri && Array.isArray(message.params?.diagnostics)) {
    return message.params;
  }
  return null;
}

function normalizeLspUriPath({ repoRoot, uri }) {
  const root = path.resolve(repoRoot);
  let absolutePath = "";
  try {
    absolutePath = String(uri ?? "").startsWith("file://") ? fileURLToPath(uri) : path.resolve(root, String(uri ?? ""));
  } catch {
    absolutePath = path.resolve(root, String(uri ?? ""));
  }

  const relativePath = path.relative(root, absolutePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return `[external]/${path.basename(absolutePath)}`;
  }
  return relativePath.split(path.sep).join("/");
}

function normalizeRange(range = {}) {
  const start = range.start ?? {};
  const end = range.end ?? start;
  return {
    start: {
      line: Number(start.line ?? 0) + 1,
      column: Number(start.character ?? 0) + 1,
    },
    end: {
      line: Number(end.line ?? start.line ?? 0) + 1,
      column: Number(end.character ?? start.character ?? 0) + 1,
    },
  };
}

function normalizeSeverity(value) {
  if (value === 1) return "error";
  if (value === 2) return "warning";
  if (value === 3) return "info";
  if (value === 4) return "hint";
  const severity = String(value ?? "").toLowerCase();
  if (severity === "warn") return "warning";
  if (["error", "warning", "info", "hint"].includes(severity)) return severity;
  return "info";
}

async function resolveLspTextDocument({ repoRoot, filePath, content, languageId } = {}) {
  const root = path.resolve(repoRoot);
  const requestedPath = String(filePath ?? "").trim();
  if (!requestedPath) {
    throw new Error("LSP diagnostics require a repo-relative file path.");
  }
  if (requestedPath.startsWith("-")) {
    throw new Error(`LSP file path looks like an option: ${requestedPath}`);
  }
  const absolutePath = path.resolve(root, requestedPath);
  const relativePath = path.relative(root, absolutePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`LSP file path must stay inside repo root: ${requestedPath}`);
  }
  const text = content === undefined || content === null
    ? await fs.readFile(absolutePath, "utf8")
    : String(content);
  return {
    path: relativePath.split(path.sep).join("/"),
    absolutePath,
    uri: pathToFileUri(absolutePath),
    languageId: String(languageId || inferLanguageId(absolutePath)),
    text,
  };
}

function normalizeLspChanges(changes = []) {
  return (changes ?? [])
    .map((change) => {
      if (typeof change === "string") return { text: change };
      return { text: String(change?.text ?? "") };
    })
    .filter((change) => change.text.length > 0);
}

function normalizeRepoRelativePath(repoRoot, filePath) {
  const root = path.resolve(repoRoot);
  const absolutePath = path.resolve(root, String(filePath ?? ""));
  const relativePath = path.relative(root, absolutePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`LSP file path must stay inside repo root: ${filePath}`);
  }
  return relativePath.split(path.sep).join("/");
}

function mergeClientCapabilities(clientCapabilities = {}) {
  return {
    ...clientCapabilities,
    textDocument: {
      publishDiagnostics: {
        relatedInformation: true,
      },
      synchronization: {
        didSave: false,
        dynamicRegistration: false,
      },
      ...(clientCapabilities.textDocument ?? {}),
    },
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLspDiagnosticsNavigation(diagnostics = [], limit = 50) {
  const items = (diagnostics ?? [])
    .slice()
    .sort(compareDiagnostics)
    .slice(0, limit)
    .map((diagnostic, index) => {
      const line = Number(diagnostic.range?.start?.line ?? 0);
      const column = Number(diagnostic.range?.start?.column ?? 0);
      const code = String(diagnostic.code ?? "").trim();
      const filePath = String(diagnostic.path ?? "(unknown)");
      const severity = String(diagnostic.severity ?? "info");
      return {
        key: String(index + 1),
        severity,
        path: filePath,
        line,
        column,
        code,
        label: [
          `${filePath}:${line}:${column}`,
          severity,
          code,
          String(diagnostic.message ?? "").trim(),
        ].filter(Boolean).join(" "),
        command: `heart ide open ${quotePathForCommand(filePath)}`,
      };
    });
  return {
    schema_version: LSP_ADAPTER_SCHEMA_VERSION,
    summary: summarizeDiagnostics(diagnostics),
    items,
    next_actions: items.length > 0
      ? [`heart ide open ${quotePathForCommand(items[0].path)}`]
      : ["No diagnostics to navigate."],
  };
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
  if (severity === "warning" || severity === "warn") return 1;
  if (severity === "info") return 2;
  if (severity === "hint") return 3;
  return 4;
}

function inferLanguageId(filePath) {
  const extension = path.extname(String(filePath ?? "")).toLowerCase();
  const byExtension = {
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".jsx": "javascriptreact",
    ".json": "json",
    ".css": "css",
    ".html": "html",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".c": "c",
    ".cc": "cpp",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
  };
  return byExtension[extension] ?? (extension.replace(/^\./, "") || "plaintext");
}

function summarizeCapabilities(capabilities = {}) {
  return {
    text_document_sync: Boolean(capabilities.textDocumentSync),
    completion_provider: Boolean(capabilities.completionProvider),
    hover_provider: Boolean(capabilities.hoverProvider),
    definition_provider: Boolean(capabilities.definitionProvider),
    code_action_provider: Boolean(capabilities.codeActionProvider),
    diagnostic_provider: Boolean(capabilities.diagnosticProvider),
    document_formatting_provider: Boolean(capabilities.documentFormattingProvider),
    workspace_symbol_provider: Boolean(capabilities.workspaceSymbolProvider),
  };
}

function isAllowedLspCommand(command, allowedCommands) {
  const value = String(command ?? "").trim();
  if (!value) {
    return { ok: false, message: "No LSP command resolved." };
  }
  if (value.startsWith("-") || /[;&|`$<>]/.test(value)) {
    return { ok: false, message: "LSP command failed safety validation." };
  }
  const defaultAllowed = new Set(Object.values(LSP_SERVER_PRESETS).map((preset) => preset.command));
  const callerAllowed = new Set((allowedCommands ?? []).map(String));
  const basename = path.basename(value);
  if (defaultAllowed.has(value) || defaultAllowed.has(basename) || callerAllowed.has(value) || callerAllowed.has(basename)) {
    return { ok: true };
  }
  return { ok: false, message: "LSP command is not in the allowlist." };
}

function cleanupLspChild(child) {
  try {
    child?.stdin?.write?.(encodeLspMessage({ jsonrpc: "2.0", id: 2, method: "shutdown" }));
    child?.stdin?.write?.(encodeLspMessage({ jsonrpc: "2.0", method: "exit" }));
    child?.stdin?.end?.();
  } catch {
    // Best-effort cleanup only.
  }
  try {
    child?.kill?.("SIGTERM");
  } catch {
    // Best-effort cleanup only.
  }
}

function pathToFileUri(filePath) {
  const resolved = path.resolve(filePath).split(path.sep).map(encodeURIComponent).join("/");
  return `file://${resolved.startsWith("/") ? "" : "/"}${resolved}`;
}

function previewCommand(command = []) {
  return command.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function quotePathForCommand(filePath) {
  return /\s/.test(filePath) ? JSON.stringify(filePath) : filePath;
}

function redactDiagnosticMessage(value) {
  return String(value ?? "")
    .replace(/(api[_-]?key|password|token)=\S+/gi, "$1=[redacted]")
    .replace(/sk-[a-z0-9_-]{12,}/gi, "[redacted]")
    .replace(/sk_[a-z0-9_-]{12,}/gi, "[redacted]");
}
