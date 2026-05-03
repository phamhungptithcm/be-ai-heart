import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_NAVIGATION_GROUPS,
  METRIC_SOURCE_TYPES,
  PORTAL_NAVIGATION_GROUPS,
  actorHasPermission,
  filterNavigationGroupsForActor,
  resolveActorAccess,
} from "../packages/shared-schema/src/enterprise.js";

test("portal additive RBAC resolves canonical roles, permissions, and visible navigation", () => {
  const actor = resolveActorAccess({
    actor_slug: "portal-engineering-finance",
    surface: "portal",
    roles: ["engineer", "finance_viewer"],
  });

  assert.deepEqual(actor.roles, ["engineer", "finance_viewer"]);
  assert.equal(actor.primary_role, "engineer");
  assert.equal(actorHasPermission(actor, "portal.repositories.read"), true);
  assert.equal(actorHasPermission(actor, "portal.billing.read"), true);
  assert.equal(actorHasPermission(actor, "portal.benchmarks.write"), true);
  assert.equal(actorHasPermission(actor, "portal.team_access.read"), false);
  assert.equal(actorHasPermission(actor, "portal.security.read"), false);
  assert.equal(actorHasPermission(actor, "admin.overview.read"), false);

  const visible = filterNavigationGroupsForActor(PORTAL_NAVIGATION_GROUPS, actor);

  assert.deepEqual(
    visible.flatMap((group) => group.items.map((item) => item.label)),
    [
      "Home",
      "Repositories",
      "Graph",
      "Diagrams",
      "Docs",
      "Context Packs",
      "Domain Packs",
      "Workspaces",
      "Workbench",
      "Models",
      "CLI / MCP",
      "Benchmarks",
      "Usage",
      "Billing",
      "Policies / Governance",
      "Settings",
    ],
  );
});

test("admin RBAC resolves least-privilege sales ops visibility", () => {
  const actor = resolveActorAccess({
    actor_slug: "sales-ops-admin",
    surface: "admin",
    roles: ["sales_ops"],
  });

  assert.deepEqual(actor.roles, ["sales_ops"]);
  assert.equal(actorHasPermission(actor, "admin.revenue.read"), true);
  assert.equal(actorHasPermission(actor, "admin.billing_ops.read"), true);
  assert.equal(actorHasPermission(actor, "admin.support.read"), false);
  assert.equal(actorHasPermission(actor, "admin.observability.read"), false);

  const visible = filterNavigationGroupsForActor(ADMIN_NAVIGATION_GROUPS, actor);

  assert.deepEqual(
    visible.flatMap((group) => group.items.map((item) => item.label)),
    ["Overview", "Customers", "Benchmarks", "Revenue", "Billing Ops"],
  );
});

test("enterprise metric source taxonomy stays explicit and finite", () => {
  assert.deepEqual(Object.values(METRIC_SOURCE_TYPES), [
    "repo_artifact",
    "benchmark_artifact",
    "hosted_telemetry",
    "external_integration",
  ]);
});
