import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { renderAdminRepositorySupportPage } from "../apps/admin/src/index.js";
import { renderPortalRepositoryProfilePage } from "../apps/portal/src/index.js";
import { renderWebsiteHomePage } from "../apps/website/src/index.js";
import {
  generateDiagramBundle,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../packages/diagram-generator/src/index.js";
import { buildWorkspaceState } from "../packages/core/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("website home page separates public marketing and portal access", () => {
  const html = renderWebsiteHomePage({
    portalUrl: "/portal",
    signInUrl: "/sign-in",
    trialUrl: "/start-trial",
    demoUrl: "/book-demo",
  });

  assert.match(html, /Public Website/);
  assert.match(html, /Start Trial/);
  assert.match(html, /Open Portal/);
  assert.match(html, /Customer workspace/);
});

test("portal repository profile page renders synced mermaid diagrams for customers", async (t) => {
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
    slug: "portal-surface",
    portalRoot,
    adminRoot,
  });

  const html = await renderPortalRepositoryProfilePage("portal-surface", workspaceRoot);
  assert.match(html, /Customer Portal/);
  assert.match(html, /Portal \| sample-repo/);
  assert.match(html, /<div class="mermaid">/);
  assert.match(html, /Synced Diagrams/);
  assert.match(html, /sequenceDiagram|flowchart LR/);
});

test("admin repository support page renders internal support-oriented repository view", async (t) => {
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
    slug: "admin-surface",
    portalRoot,
    adminRoot,
  });

  const html = await renderAdminRepositorySupportPage("admin-surface", workspaceRoot);
  assert.match(html, /Internal Admin/);
  assert.match(html, /Support view for sample-repo/);
  assert.match(html, /Customer-Synced Diagrams/);
  assert.match(html, /Operational Signals/);
});
