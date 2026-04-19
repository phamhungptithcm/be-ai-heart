import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildWorkspaceState,
  getWorkspaceCachePaths,
  loadCachedWorkspaceState,
} from "../packages/core/src/index.js";
import { appendFileWithFreshMtime, createTempRepoCopy } from "./helpers/temp-repo.js";

test("workspace state persists cache and reuses unchanged code and docs", async (t) => {
  const repoRoot = await createTempRepoCopy(t);

  const firstState = await buildWorkspaceState(repoRoot);
  assert.equal(firstState.cache.status, "created");
  assert.equal(firstState.cache.source_changes.added_file_count, 3);
  assert.equal(firstState.cache.document_changes.added_document_count, 2);

  const cachePaths = getWorkspaceCachePaths(repoRoot);
  await fs.access(cachePaths.workspaceStatePath);

  const cachedState = await loadCachedWorkspaceState(repoRoot);
  assert.ok(cachedState);
  assert.equal(cachedState.scanResult.totals.file_count, 3);
  assert.equal(cachedState.documentIndex.totals.document_count, 2);

  const secondState = await buildWorkspaceState(repoRoot);
  assert.equal(secondState.cache.status, "hit");
  assert.equal(secondState.cache.source_changes.reused_file_count, 3);
  assert.equal(secondState.cache.source_changes.reparsed_file_count, 0);
  assert.equal(secondState.cache.document_changes.reused_document_count, 2);
  assert.equal(secondState.cache.document_changes.reparsed_document_count, 0);
  assert.ok(secondState.heartModel.summary.relationship_count > 0);
  assert.deepEqual(secondState.graph.summary, firstState.graph.summary);
});

test("workspace state marks changed source and documents as incremental updates", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  await buildWorkspaceState(repoRoot);

  await appendFileWithFreshMtime(
    path.join(repoRoot, "src/auth/login.ts"),
    "\n// incremental cache validation hook\n",
  );
  await appendFileWithFreshMtime(
    path.join(repoRoot, "docs/requirements.md"),
    "\nAdditional benchmark-oriented acceptance criteria.\n",
  );

  const updatedState = await buildWorkspaceState(repoRoot);
  assert.equal(updatedState.cache.status, "updated");
  assert.equal(updatedState.cache.source_changes.changed_file_count, 1);
  assert.equal(updatedState.cache.source_changes.reused_file_count, 2);
  assert.equal(updatedState.cache.source_changes.reparsed_file_count, 1);
  assert.equal(updatedState.cache.document_changes.changed_document_count, 1);
  assert.equal(updatedState.cache.document_changes.reused_document_count, 1);
  assert.equal(updatedState.cache.document_changes.reparsed_document_count, 1);
});

test("workspace state applies configured ignore and document roots from heart.config.yaml", async (t) => {
  const repoRoot = await createTempRepoCopy(t);

  await fs.mkdir(path.join(repoRoot, "generated"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, "notes"), { recursive: true });
  await fs.writeFile(
    path.join(repoRoot, "generated", "artifact.ts"),
    "export const generatedArtifact = true;\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(repoRoot, "notes", "customer-requirements.md"),
    "# Customer Requirements\n\nPortal updates must feed the next context pack.\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(repoRoot, "heart.config.yaml"),
    `project:
  name: sample-repo
  ignore:
    - generated
knowledge:
  document_paths:
    - docs
    - notes
`,
    "utf8",
  );

  const workspaceState = await buildWorkspaceState(repoRoot);
  const sourcePaths = workspaceState.scanResult.files.map((file) => file.relativePath);
  const documentPaths = workspaceState.documentIndex.documents.map((document) => document.path);

  assert.equal(sourcePaths.includes("generated/artifact.ts"), false);
  assert.equal(documentPaths.includes("notes/customer-requirements.md"), true);
  assert.equal(workspaceState.scanProvenance.ignore_paths.includes("generated"), true);
  assert.deepEqual(workspaceState.scanProvenance.document_roots, ["docs", "notes", ".heart/imported-documents"]);
});

test("workspace state invalidates cache when repo-local policies change", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const firstState = await buildWorkspaceState(repoRoot);

  await fs.mkdir(path.join(repoRoot, ".heart"), { recursive: true });
  await fs.writeFile(
    path.join(repoRoot, ".heart", "policies.yaml"),
    `rules:
  - id: auth-no-session-imports
    from_prefix: src/auth/
    blocked_prefix: src/auth/session.ts
    description: auth entrypoints should not import session implementation directly
`,
    "utf8",
  );

  const secondState = await buildWorkspaceState(repoRoot);
  const cachedState = await loadCachedWorkspaceState(repoRoot);

  assert.equal(firstState.cache.status, "created");
  assert.equal(secondState.cache.status, "updated");
  assert.equal(secondState.cache.source_changes.changed_file_count, 0);
  assert.equal(secondState.cache.document_changes.changed_document_count, 0);
  assert.equal(secondState.policyReport.rules[0].id, "auth-no-session-imports");
  assert.equal(cachedState.scanProvenance.policy_exists, true);
  assert.equal(cachedState.scanProvenance.policy_path, path.join(repoRoot, ".heart", "policies.yaml"));
});
