export const METRIC_SOURCE_TYPES = Object.freeze({
  repoArtifact: "repo_artifact",
  benchmarkArtifact: "benchmark_artifact",
  hostedTelemetry: "hosted_telemetry",
  externalIntegration: "external_integration",
});

export const PORTAL_ROLES = Object.freeze([
  "org_admin",
  "engineer",
  "finance_viewer",
  "security_viewer",
]);

export const ADMIN_ROLES = Object.freeze([
  "owner",
  "support_admin",
  "sales_ops",
  "customer_success",
  "engineering_admin",
]);

export const PORTAL_PERMISSIONS = Object.freeze({
  overviewRead: "portal.overview.read",
  repositoriesRead: "portal.repositories.read",
  documentsRead: "portal.documents.read",
  benchmarksRead: "portal.benchmarks.read",
  benchmarksWrite: "portal.benchmarks.write",
  usageRead: "portal.usage.read",
  billingRead: "portal.billing.read",
  teamAccessRead: "portal.team_access.read",
  teamAccessWrite: "portal.team_access.write",
  membersRead: "portal.team_access.read",
  membersWrite: "portal.team_access.write",
  policiesRead: "portal.policies.read",
  policiesWrite: "portal.policies.write",
  securityAuditRead: "portal.security_audit.read",
  securityRead: "portal.security_audit.read",
  sessionsRead: "portal.sessions.read",
  settingsRead: "portal.settings.read",
  settingsWrite: "portal.settings.write",
});

export const ADMIN_PERMISSIONS = Object.freeze({
  overviewRead: "admin.overview.read",
  customersRead: "admin.customers.read",
  supportRead: "admin.support.read",
  documentsRead: "admin.documents.read",
  benchmarksRead: "admin.benchmarks.read",
  revenueRead: "admin.revenue.read",
  opsHealthRead: "admin.ops_health.read",
  sessionsAuditRead: "admin.sessions_audit.read",
  sessionsRevoke: "admin.sessions.revoke",
  observabilityRead: "admin.observability.read",
  billingOpsRead: "admin.billing_ops.read",
});

const PORTAL_ROLE_PERMISSIONS = Object.freeze({
  org_admin: [
    PORTAL_PERMISSIONS.overviewRead,
    PORTAL_PERMISSIONS.repositoriesRead,
    PORTAL_PERMISSIONS.documentsRead,
    PORTAL_PERMISSIONS.benchmarksRead,
    PORTAL_PERMISSIONS.benchmarksWrite,
    PORTAL_PERMISSIONS.usageRead,
    PORTAL_PERMISSIONS.billingRead,
    PORTAL_PERMISSIONS.teamAccessRead,
    PORTAL_PERMISSIONS.teamAccessWrite,
    PORTAL_PERMISSIONS.policiesRead,
    PORTAL_PERMISSIONS.policiesWrite,
    PORTAL_PERMISSIONS.securityAuditRead,
    PORTAL_PERMISSIONS.sessionsRead,
    PORTAL_PERMISSIONS.settingsRead,
    PORTAL_PERMISSIONS.settingsWrite,
  ],
  engineer: [
    PORTAL_PERMISSIONS.overviewRead,
    PORTAL_PERMISSIONS.repositoriesRead,
    PORTAL_PERMISSIONS.documentsRead,
    PORTAL_PERMISSIONS.benchmarksRead,
    PORTAL_PERMISSIONS.benchmarksWrite,
    PORTAL_PERMISSIONS.usageRead,
    PORTAL_PERMISSIONS.policiesRead,
    PORTAL_PERMISSIONS.policiesWrite,
    PORTAL_PERMISSIONS.settingsRead,
  ],
  finance_viewer: [
    PORTAL_PERMISSIONS.overviewRead,
    PORTAL_PERMISSIONS.benchmarksRead,
    PORTAL_PERMISSIONS.usageRead,
    PORTAL_PERMISSIONS.billingRead,
  ],
  security_viewer: [
    PORTAL_PERMISSIONS.overviewRead,
    PORTAL_PERMISSIONS.securityAuditRead,
    PORTAL_PERMISSIONS.sessionsRead,
    PORTAL_PERMISSIONS.policiesRead,
  ],
});

