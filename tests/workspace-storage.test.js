import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildWorkspaceState,
  getWorkspaceCachePaths,
  loadCachedWorkspaceState,
  WORKSPACE_CACHE_SCHEMA_VERSION,
} from "../packages/core/src/index.js";
import { compileContextPack } from "../packages/context-compiler/src/index.js";
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

test("workspace state ignores copied cache artifacts from a different repo root", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const cachedState = await loadCachedWorkspaceState(repoRoot);

  assert.equal(cachedState, null);
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

test("workspace scan provenance records cache schema and effective ignore sources", async (t) => {
  const repoRoot = await createTempRepoCopy(t);

  await Promise.all([
    fs.mkdir(path.join(repoRoot, ".heart"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, "generated"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, "vendor"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, ".next", "server"), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(path.join(repoRoot, "generated", "artifact.ts"), "export const generated = true;\n", "utf8"),
    fs.writeFile(path.join(repoRoot, "vendor", "dependency.ts"), "export const vendored = true;\n", "utf8"),
    fs.writeFile(path.join(repoRoot, ".next", "server", "page.ts"), "export const nextBuild = true;\n", "utf8"),
    fs.writeFile(
      path.join(repoRoot, ".heart", "policies.yaml"),
      `rules:
  - id: fixture-policy
    description: fixture policy
`,
      "utf8",
    ),
    fs.writeFile(
      path.join(repoRoot, "heart.config.yaml"),
      `project:
  name: sample-repo
  ignore:
    - generated
knowledge:
  document_paths:
    - docs
`,
      "utf8",
    ),
  ]);

  const workspaceState = await buildWorkspaceState(repoRoot);
  const cachedState = await loadCachedWorkspaceState(repoRoot);
  const sourcePaths = workspaceState.scanResult.files.map((file) => file.relativePath);

  assert.equal(sourcePaths.some((filePath) => filePath.startsWith("generated/")), false);
  assert.equal(sourcePaths.some((filePath) => filePath.startsWith("vendor/")), false);
  assert.equal(sourcePaths.some((filePath) => filePath.startsWith(".next/")), false);
  assert.equal(workspaceState.scanProvenance.cache_schema_version, WORKSPACE_CACHE_SCHEMA_VERSION);
  assert.deepEqual(workspaceState.scanProvenance.configured_ignore_paths, ["generated"]);
  assert.ok(workspaceState.scanProvenance.default_ignore_paths.includes(".next"));
  assert.ok(workspaceState.scanProvenance.default_ignore_paths.includes("vendor"));
  assert.ok(workspaceState.scanProvenance.ignore_paths.includes("generated"));
  assert.ok(workspaceState.scanProvenance.ignore_paths.includes(".heart/cache"));
  assert.ok(workspaceState.scanProvenance.ignore_paths.includes("vendor"));
  assert.equal(cachedState.scanProvenance.cache_schema_version, WORKSPACE_CACHE_SCHEMA_VERSION);
  assert.equal(workspaceState.readiness.schema_version, 1);
  assert.equal(workspaceState.readiness.status, "ready");
  assert.equal(workspaceState.readiness.config_status, "loaded");
  assert.equal(workspaceState.readiness.policy_status, "loaded");
  assert.equal(workspaceState.readiness.generated_noise_exclusion.status, "ready");
  assert.equal(workspaceState.readiness.generated_noise_exclusion.missing_ignore_paths.length, 0);
  assert.equal(workspaceState.readiness.parser.engine, "typescript-ast");
  assert.equal(workspaceState.readiness.documents.count, workspaceState.documentIndex.totals.document_count);
  assert.deepEqual(workspaceState.readiness.warnings, []);
  assert.equal(cachedState.readiness.generated_noise_exclusion.status, "ready");
  assert.equal(cachedState.graphSnapshot.schema_version, 2);
  assert.equal(cachedState.graphSnapshot.repo, "sample-repo");
  assert.equal(cachedState.graphSnapshot.root, ".");
  assert.equal(typeof cachedState.graphSnapshot.generated_at, "string");
  assert.equal(cachedState.graphSnapshot.scan_provenance.repo_root, undefined);
  assert.equal(cachedState.graphSnapshot.scan_provenance.config_hash, workspaceState.scanProvenance.config_hash);
  assert.equal(cachedState.graphSnapshot.nodes.some((node) => String(node.path).includes(repoRoot)), false);
  assert.equal(cachedState.graphSnapshot.edges.every((edge) => typeof edge.provenance === "string"), true);
});

test("unchanged repeated scans keep counts and top context candidates stable", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const firstState = await buildWorkspaceState(repoRoot);
  const secondState = await buildWorkspaceState(repoRoot);
  const task = "add login audit visibility";
  const firstPack = compileContextPack({
    task,
    graph: firstState.graph,
    documentIndex: firstState.documentIndex,
    heartModel: firstState.heartModel,
    policyReport: firstState.policyReport,
    tokenBudget: 1200,
  });
  const secondPack = compileContextPack({
    task,
    graph: secondState.graph,
    documentIndex: secondState.documentIndex,
    heartModel: secondState.heartModel,
    policyReport: secondState.policyReport,
    tokenBudget: 1200,
  });

  assert.equal(secondState.cache.status, "hit");
  assert.deepEqual(secondState.scanResult.totals, firstState.scanResult.totals);
  assert.deepEqual(secondState.documentIndex.totals, firstState.documentIndex.totals);
  assert.deepEqual(
    secondPack.relevant_files.slice(0, 3).map((file) => file.path),
    firstPack.relevant_files.slice(0, 3).map((file) => file.path),
  );
  assert.deepEqual(
    secondPack.relevant_symbols.slice(0, 3).map((symbol) => symbol.id),
    firstPack.relevant_symbols.slice(0, 3).map((symbol) => symbol.id),
  );
  assert.deepEqual(
    secondPack.relevant_documents.slice(0, 3).map((document) => document.path),
    firstPack.relevant_documents.slice(0, 3).map((document) => document.path),
  );
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

test("workspace cache persistence stays valid when scans run in parallel", async (t) => {
  const repoRoot = await createTempRepoCopy(t);

  const states = await Promise.all([
    buildWorkspaceState(repoRoot, { forceRescan: true }),
    buildWorkspaceState(repoRoot, { forceRescan: true }),
    buildWorkspaceState(repoRoot, { forceRescan: true }),
  ]);
  const cachedState = await loadCachedWorkspaceState(repoRoot);

  assert.equal(states.length, 3);
  assert.ok(states.every((state) => state.scanResult.totals.file_count > 0));
  assert.ok(cachedState);
  assert.ok(cachedState.scanResult.totals.file_count > 0);
  assert.ok(cachedState.documentIndex.totals.document_count > 0);
  assert.ok(cachedState.graphSnapshot.nodes.length > 0);
});
