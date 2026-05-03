import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { createTempRepoCopy } from "./helpers/temp-repo.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");

function runCli(args, options = {}) {
  return spawnSync("node", [cliPath, ...args], {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    env: { ...process.env, CI: "true", NO_COLOR: "1", ...options.env },
    input: options.input,
  });
}

test("heart ide help and non-TTY mode are script safe", () => {
  const help = runCli(["ide", "--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /heart ide/);
  assert.match(help.stdout, /patch-preview/);

  const nonTty = runCli(["ide"]);
  assert.equal(nonTty.status, 0);
  assert.match(nonTty.stdout, /heart ide/);
  assert.doesNotMatch(nonTty.stdout, /heart ide>/);
});

test("heart ide exposes status, files, keymap, palette, tasks, and git", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  for (const args of [
    ["ide", "status", "--json", "--root", repoRoot],
    ["ide", "files", "--json", "--root", repoRoot, "auth"],
    ["ide", "keymap", "--json", "--root", repoRoot],
    ["ide", "palette", "--json", "context", "pack"],
    ["ide", "tasks", "--json", "--root", repoRoot],
    ["ide", "git", "--json", "--root", repoRoot],
  ]) {
    const result = runCli(args);
    assert.equal(result.status, 0, `${args.join(" ")} failed: ${result.stderr}`);
    assert.doesNotThrow(() => JSON.parse(result.stdout));
  }
});

test("heart ide diagnostics parses compiler output files as clean JSON", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const outputPath = path.join(repoRoot, "diagnostics.txt");
  await fs.writeFile(
    outputPath,
    "src/auth/login.ts(3,12): error TS7006: Parameter 'email' implicitly has an 'any' type.\n",
    "utf8",
  );

  const result = runCli(["ide", "diagnostics", "--json", "--root", repoRoot, "--source", "typecheck", outputPath]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.source, "typecheck");
  assert.equal(payload.diagnostics.length, 1);
  assert.equal(payload.diagnostics[0].path, "src/auth/login.ts");
  assert.equal(payload.diagnostics[0].code, "TS7006");

  const nav = runCli(["ide", "diagnostics-nav", "--json", "--root", repoRoot, "--source", "typecheck", outputPath]);
  assert.equal(nav.status, 0, nav.stderr);
  const navPayload = JSON.parse(nav.stdout);
  assert.equal(navPayload.items[0].key, "1");
  assert.equal(navPayload.items[0].path, "src/auth/login.ts");
  assert.match(navPayload.items[0].command, /heart ide open/);
});

test("heart ide diagnostics accepts LSP publishDiagnostics JSON", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const lspPath = path.join(repoRoot, "lsp-diagnostics.json");
  await fs.writeFile(
    lspPath,
    JSON.stringify({
      method: "textDocument/publishDiagnostics",
      params: {
        uri: `file://${repoRoot}/src/auth/login.ts`,
        diagnostics: [{
          range: {
            start: { line: 4, character: 8 },
            end: { line: 4, character: 13 },
          },
          severity: 2,
          code: "no-unused-vars",
          source: "eslint",
          message: "Unused variable.",
        }],
      },
    }),
    "utf8",
  );

  const result = runCli(["ide", "diagnostics", "--json", "--root", repoRoot, "--format", "lsp", lspPath]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.format, "lsp");
  assert.equal(payload.summary.warning, 1);
  assert.equal(payload.diagnostics[0].path, "src/auth/login.ts");
});

test("heart ide diff and stage expose confirm-gated git workflow", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  spawnSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
  await fs.writeFile(path.join(repoRoot, "src", "auth", "login.ts"), "export function loginUser() { return false; }\n", "utf8");

  const needsConfirmation = runCli(["ide", "stage", "--json", "--root", repoRoot, "src/auth/login.ts"]);
  assert.equal(needsConfirmation.status, 0, needsConfirmation.stderr);
  assert.equal(JSON.parse(needsConfirmation.stdout).status, "needs_confirmation");

  const staged = runCli(["ide", "stage", "--json", "--root", repoRoot, "--confirm", "src/auth/login.ts"]);
  assert.equal(staged.status, 0, staged.stderr);
  assert.equal(JSON.parse(staged.stdout).status, "staged");

  const diff = runCli(["ide", "diff", "--json", "--root", repoRoot, "--staged"]);
  assert.equal(diff.status, 0, diff.stderr);
  const payload = JSON.parse(diff.stdout);
  assert.equal(payload.staged, true);
  assert.equal(payload.file_count, 1);

  const review = runCli(["ide", "review", "--json", "--root", repoRoot]);
  assert.equal(review.status, 0, review.stderr);
  const reviewPayload = JSON.parse(review.stdout);
  assert.equal(reviewPayload.staged.file_count, 1);
  assert.ok(reviewPayload.next_actions.some((entry) => entry.includes("unstage")));

  const picker = runCli(["ide", "stage-picker", "--json", "--root", repoRoot]);
  assert.equal(picker.status, 0, picker.stderr);
  const pickerPayload = JSON.parse(picker.stdout);
  assert.ok(pickerPayload.choices.some((entry) => entry.action === "unstage"));

  const selected = runCli(["ide", "stage-picker", "--json", "--root", repoRoot, "--select", "1"]);
  assert.equal(selected.status, 0, selected.stderr);
  const selectedPayload = JSON.parse(selected.stdout);
  assert.equal(selectedPayload.status, "needs_confirmation");
  assert.equal(selectedPayload.selected_choices.length, 1);
});