const ADMIN_ROLE_PERMISSIONS = Object.freeze({
  owner: [
    ADMIN_PERMISSIONS.overviewRead,
    ADMIN_PERMISSIONS.customersRead,
    ADMIN_PERMISSIONS.supportRead,
    ADMIN_PERMISSIONS.documentsRead,
    ADMIN_PERMISSIONS.benchmarksRead,
    ADMIN_PERMISSIONS.revenueRead,
    ADMIN_PERMISSIONS.opsHealthRead,
    ADMIN_PERMISSIONS.sessionsAuditRead,
    ADMIN_PERMISSIONS.sessionsRevoke,
    ADMIN_PERMISSIONS.observabilityRead,
    ADMIN_PERMISSIONS.billingOpsRead,
  ],
  support_admin: [
    ADMIN_PERMISSIONS.overviewRead,
    ADMIN_PERMISSIONS.customersRead,
    ADMIN_PERMISSIONS.supportRead,
    ADMIN_PERMISSIONS.documentsRead,
    ADMIN_PERMISSIONS.benchmarksRead,
    ADMIN_PERMISSIONS.sessionsAuditRead,
    ADMIN_PERMISSIONS.sessionsRevoke,
  ],
  sales_ops: [
    ADMIN_PERMISSIONS.overviewRead,
    ADMIN_PERMISSIONS.customersRead,
    ADMIN_PERMISSIONS.benchmarksRead,
    ADMIN_PERMISSIONS.revenueRead,
    ADMIN_PERMISSIONS.billingOpsRead,
  ],
  customer_success: [
    ADMIN_PERMISSIONS.overviewRead,
    ADMIN_PERMISSIONS.customersRead,
    ADMIN_PERMISSIONS.supportRead,
    ADMIN_PERMISSIONS.documentsRead,
    ADMIN_PERMISSIONS.benchmarksRead,
    ADMIN_PERMISSIONS.sessionsAuditRead,
  ],
  engineering_admin: [
    ADMIN_PERMISSIONS.overviewRead,
    ADMIN_PERMISSIONS.customersRead,
    ADMIN_PERMISSIONS.documentsRead,
    ADMIN_PERMISSIONS.benchmarksRead,
    ADMIN_PERMISSIONS.opsHealthRead,
    ADMIN_PERMISSIONS.sessionsAuditRead,
    ADMIN_PERMISSIONS.observabilityRead,
  ],
});

const PORTAL_ROLE_ALIASES = Object.freeze({
  customer: "engineer",
  engineering_admin: "engineer",
  engineer: "engineer",
  member: "engineer",
  user: "engineer",
  finance_viewer: "finance_viewer",
  billing_admin: "finance_viewer",
  billing: "finance_viewer",
  finance: "finance_viewer",
  viewer: "finance_viewer",
  readonly: "finance_viewer",
  org_owner: "org_admin",
  org_admin: "org_admin",
  admin: "org_admin",
  security: "security_viewer",
});

const ADMIN_ROLE_ALIASES = Object.freeze({
  super_admin: "owner",
  admin: "owner",
  support: "support_admin",
  sales: "sales_ops",
  cs: "customer_success",
  engineering: "engineering_admin",
});

const ROLE_PRIORITIES = Object.freeze({
  portal: {
    org_admin: 100,
    engineer: 90,
    finance_viewer: 80,
    security_viewer: 70,
  },
  admin: {
    owner: 100,
    support_admin: 90,
    sales_ops: 80,
    customer_success: 70,
    engineering_admin: 60,
  },
});

