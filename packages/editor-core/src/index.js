import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export const EDITOR_BUFFER_SCHEMA_VERSION = 1;
const DEFAULT_MAX_FILE_BYTES = 1_000_000;
const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  ".heart/cache",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "vendor",
]);

export async function openFile({ repoRoot = process.cwd(), filePath, maxBytes = DEFAULT_MAX_FILE_BYTES } = {}) {
  const targetPath = resolveRepoPath(repoRoot, filePath);
  const stat = await fs.stat(targetPath);
  if (!stat.isFile()) {
    throw createEditorError("not_file", `Not a file: ${filePath}`);
  }
  if (stat.size > maxBytes) {
    throw createEditorError("file_too_large", `File is too large for workbench preview: ${filePath}`, {
      size: stat.size,
      max_bytes: maxBytes,
    });
  }
  const raw = await fs.readFile(targetPath);
  if (isBinaryBuffer(raw)) {
    throw createEditorError("binary_file", `Binary files are not opened in the IDE workbench: ${filePath}`);
  }
  const content = raw.toString("utf8");
  const relativePath = toRepoRelativePath(repoRoot, targetPath);
  const hash = hashContent(content);
  return {
    schema_version: EDITOR_BUFFER_SCHEMA_VERSION,
    buffer_id: `buffer:${relativePath}`,
    path: relativePath,
    language: inferLanguage(relativePath),
    content,
    saved_hash: hash,
    current_hash: hash,
    dirty: false,
    readonly: false,
    cursor: { line: 1, column: 1 },
    selection: null,
    version: 1,
    diagnostics: [],
  };
}

export async function saveFile({ repoRoot = process.cwd(), buffer, expectedHash, force = false } = {}) {
  if (!buffer?.path) {
    throw createEditorError("buffer_required", "A buffer with a repo-relative path is required.");
  }
  const targetPath = resolveRepoPath(repoRoot, buffer.path);
  const current = await fs.readFile(targetPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") {
      return "";
    }
    throw error;
  });
  const currentHash = hashContent(current);
  const requiredHash = expectedHash ?? buffer.saved_hash;
  if (!force && requiredHash && currentHash !== requiredHash) {
    return {
      schema_version: 1,
      status: "conflict",
      path: buffer.path,
      expected_hash: requiredHash,
      actual_hash: currentHash,
      message: "File changed after it was opened. Reopen before saving.",
    };
  }
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, String(buffer.content ?? ""), "utf8");
  const nextHash = hashContent(buffer.content ?? "");
  return {
    schema_version: 1,
    status: "saved",
    path: buffer.path,
    hash: nextHash,
  };
}

export function editBuffer(buffer, edit = {}) {
  const content = String(buffer?.content ?? "");
  const range = edit.range ?? null;
  const replacement = String(edit.text ?? "");
  const nextContent = range
    ? replaceRange(content, range, replacement)
    : `${content}${replacement}`;
  return {
    ...buffer,
    content: nextContent,
    current_hash: hashContent(nextContent),
    dirty: hashContent(nextContent) !== buffer.saved_hash,
    version: Number(buffer.version ?? 0) + 1,
    cursor: edit.cursor ?? buffer.cursor,
  };
}

export async function searchFiles({ repoRoot = process.cwd(), query = "", limit = 30, ignoreDirs = DEFAULT_IGNORE_DIRS } = {}) {
  const files = [];
  await walkRepo(repoRoot, repoRoot, files, normalizeIgnoreDirs(ignoreDirs));
  const queryTokens = tokenize(query);
  return files
    .map((relativePath) => ({
      path: relativePath,
      score: scoreFile(relativePath, queryTokens),
    }))
    .filter((entry) => queryTokens.length === 0 || entry.score > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, limit)
    .map((entry) => entry.path);
}