test("heart ide memory panel commands return structured beheart context", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  for (const args of [
    ["ide", "graph", "--json", "--root", repoRoot],
    ["ide", "docs", "--json", "--root", repoRoot],
    ["ide", "policy", "--json", "--root", repoRoot],
    ["ide", "context", "--json", "--root", repoRoot, "update login flow"],
    ["ide", "domain", "--json", "--root", repoRoot],
    ["ide", "memory", "--json", "--root", repoRoot, "update login flow"],
  ]) {
    const result = runCli(args);
    assert.equal(result.status, 0, `${args.join(" ")} failed: ${result.stderr}`);
    assert.doesNotThrow(() => JSON.parse(result.stdout));
  }

  const memory = runCli(["ide", "memory", "--json", "--root", repoRoot, "update login flow"]);
  assert.equal(memory.status, 0, memory.stderr);
  const payload = JSON.parse(memory.stdout);
  assert.equal(payload.schema_version, 1);
  assert.ok(payload.graph.file_count >= 1);
  assert.ok(payload.suggested_attachments.some((entry) => entry.type === "repo_graph"));
  assert.ok(payload.next_actions.some((entry) => entry.includes("heart ide context")));

  const docsDrilldown = runCli(["ide", "memory", "--json", "--root", repoRoot, "docs", "login"]);
  assert.equal(docsDrilldown.status, 0, docsDrilldown.stderr);
  const docsPayload = JSON.parse(docsDrilldown.stdout);
  assert.equal(docsPayload.view, "docs");
  assert.ok(docsPayload.docs.matches.length >= 1);
  assert.ok(docsPayload.artifacts.some((entry) => entry.type === "docs_spec"));

  const selectedArtifact = runCli(["ide", "memory", "--json", "--root", repoRoot, "docs", "login", "--select", "docs:1"]);
  assert.equal(selectedArtifact.status, 0, selectedArtifact.stderr);
  const selectedPayload = JSON.parse(selectedArtifact.stdout);
  assert.equal(selectedPayload.selected_artifact.artifact_id, "docs:1");
  assert.ok(selectedPayload.selected_artifact.next_actions.some((entry) => entry.includes("heart ide open")));
});

test("heart ide lsp-probe denies unknown server presets safely", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const result = runCli(["ide", "lsp-probe", "--json", "--root", repoRoot, "--server", "unknown-lsp"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, "denied");
});

test("heart ide lsp-diagnostics denies unknown server presets safely", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const result = runCli(["ide", "lsp-diagnostics", "--json", "--root", repoRoot, "--server", "unknown-lsp", "src/auth/login.ts"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, "denied");
});

test("heart ide patch flow requires confirmation before apply", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const patchPath = path.join(repoRoot, "proposal.json");
  await fs.writeFile(
    patchPath,
    JSON.stringify({
      files: [{
        path: "src/auth/login.ts",
        new_content: "export function loginUser() { return true; }\n",
      }],
    }),
    "utf8",
  );

  const preview = runCli(["ide", "patch-preview", "--json", "--root", repoRoot, patchPath]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).status, "pending");

  const needsConfirmation = runCli(["ide", "patch-apply", "--json", "--root", repoRoot, patchPath]);
  assert.equal(needsConfirmation.status, 0, needsConfirmation.stderr);
  assert.equal(JSON.parse(needsConfirmation.stdout).status, "needs_confirmation");

  const applied = runCli(["ide", "patch-apply", "--json", "--root", repoRoot, "--confirm", patchPath]);
  assert.equal(applied.status, 0, applied.stderr);
  const payload = JSON.parse(applied.stdout);
  assert.equal(payload.status, "applied");
  assert.ok(payload.rollback_id);
});