export const PORTAL_NAVIGATION_GROUPS = Object.freeze([
  {
    label: "Workspace",
    href: "/",
    meta: "Repos, docs, sync",
    eyebrow: "Customer workspace",
    description: "One customer surface for repository memory, synced documents, and day-to-day delivery visibility.",
    summary: "Customers should understand what the heart currently knows, what is stale, and what is safe to expand.",
    items: [
      { href: "/", label: "Overview", meta: "Customer cockpit", icon: "overview", required_permission: PORTAL_PERMISSIONS.overviewRead },
      { href: "/repositories", label: "Repositories", meta: "Readiness and sync truth", icon: "repositories", required_permission: PORTAL_PERMISSIONS.repositoriesRead },
      { href: "/documents", label: "Documents", meta: "Business and technical memory", icon: "documents", required_permission: PORTAL_PERMISSIONS.documentsRead },
    ],
  },
  {
    label: "Value",
    href: "/benchmarks",
    meta: "ROI, usage, proof",
    eyebrow: "Value proof",
    description: "Benchmark evidence and usage truth stay close to the repository memory that produced them.",
    summary: "Teams need a clean answer to whether BeHeart is reducing token spend, review cleanup, and memory churn.",
    items: [
      { href: "/benchmarks", label: "Benchmarks", meta: "Scenario reports and run history", icon: "benchmarks", required_permission: PORTAL_PERMISSIONS.benchmarksRead },
      { href: "/usage", label: "Usage", meta: "Benchmark ROI vs metered usage", icon: "usage", required_permission: PORTAL_PERMISSIONS.usageRead },
      { href: "/billing", label: "Billing", meta: "Plan, seats, invoices", icon: "billing", required_permission: PORTAL_PERMISSIONS.billingRead },
    ],
  },
  {
    label: "Governance",
    href: "/team-access",
    meta: "Access, audit, settings",
    eyebrow: "Org governance",
    description: "Identity, tenant guardrails, security posture, and settings live here without leaking internal admin controls.",
    summary: "Customer governance should stay separate from day-to-day repo operations while still staying close to delivery evidence.",
    items: [
      { href: "/team-access", label: "Team & Access", meta: "Members, roles, sessions", icon: "access", required_permission: PORTAL_PERMISSIONS.teamAccessRead },
      { href: "/security-audit", label: "Security & Audit", meta: "Sessions, audit, exports", icon: "shield", required_permission: PORTAL_PERMISSIONS.securityAuditRead },
      { href: "/settings", label: "Settings", meta: "Org profile and integrations", icon: "settings", required_permission: PORTAL_PERMISSIONS.settingsRead },
    ],
  },
]);

export const ADMIN_NAVIGATION_GROUPS = Object.freeze([
  {
    label: "Operations",
    href: "/",
    meta: "Customers, support, memory",
    eyebrow: "Operating plane",
    description: "Admin exposes customer posture, support queues, and memory drift in one high-trust internal surface.",
    summary: "Internal staff should spot churn risk, sync problems, and support drag before they turn into revenue loss.",
    items: [
      { href: "/", label: "Overview", meta: "Internal cockpit", icon: "overview", required_permission: ADMIN_PERMISSIONS.overviewRead },
      { href: "/customers", label: "Customers", meta: "Accounts and readiness", icon: "customers", required_permission: ADMIN_PERMISSIONS.customersRead },
      { href: "/support", label: "Support", meta: "Queues and follow-through", icon: "support", required_permission: ADMIN_PERMISSIONS.supportRead },
      { href: "/documents", label: "Documents", meta: "Submissions and memory drift", icon: "documents", required_permission: ADMIN_PERMISSIONS.documentsRead },
      { href: "/benchmarks", label: "Benchmarks", meta: "Cross-customer ROI", icon: "benchmarks", required_permission: ADMIN_PERMISSIONS.benchmarksRead },
    ],
  },
  {
    label: "Operations Security",
    href: "/sessions-audit",
    meta: "Access and platform health",
    eyebrow: "Internal governance",
    description: "Sessions, auditability, and platform telemetry belong in internal admin only.",
    summary: "Access and observability controls must stay visible to internal operators without crossing the tenant boundary.",
    items: [
      { href: "/sessions-audit", label: "Sessions & Audit", meta: "Session registry and audit", icon: "shield", required_permission: ADMIN_PERMISSIONS.sessionsAuditRead },
      { href: "/observability", label: "Observability", meta: "Requests, metrics, alerts", icon: "pulse", required_permission: ADMIN_PERMISSIONS.observabilityRead },
      { href: "/ops-health", label: "Ops Health", meta: "Service and rollout risk", icon: "ops", required_permission: ADMIN_PERMISSIONS.opsHealthRead },
    ],
  },
  {
    label: "Commercial",
    href: "/revenue",
    meta: "Revenue, billing, retention",
    eyebrow: "Commercial control",
    description: "Expansion signals stay tied to benchmark proof, retention health, and account qualification.",
    summary: "Revenue and billing posture should be visible enough to act on without turning admin into a CRM clone.",
    items: [
      { href: "/revenue", label: "Revenue", meta: "Pipeline, conversion, retention", icon: "revenue", required_permission: ADMIN_PERMISSIONS.revenueRead },
      { href: "/billing-ops", label: "Billing Ops", meta: "Plan posture and entitlements", icon: "billing", required_permission: ADMIN_PERMISSIONS.billingOpsRead },
    ],
  },
]);

