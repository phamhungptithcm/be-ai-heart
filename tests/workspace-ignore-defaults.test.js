import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { scanDocumentTree } from "../packages/document-ingest/src/index.js";
import { scanSourceTree } from "../packages/parser-ts/src/index.js";

test("default source and document scanning excludes .worktrees clones", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-worktrees-"));
  const repoRoot = path.join(tempRoot, "repo");
  const shadowRoot = path.join(repoRoot, ".worktrees", "review-copy");

  await fs.mkdir(path.join(repoRoot, "src"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "docs"), { recursive: true });
  await fs.mkdir(path.join(shadowRoot, "src"), { recursive: true });
  await fs.mkdir(path.join(shadowRoot, "docs"), { recursive: true });

  await Promise.all([
    fs.writeFile(path.join(repoRoot, "src", "index.ts"), "export const live = true;\n", "utf8"),
    fs.writeFile(path.join(repoRoot, "docs", "overview.md"), "# Overview\n\nPrimary repo doc.\n", "utf8"),
    fs.writeFile(path.join(shadowRoot, "src", "shadow.ts"), "export const shouldIgnore = true;\n", "utf8"),
    fs.writeFile(path.join(shadowRoot, "docs", "shadow.md"), "# Shadow\n\nShould never count.\n", "utf8"),
  ]);

  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const scanResult = await scanSourceTree(repoRoot);
  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: ["docs", ".worktrees/review-copy/docs"],
  });

  assert.deepEqual(
    scanResult.files.map((file) => file.relativePath),
    ["src/index.ts"],
  );
  assert.deepEqual(
    documentIndex.documents.map((document) => document.path),
    ["docs/overview.md"],
  );
});

test("default source and document scanning excludes generated and vendor artifacts", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-generated-"));
  const repoRoot = path.join(tempRoot, "repo");

  await Promise.all([
    fs.mkdir(path.join(repoRoot, "src"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, "docs"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, "build", "docs"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, "out", "docs"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, "vendor", "docs"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, ".turbo", "cache"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, "playwright-report"), { recursive: true }),
  ]);

  await Promise.all([
    fs.writeFile(path.join(repoRoot, "src", "index.ts"), "export const live = true;\n", "utf8"),
    fs.writeFile(path.join(repoRoot, "docs", "overview.md"), "# Overview\n\nPrimary repo doc.\n", "utf8"),
    fs.writeFile(path.join(repoRoot, "build", "artifact.ts"), "export const built = true;\n", "utf8"),
    fs.writeFile(path.join(repoRoot, "out", "bundle.ts"), "export const bundled = true;\n", "utf8"),
    fs.writeFile(path.join(repoRoot, "vendor", "dep.ts"), "export const vendored = true;\n", "utf8"),
    fs.writeFile(path.join(repoRoot, ".turbo", "cache", "artifact.ts"), "export const turbo = true;\n", "utf8"),
    fs.writeFile(path.join(repoRoot, "playwright-report", "report.ts"), "export const report = true;\n", "utf8"),
    fs.writeFile(path.join(repoRoot, "build", "docs", "artifact.md"), "# Build Doc\n\nGenerated.\n", "utf8"),
    fs.writeFile(path.join(repoRoot, "out", "docs", "bundle.md"), "# Out Doc\n\nGenerated.\n", "utf8"),
    fs.writeFile(path.join(repoRoot, "vendor", "docs", "dep.md"), "# Vendor Doc\n\nVendored.\n", "utf8"),
  ]);

  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const scanResult = await scanSourceTree(repoRoot);
  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: ["docs", "build/docs", "out/docs", "vendor/docs"],
  });

  assert.deepEqual(
    scanResult.files.map((file) => file.relativePath),
    ["src/index.ts"],
  );
  assert.deepEqual(
    documentIndex.documents.map((document) => document.path),
    ["docs/overview.md"],
  );
});
