import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import {
  editBuffer,
  openFile,
  saveFile,
  searchFiles,
} from "../packages/editor-core/src/index.js";
import {
  applyPatchWithConfirmation,
  generatePatch,
  previewPatch,
  rollbackAiPatch,
} from "../packages/diff-engine/src/index.js";
import {
  buildDiagnosticsNavigation,
  discoverPackageScripts,
  parseDiagnosticsFromOutput,
  runProjectTask,
} from "../packages/dev-runner/src/index.js";
import {
  generateCommitSummary,
  buildGitStagePicker,
  getGitDiff,
  getGitReview,
  getGitStatus,
  selectGitStagePickerChoices,
  stageSelectedFiles,
  unstageSelectedFiles,
} from "../packages/git-workflow/src/index.js";
import {
  collectLspDiagnosticsStream,
  createLspSession,
  encodeLspMessage,
  parseLspMessages,
  parseLspDiagnosticsPayload,
  probeLspServer,
} from "../packages/lsp-adapter/src/index.js";
import {
  acceptSuggestionLine,
  collectEditContext,
  rejectSuggestion,
  requestInlineSuggestion,
} from "../packages/ai-suggestions/src/index.js";
import { openCommandPalette } from "../packages/cli-workbench/src/index.js";

async function createRepo() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-ide-mvp-"));
  await fs.mkdir(path.join(repoRoot, "src"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, "src", "index.js"), "export const value = 1;\n", "utf8");
  await fs.writeFile(path.join(repoRoot, "package.json"), JSON.stringify({
    scripts: {
      test: "node --version",
      lint: "eslint .",
      deploy: "echo deploy",
      unsafe: "rm -rf .",
    },
  }, null, 2), "utf8");
  return repoRoot;
}

test("editor core opens, edits, saves, and searches files safely", async () => {
  const repoRoot = await createRepo();
  const buffer = await openFile({ repoRoot, filePath: "src/index.js" });
  assert.equal(buffer.path, "src/index.js");

  const edited = editBuffer(buffer, {
    range: { start: { line: 1, column: 22 }, end: { line: 1, column: 22 } },
    text: "\nexport const two = 2;",
  });
  assert.equal(edited.dirty, true);
  const saveResult = await saveFile({ repoRoot, buffer: edited });
  assert.equal(saveResult.status, "saved");

  const files = await searchFiles({ repoRoot, query: "index" });
  assert.deepEqual(files, ["src/index.js"]);

  await assert.rejects(() => openFile({ repoRoot, filePath: "../outside.js" }), /outside repo root/);
});

test("diff engine previews, confirms, applies, and rolls back AI patches", async () => {
  const repoRoot = await createRepo();
  const proposal = generatePatch({
    files: [{
      path: "src/index.js",
      new_content: "export const value = 2;\n",
    }],
  });
  const preview = await previewPatch({ repoRoot, proposal });
  assert.equal(preview.status, "pending");
  assert.match(preview.hunks[0].diff, /\+export const value = 2;/);

  const blocked = await applyPatchWithConfirmation({ repoRoot, preview, confirmed: false });
  assert.equal(blocked.status, "needs_confirmation");

  const applied = await applyPatchWithConfirmation({ repoRoot, preview, confirmed: true });
  assert.equal(applied.status, "applied");
  assert.equal(await fs.readFile(path.join(repoRoot, "src", "index.js"), "utf8"), "export const value = 2;\n");

  const rolledBack = await rollbackAiPatch({ repoRoot, rollbackId: applied.rollback_id });
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(await fs.readFile(path.join(repoRoot, "src", "index.js"), "utf8"), "export const value = 1;\n");
});

test("dev runner discovers scripts and blocks unsafe commands", async () => {
  const repoRoot = await createRepo();
  const discovery = await discoverPackageScripts({ repoRoot });
  assert.ok(discovery.scripts.some((entry) => entry.script_name === "test"));
  assert.equal(discovery.scripts.find((entry) => entry.script_name === "unsafe").safety_level, "denied");

  const denied = await runProjectTask({
    repoRoot,
    task: discovery.scripts.find((entry) => entry.script_name === "unsafe"),
  });
  assert.equal(denied.status, "denied");
});

