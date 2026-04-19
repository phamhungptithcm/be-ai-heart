import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadAdminRepositoryProfile } from "../apps/admin/src/index.js";
import { loadPortalRepositoryProfile } from "../apps/portal/src/index.js";
import {
  DIAGRAM_TYPES,
  generateDiagramBundle,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../packages/diagram-generator/src/index.js";
import { buildWorkspaceState } from "../packages/core/src/index.js";
import { writeTypedGraphFixture } from "./helpers/typed-graph-fixture.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("diagram generator module stays importable for CLI flows", async () => {
  const module = await import("../packages/diagram-generator/src/index.js");

  assert.equal(typeof module.generateDiagramBundle, "function");
  assert.equal(typeof module.writeDiagramBundle, "function");
  assert.equal(typeof module.syncRepositoryProfile, "function");
});

test("diagram generator builds mermaid outputs for symbol, high-level, component, class, and sequence views", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceState = await buildWorkspaceState(repoRoot);
  const bundle = generateDiagramBundle({
    workspaceState,
    task: "improve login audit flow",
  });

  assert.deepEqual(
    bundle.diagrams.map((diagram) => diagram.type),
    [
      DIAGRAM_TYPES.symbolGraph,
      DIAGRAM_TYPES.highLevel,
      DIAGRAM_TYPES.component,
      DIAGRAM_TYPES.class,
      DIAGRAM_TYPES.sequence,
    ],
  );

  const symbolGraph = bundle.diagrams.find((diagram) => diagram.type === DIAGRAM_TYPES.symbolGraph);
  const highLevel = bundle.diagrams.find((diagram) => diagram.type === DIAGRAM_TYPES.highLevel);
  const componentDiagram = bundle.diagrams.find((diagram) => diagram.type === DIAGRAM_TYPES.component);
  const classDiagram = bundle.diagrams.find((diagram) => diagram.type === DIAGRAM_TYPES.class);
  const sequenceDiagram = bundle.diagrams.find((diagram) => diagram.type === DIAGRAM_TYPES.sequence);

  assert.match(symbolGraph.content, /flowchart LR/);
  assert.match(symbolGraph.content, /function: loginUser/);
  assert.match(symbolGraph.content, /const: buildAuditMessage/);
  assert.match(highLevel.content, /Domain: auth/);
  assert.match(highLevel.content, /Component: auth\/login/);
  assert.match(componentDiagram.content, /flowchart LR/);
  assert.match(componentDiagram.content, /Component: auth\/login/);
  assert.equal(componentDiagram.confidence, "medium");
  assert.equal(componentDiagram.scope.focus, "component-boundaries");
  assert.match(classDiagram.content, /classDiagram/);
  assert.match(classDiagram.content, /SessionRecord/);
  assert.match(sequenceDiagram.content, /sequenceDiagram/);
  assert.match(sequenceDiagram.content, /Heuristic static sequence inferred/);
  assert.equal(sequenceDiagram.confidence, "medium");
  assert.equal(highLevel.scope.focus, "domain-overview");
});

test("diagram generator uses typed graph edges for symbol, component, and sequence diagrams", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  await writeTypedGraphFixture(repoRoot);
  const workspaceState = await buildWorkspaceState(repoRoot);
  const bundle = generateDiagramBundle({
    workspaceState,
    task: "refine AuthService contract",
  });
  const symbolGraph = bundle.diagrams.find((diagram) => diagram.type === DIAGRAM_TYPES.symbolGraph);
  const componentDiagram = bundle.diagrams.find((diagram) => diagram.type === DIAGRAM_TYPES.component);
  const sequenceDiagram = bundle.diagrams.find((diagram) => diagram.type === DIAGRAM_TYPES.sequence);

  assert.match(symbolGraph.content, /implements/);
  assert.match(symbolGraph.content, /calls/);
  assert.match(componentDiagram.content, /Component: auth\/service/);
  assert.match(componentDiagram.content, /calls/);
  assert.equal(componentDiagram.scope.focus, "component-boundaries");
  assert.match(sequenceDiagram.content, /authenticate calls loginUser/);
  assert.match(sequenceDiagram.content, /exercise loginUser/);
  assert.match(sequenceDiagram.content, /typed call paths/);
});

