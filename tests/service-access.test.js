import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { buildWorkspaceState } from "../packages/core/src/index.js";
import {
  generateDiagramBundle,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../packages/diagram-generator/src/index.js";
import { writeWebDocumentSubmission } from "../packages/document-sync/src/index.js";
import {
  listAccessibleWorkspaces,
  loadAccessibleDocumentsView,
  loadAccessibleRepositoryView,
} from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("service access filters workspaces, repository views, and documents by actor membership", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const serviceStorageRoot = path.join(workspaceRoot, "services", "api", "data");
  const authRoot = path.join(serviceStorageRoot, "auth");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
    fs.mkdir(authRoot, { recursive: true }),
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
    slug: "alpha-workspace",
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  });
  await syncRepositoryProfile({
    repoRoot,
    workspaceState,
    bundle,
    artifacts,
    slug: "beta-workspace",
    portalRoot,
    adminRoot,
    serviceStorageRoot,
  });

  await writeWebDocumentSubmission({
    portalRoot,
    adminRoot,
    serviceStorageRoot,
    submission: {
      profile_slug: "alpha-workspace",
      title: "Alpha PRD",
      category: "requirements",
      summary: "Only alpha actor should see this.",
      body: "Alpha workspace requirement note.",
    },
  });
  await writeWebDocumentSubmission({
    portalRoot,
    adminRoot,
    serviceStorageRoot,
    submission: {
      profile_slug: "beta-workspace",
      title: "Beta PRD",
      category: "requirements",
      summary: "Beta actor note.",
      body: "Beta workspace requirement note.",
    },
  });

  await fs.writeFile(
    path.join(authRoot, "actors.json"),
    `${JSON.stringify(
      {
        actors: [
          {
            actor_slug: "owner-admin",
            surface: "admin",
            role: "owner",
            access_mode: "all",
          },
          {
            actor_slug: "customer-alpha",
            surface: "portal",
            role: "customer",
            access_mode: "memberships",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(authRoot, "memberships.json"),
    `${JSON.stringify(
      {
        memberships: [
          {
            actor_slug: "customer-alpha",
            workspace_slug: "alpha-workspace",
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const workspaces = await listAccessibleWorkspaces({
    serviceStorageRoot,
    surface: "portal",
    actorSlug: "customer-alpha",
  });
  const alphaView = await loadAccessibleRepositoryView({
    serviceStorageRoot,
    surface: "portal",
    actorSlug: "customer-alpha",
    profileSlug: "alpha-workspace",
  });
  const alphaFullView = await loadAccessibleRepositoryView({
    serviceStorageRoot,
    surface: "portal",
    actorSlug: "customer-alpha",
    profileSlug: "alpha-workspace",
    graphMode: "full",
  });
  const betaView = await loadAccessibleRepositoryView({
    serviceStorageRoot,
    surface: "portal",
    actorSlug: "customer-alpha",
    profileSlug: "beta-workspace",
  });
  const documentsView = await loadAccessibleDocumentsView({
    serviceStorageRoot,
    surface: "portal",
    actorSlug: "customer-alpha",
  });

  assert.equal(workspaces.length, 1);
  assert.equal(workspaces[0].workspace_slug, "alpha-workspace");
  assert.equal(alphaView?.profile?.profile_slug, "alpha-workspace");
  assert.equal(alphaView?.code_graph?.view?.mode, "focused");
  assert.equal(alphaFullView?.code_graph?.view?.mode, "full");
  assert.ok(alphaFullView?.code_graph?.view?.node_count >= alphaView?.code_graph?.view?.node_count);
  assert.equal(betaView, null);
  assert.equal(documentsView.repositories.length, 1);
  assert.equal(documentsView.repositories[0].profile_slug, "alpha-workspace");
  assert.equal(documentsView.submissions.length, 1);
  assert.equal(documentsView.submissions[0].profile_slug, "alpha-workspace");
  assert.equal(documentsView.status_summary.status, "queued_updates");
  assert.deepEqual(documentsView.status_summary.queued_profile_slugs, ["alpha-workspace"]);
});