test("diagnostics parser extracts TypeScript and eslint-style diagnostics", () => {
  const parsed = parseDiagnosticsFromOutput({
    source: "typecheck",
    output: [
      "src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/lint.ts:4:7: warning Missing return type @typescript-eslint/explicit-function-return-type",
    ].join("\n"),
  });

  assert.equal(parsed.schema_version, 1);
  assert.equal(parsed.diagnostics.length, 2);
  assert.deepEqual(parsed.diagnostics[0], {
    schema_version: 1,
    source: "typecheck",
    severity: "error",
    path: "src/index.ts",
    range: {
      start: { line: 10, column: 5 },
      end: { line: 10, column: 5 },
    },
    code: "TS2322",
    message: "Type 'string' is not assignable to type 'number'.",
  });
  assert.equal(parsed.diagnostics[1].severity, "warning");
  assert.equal(parsed.diagnostics[1].path, "src/lint.ts");
});

test("diagnostics navigation builds stable jump targets", () => {
  const parsed = parseDiagnosticsFromOutput({
    source: "typecheck",
    output: [
      "src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/lint.ts:4:7: warning Missing return type @typescript-eslint/explicit-function-return-type",
    ].join("\n"),
  });
  const navigation = buildDiagnosticsNavigation({ diagnostics: parsed.diagnostics });

  assert.equal(navigation.schema_version, 1);
  assert.deepEqual(navigation.summary, { error: 1, warning: 1, info: 0, hint: 0 });
  assert.deepEqual(navigation.items[0], {
    key: "1",
    severity: "error",
    path: "src/index.ts",
    line: 10,
    column: 5,
    code: "TS2322",
    label: "src/index.ts:10:5 error TS2322 Type 'string' is not assignable to type 'number'.",
    command: "heart ide open src/index.ts",
  });
});

test("LSP adapter normalizes publishDiagnostics payloads into workbench diagnostics", async () => {
  const repoRoot = await createRepo();
  const payload = {
    jsonrpc: "2.0",
    method: "textDocument/publishDiagnostics",
    params: {
      uri: `file://${repoRoot}/src/index.ts`,
      diagnostics: [{
        range: {
          start: { line: 2, character: 4 },
          end: { line: 2, character: 12 },
        },
        severity: 1,
        code: "TS2322",
        source: "tsserver",
        message: "Type 'string' is not assignable to type 'number'.",
      }],
    },
  };

  const parsed = parseLspDiagnosticsPayload({ repoRoot, input: JSON.stringify(payload) });
  assert.equal(parsed.source, "lsp");
  assert.deepEqual(parsed.summary, { error: 1, warning: 0, info: 0, hint: 0 });
  assert.deepEqual(parsed.diagnostics[0], {
    schema_version: 1,
    source: "tsserver",
    severity: "error",
    path: "src/index.ts",
    range: {
      start: { line: 3, column: 5 },
      end: { line: 3, column: 13 },
    },
    code: "TS2322",
    message: "Type 'string' is not assignable to type 'number'.",
  });
});

test("LSP adapter probes initialize capabilities and enforces timeout", async () => {
  const repoRoot = await createRepo();
  const ready = await probeLspServer({
    repoRoot,
    command: "mock-lsp",
    allowedCommands: ["mock-lsp"],
    timeoutMs: 200,
    spawnImpl: createMockLspSpawn({
      capabilities: {
        textDocumentSync: 1,
        completionProvider: { triggerCharacters: ["."] },
        hoverProvider: true,
      },
    }),
  });

  assert.equal(ready.status, "ready");
  assert.equal(ready.capabilities_summary.completion_provider, true);
  assert.equal(ready.capabilities_summary.hover_provider, true);

  const timedOut = await probeLspServer({
    repoRoot,
    command: "mock-lsp",
    allowedCommands: ["mock-lsp"],
    timeoutMs: 10,
    spawnImpl: createMockLspSpawn({ respond: false }),
  });
  assert.equal(timedOut.status, "timeout");
});

test("LSP adapter opens and changes a document while streaming diagnostics", async () => {
  const repoRoot = await createRepo();
  const result = await collectLspDiagnosticsStream({
    repoRoot,
    command: "mock-lsp",
    allowedCommands: ["mock-lsp"],
    filePath: "src/index.js",
    changes: [{ text: "export const value = 'bad';\n" }],
    timeoutMs: 200,
    diagnosticTimeoutMs: 20,
    spawnImpl: createMockLspSpawn({
      capabilities: { textDocumentSync: 2, diagnosticProvider: true },
      diagnosticsOnChange: [{
        range: {
          start: { line: 0, character: 21 },
          end: { line: 0, character: 26 },
        },
        severity: 1,
        code: "mock-type",
        source: "mock-lsp",
        message: "Type mismatch.",
      }],
    }),
  });

  assert.equal(result.status, "completed");
  assert.equal(result.opened_file, "src/index.js");
  assert.equal(result.change_count, 1);
  assert.equal(result.capabilities_summary.diagnostic_provider, true);
  assert.deepEqual(result.summary, { error: 1, warning: 0, info: 0, hint: 0 });
  assert.equal(result.diagnostics[0].path, "src/index.js");
  assert.equal(result.diagnostics[0].code, "mock-type");
});

