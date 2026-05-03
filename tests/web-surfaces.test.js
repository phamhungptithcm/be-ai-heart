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
  assert.match(html, /Local-First Start/);
  assert.match(html, /heart pack "add SSO login audit logging"/);
  assert.match(html, /Design Partner Pilot/);
  assert.match(html, /heart benchmark run --all/);
  assert.doesNotMatch(html, /30%\+|20%\+|40%\+/);
});

test("portal onboarding empty states point to the unified enterprise MVP activation path", async () => {
  const [workflowsSource, overviewSource, trialSource] = await Promise.all([
    fs.readFile(path.resolve("apps/portal/components/PortalProductWorkflowsClient.jsx"), "utf8"),
    fs.readFile(path.resolve("apps/portal/components/PortalOverviewEnterpriseClient.jsx"), "utf8"),
    fs.readFile(path.resolve("apps/website/app/start-trial/page.jsx"), "utf8"),
  ]);

  assert.match(workflowsSource, /heart sync setup/);
  assert.match(workflowsSource, /ContextPackPicker/);
  assert.match(overviewSource, /step.command/);
  assert.match(trialSource, /heart sync setup --slug your-project/);
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
  assert.match(html, /Context Pack Preview/);
  assert.match(html, /Model preset/);
  assert.match(html, /Command box/);
  assert.match(html, /heart pack &quot;add SSO login audit logging&quot;|heart pack "add SSO login audit logging"/);
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
  assert.match(html, /Context Pack Support Signals/);
  assert.match(html, /Operational Signals/);
});