export const PORTAL_ROUTE_PERMISSIONS = Object.freeze({
  "/": PORTAL_PERMISSIONS.overviewRead,
  "/repositories": PORTAL_PERMISSIONS.repositoriesRead,
  "/documents": PORTAL_PERMISSIONS.documentsRead,
  "/benchmarks": PORTAL_PERMISSIONS.benchmarksRead,
  "/usage": PORTAL_PERMISSIONS.usageRead,
  "/billing": PORTAL_PERMISSIONS.billingRead,
  "/team-access": PORTAL_PERMISSIONS.teamAccessRead,
  "/security-audit": PORTAL_PERMISSIONS.securityAuditRead,
  "/settings": PORTAL_PERMISSIONS.settingsRead,
  "/members": PORTAL_PERMISSIONS.teamAccessRead,
  "/policies": PORTAL_PERMISSIONS.policiesRead,
  "/security": PORTAL_PERMISSIONS.securityAuditRead,
});

export const ADMIN_ROUTE_PERMISSIONS = Object.freeze({
  "/": ADMIN_PERMISSIONS.overviewRead,
  "/customers": ADMIN_PERMISSIONS.customersRead,
  "/support": ADMIN_PERMISSIONS.supportRead,
  "/documents": ADMIN_PERMISSIONS.documentsRead,
  "/benchmarks": ADMIN_PERMISSIONS.benchmarksRead,
  "/revenue": ADMIN_PERMISSIONS.revenueRead,
  "/ops-health": ADMIN_PERMISSIONS.opsHealthRead,
  "/sessions-audit": ADMIN_PERMISSIONS.sessionsAuditRead,
  "/observability": ADMIN_PERMISSIONS.observabilityRead,
  "/billing-ops": ADMIN_PERMISSIONS.billingOpsRead,
});

export function resolveActorAccess(actor = {}) {
  const surface = actor.surface === "admin" ? "admin" : "portal";
  const roles = canonicalizeRoles(surface, actor.roles ?? [actor.role]);
  const permissions = [
    ...new Set(
      roles.flatMap((role) =>
        surface === "admin"
          ? ADMIN_ROLE_PERMISSIONS[role] ?? []
          : PORTAL_ROLE_PERMISSIONS[role] ?? [],
      ),
    ),
  ].sort();
  const primaryRole = resolvePrimaryRole(surface, roles);

  return {
    ...actor,
    surface,
    roles,
    primary_role: primaryRole,
    role: primaryRole,
    permissions,
  };
}

export function actorHasPermission(actor, permission) {
  const resolved = resolveActorAccess(actor);
  return resolved.permissions.includes(String(permission ?? "").trim());
}

export function filterNavigationGroupsForActor(groups = [], actor) {
  return groups
    .map((group) => ({
      ...group,
      items: (group.items ?? []).filter(
        (item) => !item.required_permission || actorHasPermission(actor, item.required_permission),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

function canonicalizeRoles(surface, roles) {
  const aliasMap = surface === "admin" ? ADMIN_ROLE_ALIASES : PORTAL_ROLE_ALIASES;
  const allowedRoles = new Set(surface === "admin" ? ADMIN_ROLES : PORTAL_ROLES);

  return [
    ...new Set(
      normalizeArray(roles)
        .map((role) => String(role).trim().toLowerCase())
        .map((role) => aliasMap[role] ?? role)
        .filter((role) => allowedRoles.has(role)),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function resolvePrimaryRole(surface, roles) {
  const priorities = ROLE_PRIORITIES[surface];
  return (
    [...roles].sort((left, right) => {
      const delta =
        Number(priorities[right] ?? 0) - Number(priorities[left] ?? 0);
      return delta !== 0 ? delta : left.localeCompare(right);
    })[0] ?? ""
  );
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}