test("LSP session manager reuses one process for open, change, and diagnostics", async () => {
  const repoRoot = await createRepo();
  const spawnCalls = [];
  const session = createLspSession({
    repoRoot,
    command: "mock-lsp",
    allowedCommands: ["mock-lsp"],
    timeoutMs: 200,
    spawnImpl: createMockLspSpawn({
      onSpawn: (command, args) => spawnCalls.push([command, ...args]),
      capabilities: { textDocumentSync: 2, diagnosticProvider: true },
      diagnosticsOnOpen: [{
        range: {
          start: { line: 0, character: 13 },
          end: { line: 0, character: 18 },
        },
        severity: 2,
        code: "mock-open",
        source: "mock-lsp",
        message: "Open warning.",
      }],
      diagnosticsOnChange: [{
        range: {
          start: { line: 0, character: 21 },
          end: { line: 0, character: 26 },
        },
        severity: 1,
        code: "mock-change",
        source: "mock-lsp",
        message: "Change error.",
      }],
    }),
  });

  const initialized = await session.initialize();
  assert.equal(initialized.status, "ready");
  await session.openDocument({ filePath: "src/index.js" });
  let diagnostics = await session.waitForDiagnostics({ timeoutMs: 20 });
  assert.equal(diagnostics.summary.warning, 1);

  await session.changeDocument({ filePath: "src/index.js", text: "export const value = 'bad';\n" });
  diagnostics = await session.waitForDiagnostics({ timeoutMs: 20 });
  assert.equal(diagnostics.summary.error, 1);
  assert.equal(diagnostics.navigation.items[0].path, "src/index.js");

  const closed = await session.shutdown();
  assert.equal(closed.status, "closed");
  assert.equal(spawnCalls.length, 1);
});

test("git workflow stages selected files only after confirmation", async () => {
  const repoRoot = await createRepo();
  execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });

  await fs.writeFile(path.join(repoRoot, "src", "index.js"), "export const value = 2;\n", "utf8");

  const blocked = await stageSelectedFiles({ repoRoot, files: ["src/index.js"], confirmed: false });
  assert.equal(blocked.status, "needs_confirmation");

  const staged = await stageSelectedFiles({ repoRoot, files: ["src/index.js"], confirmed: true });
  assert.equal(staged.status, "staged");
  assert.deepEqual(staged.files, ["src/index.js"]);

  const diff = await getGitDiff({ repoRoot, staged: true });
  assert.equal(diff.staged, true);
  assert.equal(diff.file_count, 1);

  const unstaged = await unstageSelectedFiles({ repoRoot, files: ["src/index.js"], confirmed: true });
  assert.equal(unstaged.status, "unstaged");
  const afterUnstage = await getGitDiff({ repoRoot, staged: true });
  assert.equal(afterUnstage.file_count, 0);
});

