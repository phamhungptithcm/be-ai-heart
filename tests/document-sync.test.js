import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { buildWorkspaceState } from "../packages/core/src/index.js";
import {
  importLocalDocument,
  publishRepositoryDocuments,
  pullWebDocumentSubmissions,
  writeWebDocumentSubmission,
} from "../packages/document-sync/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("document sync imports CLI and web documents and filters web submissions by profile slug", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const sourceDocumentPath = path.join(workspaceRoot, "business-brief.md");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
    fs.writeFile(
      sourceDocumentPath,
      "# Business Brief\n\nNeed safer rollout for AI-assisted login changes.\n",
      "utf8",
    ),
  ]);

  const imported = await importLocalDocument({
    repoRoot,
    sourcePath: sourceDocumentPath,
    title: "Business Brief",
    category: "business",
    summary: "Need safer rollout for AI-assisted login changes.",
    profileSlug: "sample-repo",
  });

  assert.ok(imported.imported_path.endsWith(path.join(".heart", "imported-documents", "local", "business-brief.json")));

  await writeWebDocumentSubmission({
    portalRoot,
    adminRoot,
    submission: {
      profile_slug: "sample-repo",
      title: "Checkout PRD",
      category: "requirements",
      summary: "Clarify acceptance criteria for the checkout rewrite.",
      body: "The new checkout flow must preserve audit visibility.",
    },
  });
  await writeWebDocumentSubmission({
    portalRoot,
    adminRoot,
    submission: {
      profile_slug: "other-repo",
      title: "Other repo note",
      category: "business",
      summary: "This should not import into sample-repo.",
      body: "Irrelevant for this repository.",
    },
  });

  const pulled = await pullWebDocumentSubmissions({
    repoRoot,
    portalRoot,
    profileSlug: "sample-repo",
  });

  assert.equal(pulled.imported_count, 1);
  assert.equal(pulled.matched_profile_slug, "sample-repo");

  const workspaceState = await buildWorkspaceState(repoRoot, {
    forceRescan: true,
  });
  const published = await publishRepositoryDocuments({
    surfaceRoot: portalRoot,
    profileSlug: "sample-repo",
    repo: path.basename(repoRoot),
    documentIndex: workspaceState.documentIndex,
  });
  const serviceSubmissionIndex = JSON.parse(
    await fs.readFile(
      path.join(workspaceRoot, "services", "api", "data", "document-submissions", "index.json"),
      "utf8",
    ),
  );
  const serviceSubmissionRecord = JSON.parse(
    await fs.readFile(
      path.join(
        workspaceRoot,
        "services",
        "api",
        "data",
        "document-submissions",
        "submissions",
        "sample-repo-checkout-prd.json",
      ),
      "utf8",
    ),
  );
  const documentsIndex = JSON.parse(
    await fs.readFile(path.join(portalRoot, "public", "documents", "index.json"), "utf8"),
  );
  const repositoryArtifact = JSON.parse(await fs.readFile(published.repository_path, "utf8"));
  const publicSubmissionIndex = JSON.parse(
    await fs.readFile(path.join(portalRoot, "public", "document-submissions", "index.json"), "utf8"),
  );
  const workspaceIndex = JSON.parse(
    await fs.readFile(path.join(workspaceRoot, "services", "api", "data", "workspaces", "index.json"), "utf8"),
  );
  const portalWorkspaceIndex = JSON.parse(
    await fs.readFile(path.join(portalRoot, "public", "workspaces", "index.json"), "utf8"),
  );

  assert.equal(documentsIndex.repositories.length, 1);
  assert.equal(repositoryArtifact.profile_slug, "sample-repo");
  assert.equal(repositoryArtifact.workspace_slug, "sample-repo");
  assert.ok(repositoryArtifact.documents.some((document) => document.title === "Business Brief"));
  assert.ok(repositoryArtifact.documents.some((document) => document.title === "Checkout PRD"));
  assert.ok(repositoryArtifact.documents.every((document) => document.title !== "Other repo note"));
  assert.equal(serviceSubmissionIndex.submissions.length, 2);
  assert.equal(serviceSubmissionRecord.title, "Checkout PRD");
  assert.equal(publicSubmissionIndex.submissions.length, 2);
  assert.equal(workspaceIndex.workspaces.length, 2);
  assert.equal(
    workspaceIndex.workspaces.find((workspace) => workspace.workspace_slug === "sample-repo")?.queued_submission_count,
    1,
  );
  assert.equal(portalWorkspaceIndex.workspaces.length, 2);
});