export async function openExternalEditor({ repoRoot = process.cwd(), filePath, editorCommand = process.env.EDITOR, spawnImpl = spawn } = {}) {
  const targetPath = resolveRepoPath(repoRoot, filePath);
  const before = await fs.readFile(targetPath, "utf8").catch(() => "");
  const beforeHash = hashContent(before);
  const command = parseEditorCommand(editorCommand);
  if (!command.executable) {
    throw createEditorError("editor_missing", "Set EDITOR or pass an editor command before using external editor fallback.");
  }
  const result = await runEditor(command, targetPath, { cwd: repoRoot, spawnImpl });
  const after = await fs.readFile(targetPath, "utf8").catch(() => "");
  const afterHash = hashContent(after);
  return {
    schema_version: 1,
    status: result.exit_code === 0 ? "closed" : "failed",
    path: toRepoRelativePath(repoRoot, targetPath),
    editor: command.executable,
    exit_code: result.exit_code,
    changed: beforeHash !== afterHash,
    before_hash: beforeHash,
    after_hash: afterHash,
  };
}

export function hashContent(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

export function resolveRepoPath(repoRoot, filePath) {
  const root = path.resolve(repoRoot);
  const target = path.resolve(root, String(filePath ?? ""));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw createEditorError("path_outside_repo", `Path is outside repo root: ${filePath}`);
  }
  return target;
}

function toRepoRelativePath(repoRoot, targetPath) {
  return path.relative(path.resolve(repoRoot), path.resolve(targetPath)).split(path.sep).join("/");
}

function replaceRange(content, range, replacement) {
  const start = offsetFromPosition(content, range.start);
  const end = offsetFromPosition(content, range.end);
  return `${content.slice(0, start)}${replacement}${content.slice(end)}`;
}

function offsetFromPosition(content, position = {}) {
  const line = Math.max(1, Number(position.line ?? 1));
  const column = Math.max(1, Number(position.column ?? 1));
  const lines = content.split("\n");
  let offset = 0;
  for (let index = 0; index < line - 1 && index < lines.length; index += 1) {
    offset += lines[index].length + 1;
  }
  return Math.min(content.length, offset + column - 1);
}

function isBinaryBuffer(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  return sample.includes(0);
}

function inferLanguage(filePath) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  const map = {
    js: "javascript",
    jsx: "javascriptreact",
    ts: "typescript",
    tsx: "typescriptreact",
    md: "markdown",
    mdx: "mdx",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    css: "css",
    html: "html",
  };
  return map[extension] ?? extension ?? "text";
}

async function walkRepo(root, current, files, ignoreDirs) {
  const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = toRepoRelativePath(root, absolutePath);
    if (entry.isDirectory()) {
      if (shouldIgnore(relativePath, ignoreDirs)) {
        continue;
      }
      await walkRepo(root, absolutePath, files, ignoreDirs);
      continue;
    }
    if (entry.isFile() && !shouldIgnore(relativePath, ignoreDirs)) {
      files.push(relativePath);
    }
  }
}

function shouldIgnore(relativePath, ignoreDirs) {
  return [...ignoreDirs].some((ignorePath) => relativePath === ignorePath || relativePath.startsWith(`${ignorePath}/`));
}

function normalizeIgnoreDirs(value) {
  if (value instanceof Set) {
    return value;
  }
  return new Set(Array.isArray(value) ? value : DEFAULT_IGNORE_DIRS);
}

function tokenize(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter(Boolean);
}

function scoreFile(relativePath, queryTokens) {
  if (queryTokens.length === 0) {
    return 1;
  }
  const haystack = relativePath.toLowerCase();
  const baseName = path.posix.basename(haystack);
  return queryTokens.reduce((score, token) => {
    if (baseName === token) {
      return score + 8;
    }
    if (baseName.includes(token)) {
      return score + 5;
    }
    if (haystack.includes(token)) {
      return score + 2;
    }
    return score;
  }, 0);
}

function parseEditorCommand(command) {
  const parts = String(command ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    executable: parts[0] ?? "",
    args: parts.slice(1),
  };
}

async function runEditor(command, targetPath, { cwd, spawnImpl }) {
  return await new Promise((resolve) => {
    const child = spawnImpl(command.executable, [...command.args, targetPath], {
      cwd,
      stdio: "inherit",
    });
    child.on("error", () => resolve({ exit_code: 1 }));
    child.on("close", (code) => resolve({ exit_code: code ?? 1 }));
  });
}

function createEditorError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}