test("git workflow review summarizes staged and unstaged changes", async () => {
  const repoRoot = await createRepo();
  execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
  execFileSync("git", ["add", "."], { cwd: repoRoot, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"], { cwd: repoRoot, stdio: "ignore" });

  await fs.writeFile(path.join(repoRoot, "src", "index.js"), "export const value = 2;\n", "utf8");
  await fs.writeFile(path.join(repoRoot, "src", "staged.js"), "export const staged = true;\n", "utf8");
  execFileSync("git", ["add", "src/staged.js"], { cwd: repoRoot, stdio: "ignore" });

  const review = await getGitReview({ repoRoot });
  assert.equal(review.schema_version, 1);
  assert.equal(review.staged.file_count, 1);
  assert.equal(review.unstaged.file_count, 1);
  assert.ok(review.files.some((entry) => entry.path === "src/staged.js" && entry.index_status === "A"));
  assert.ok(review.files.some((entry) => entry.path === "src/index.js" && entry.worktree_status === "M"));
});

test("git workflow stage picker returns read-only stage and unstage choices", async () => {
  const repoRoot = await createRepo();
  execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
  execFileSync("git", ["add", "."], { cwd: repoRoot, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"], { cwd: repoRoot, stdio: "ignore" });

  await fs.writeFile(path.join(repoRoot, "src", "index.js"), "export const value = 2;\n", "utf8");
  await fs.writeFile(path.join(repoRoot, "src", "staged.js"), "export const staged = true;\n", "utf8");
  execFileSync("git", ["add", "src/staged.js"], { cwd: repoRoot, stdio: "ignore" });

  const picker = await buildGitStagePicker({ repoRoot });
  assert.equal(picker.schema_version, 1);
  assert.ok(picker.choices.some((entry) => entry.action === "stage" && entry.path === "src/index.js"));
  assert.ok(picker.choices.some((entry) => entry.action === "unstage" && entry.path === "src/staged.js"));
  assert.ok(picker.next_actions.some((entry) => entry.includes("heart ide stage --confirm")));
});

test("git workflow applies selected stage picker choices only after confirmation", async () => {
  const repoRoot = await createRepo();
  execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
  execFileSync("git", ["add", "."], { cwd: repoRoot, stdio: "ignore" });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"], { cwd: repoRoot, stdio: "ignore" });

  await fs.writeFile(path.join(repoRoot, "src", "index.js"), "export const value = 2;\n", "utf8");

  const preview = await selectGitStagePickerChoices({ repoRoot, selection: "1", confirmed: false });
  assert.equal(preview.status, "needs_confirmation");
  assert.equal(preview.selected_choices.length, 1);
  assert.equal(preview.selected_choices[0].action, "stage");

  const applied = await selectGitStagePickerChoices({ repoRoot, selection: "1", confirmed: true });
  assert.equal(applied.status, "applied");
  assert.deepEqual(applied.staged_files, ["src/index.js"]);

  const diff = await getGitDiff({ repoRoot, staged: true });
  assert.equal(diff.file_count, 1);
});

test("AI suggestion MVP collects context and accepts line suggestions", async () => {
  const buffer = {
    path: "src/index.js",
    language: "javascript",
    content: "export const value = ",
    cursor: { line: 1, column: 22 },
    version: 1,
  };
  const request = collectEditContext({ buffer });
  assert.equal(request.buffer.prefix, "export const value = ");

  const suggestion = await requestInlineSuggestion({
    request,
    suggestionProvider: async () => ({ text: "1;\n", model_id: "mock-code" }),
  });
  assert.equal(suggestion.status, "ready");
  const accepted = acceptSuggestionLine({ buffer, suggestion });
  assert.match(accepted.buffer.content, /1;/);
  assert.equal(rejectSuggestion({ suggestion }).event_type, "suggestion_rejected");
});

test("command palette and git summary expose workbench actions", async () => {
  const commands = openCommandPalette({ query: "context pack" });
  assert.equal(commands[0].action, "beheart.contextPack.build");

  const status = await getGitStatus({ repoRoot: process.cwd() });
  const summary = generateCommitSummary({ status });
  assert.match(summary.subject, /^(feat|docs|test)(\([^)]+\))?: /);
});

function createMockLspSpawn({
  capabilities = {},
  diagnosticsOnOpen = [],
  diagnosticsOnChange = [],
  onSpawn = () => {},
  respond = true,
} = {}) {
  return (command, args = []) => {
    onSpawn(command, args);
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      child.killed = true;
      child.emit("close", 0, null);
    };
    child.stdin.on("data", (chunk) => {
      if (!respond) return;
      for (const message of parseLspMessages(chunk.toString())) {
        if (message.method === "initialize") {
          child.stdout.write(encodeLspMessage({
            jsonrpc: "2.0",
            id: message.id,
            result: { capabilities },
          }));
        }
        if (message.method === "textDocument/didOpen" && diagnosticsOnOpen.length > 0) {
          child.stdout.write(encodeLspMessage({
            jsonrpc: "2.0",
            method: "textDocument/publishDiagnostics",
            params: {
              uri: message.params.textDocument.uri,
              diagnostics: diagnosticsOnOpen,
            },
          }));
        }
        if (message.method === "textDocument/didChange" && diagnosticsOnChange.length > 0) {
          child.stdout.write(encodeLspMessage({
            jsonrpc: "2.0",
            method: "textDocument/publishDiagnostics",
            params: {
              uri: message.params.textDocument.uri,
              diagnostics: diagnosticsOnChange,
            },
          }));
        }
      }
    });
    return child;
  };
}