test("diagram generator prefers route-trace sequences when parsed HTTP routes are available", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const routeRoot = path.join(repoRoot, "app", "api", "login");
  await fs.mkdir(routeRoot, { recursive: true });
  await fs.writeFile(
    path.join(routeRoot, "route.ts"),
    [
      'import { loginUser } from "../../../src/auth/login";',
      "",
      "export async function GET() {",
      '  return loginUser("route-user");',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  const workspaceState = await buildWorkspaceState(repoRoot, { forceRescan: true });
  const bundle = generateDiagramBundle({
    workspaceState,
    task: "trace login api route",
  });
  const sequenceDiagram = bundle.diagrams.find((diagram) => diagram.type === DIAGRAM_TYPES.sequence);

  assert.equal(sequenceDiagram.inference_mode, "route-trace-heuristic");
  assert.match(sequenceDiagram.content, /Client->>route_1: GET \/api\/login/);
  assert.match(sequenceDiagram.content, /GET calls loginUser/);
  assert.match(sequenceDiagram.summary, /route trace/);
  assert.equal(sequenceDiagram.scope.route_count >= 1, true);
});

test("repository profile sync publishes diagrams and makes them readable by portal and admin shells", async (t) => {
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
  const syncResult = await syncRepositoryProfile({
    repoRoot,
    workspaceState,
    bundle,
    artifacts,
    slug: "sample-profile",
    portalRoot,
    adminRoot,
  });

  assert.equal(syncResult.profile_slug, "sample-profile");
  assert.ok(syncResult.synced_destinations.some((destination) => destination.kind === "portal"));
  assert.ok(syncResult.synced_destinations.some((destination) => destination.kind === "admin"));

  const portalProfile = await loadPortalRepositoryProfile("sample-profile", workspaceRoot);
  const adminProfile = await loadAdminRepositoryProfile("sample-profile", workspaceRoot);
  const portalWebProfile = JSON.parse(
    await fs.readFile(path.join(portalRoot, "public", "profiles", "sample-profile.json"), "utf8"),
  );
  const adminWebProfile = JSON.parse(
    await fs.readFile(path.join(adminRoot, "public", "profiles", "sample-profile.json"), "utf8"),
  );
  const portalIndex = JSON.parse(await fs.readFile(path.join(portalRoot, "public", "profiles", "index.json"), "utf8"));
  const serviceProfile = JSON.parse(
    await fs.readFile(
      path.join(workspaceRoot, "services", "api", "data", "profiles", "repositories", "sample-profile.json"),
      "utf8",
    ),
  );
  const workspaceIndex = JSON.parse(
    await fs.readFile(path.join(workspaceRoot, "services", "api", "data", "workspaces", "index.json"), "utf8"),
  );
  const portalWorkspaceIndex = JSON.parse(
    await fs.readFile(path.join(portalRoot, "public", "workspaces", "index.json"), "utf8"),
  );

  assert.equal(portalProfile.profile_slug, "sample-profile");
  assert.equal(adminProfile.profile_slug, "sample-profile");
  assert.equal(portalProfile.diagrams.length, 5);
  assert.ok(portalProfile.diagrams.some((diagram) => diagram.content.includes("flowchart LR")));
  assert.ok(portalProfile.diagrams.some((diagram) => diagram.type === DIAGRAM_TYPES.component));
  assert.ok(portalProfile.diagrams.every((diagram) => typeof diagram.confidence === "string"));
  assert.ok(portalProfile.diagrams.every((diagram) => typeof diagram.scope?.focus === "string"));
  assert.ok(adminProfile.diagrams.some((diagram) => diagram.content.includes("sequenceDiagram")));
  assert.equal(portalWebProfile.profile_slug, "sample-profile");
  assert.equal(adminWebProfile.profile_slug, "sample-profile");
  assert.equal(serviceProfile.profile_slug, "sample-profile");
  assert.equal(serviceProfile.workspace_slug, "sample-profile");
  assert.equal(portalWebProfile.repo_root, undefined);
  assert.ok(portalWebProfile.diagrams.some((diagram) => diagram.content.includes("flowchart LR")));
  assert.ok(portalWebProfile.diagrams.every((diagram) => typeof diagram.confidence === "string"));
  assert.ok(portalWebProfile.diagrams.every((diagram) => typeof diagram.scope?.focus === "string"));
  assert.equal(portalIndex.profiles.length, 1);
  assert.equal(portalIndex.profiles[0].profile_slug, "sample-profile");
  assert.equal(workspaceIndex.workspaces.length, 1);
  assert.equal(workspaceIndex.workspaces[0].workspace_slug, "sample-profile");
  assert.equal(workspaceIndex.workspaces[0].profile_available, true);
  assert.equal(portalWorkspaceIndex.workspaces[0].workspace_slug, "sample-profile");
});
