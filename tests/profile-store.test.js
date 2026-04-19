import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  listRepositoryProfiles,
  loadRepositoryProfile,
  resolveProfilesRoot,
  sanitizeSlug,
} from "../packages/profile-store/src/index.js";
import {
  generateDiagramBundle,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../packages/diagram-generator/src/index.js";
import { buildWorkspaceState } from "../packages/core/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("profile store resolves scoped roots for workspace and monorepo layouts", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);

  assert.equal(resolveProfilesRoot("portal", { appRoot: path.join(workspaceRoot, "apps", "portal") }), path.join(workspaceRoot, "apps", "portal", "profiles"));
  assert.equal(resolveProfilesRoot("admin", path.join(workspaceRoot, "apps", "admin")), path.join(workspaceRoot, "apps", "admin", "profiles"));
});

test("profile store lists and loads synced repository profiles for both surfaces", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
  ]);

  const workspaceState = await buildWorkspaceState(repoRoot);
  const bundle = generateDiagramBundle({
    workspaceState,
    task: "improve login audit flow",
  });
  const artifacts = await writeDiagramBundle(repoRoot, bundle);

  await syncRepositoryProfile({
    repoRoot,
    workspaceState,
    bundle,
    artifacts,
    slug: "test-profile",
    portalRoot,
    adminRoot,
  });

  const portalProfiles = await listRepositoryProfiles("portal", { appRoot: portalRoot });
  const adminProfiles = await listRepositoryProfiles("admin", { appRoot: adminRoot });
  const portalProfile = await loadRepositoryProfile("portal", "test-profile", {
    appRoot: portalRoot,
    includeDiagramContents: true,
  });
  const adminProfile = await loadRepositoryProfile("admin", "test-profile", {
    appRoot: adminRoot,
    includeDiagramContents: true,
  });

  assert.equal(portalProfiles.length, 1);
  assert.equal(adminProfiles.length, 1);
  assert.equal(portalProfile.profile_slug, "test-profile");
  assert.equal(adminProfile.profile_slug, "test-profile");
  assert.ok(portalProfile.diagrams.some((diagram) => diagram.content.includes("flowchart LR")));
  assert.ok(adminProfile.diagrams.some((diagram) => diagram.content.includes("sequenceDiagram")));
});

test("profile store sanitizes slugs consistently", () => {
  assert.equal(sanitizeSlug("  Portal Surface  "), "portal-surface");
  assert.equal(sanitizeSlug("###"), "profile");
});
