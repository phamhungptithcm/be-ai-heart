const PORTAL_NAV_GROUPS = Object.freeze([
  {
    label: "Workspace",
    href: "/",
    meta: "Repos, docs, sync",
    eyebrow: "Customer workspace",
    description: "One customer surface for repository memory, synced documents, and day-to-day delivery visibility.",
    summary: "Customers should understand what the heart currently knows, what is stale, and what is safe to expand.",
    items: [
      { href: "/", label: "Overview", meta: "Customer cockpit" },
      { href: "/repositories", label: "Repositories", meta: "Profiles, diagrams, readiness" },
      { href: "/documents", label: "Documents", meta: "Business and technical memory" },
    ],
  },
  {
    label: "Value",
    href: "/benchmarks",
    meta: "ROI, usage, proof",
    eyebrow: "Value proof",
    description: "Benchmark evidence and savings reporting should stay close to the repository memory that produced them.",
    summary: "Teams need a clean answer to whether BeHeart is reducing token spend, review cleanup, and memory churn.",
    items: [
      { href: "/benchmarks", label: "Benchmarks", meta: "Scenario reports and run history" },
      { href: "/usage", label: "Usage", meta: "Token, money, memory" },
    ],
  },
  {
    label: "Account",
    href: "/billing",
    meta: "Seats, billing, access",
    eyebrow: "Account controls",
    description: "Commercial visibility, hosted session state, and account access live here without polluting the workspace.",
    summary: "Portal should make account administration feel separate from the customer’s technical delivery view.",
    items: [
      { href: "/billing", label: "Billing", meta: "Plan, seats, invoices" },
      { href: "/sign-in", label: "Access", meta: "Hosted auth and session" },
    ],
  },
]);

export function isPortalPathActive(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPortalNavigationState(pathname) {
  const groups = PORTAL_NAV_GROUPS.map((group) => ({
    ...group,
    active: group.items.some((item) => isPortalPathActive(pathname, item.href)),
    items: group.items.map((item) => ({
      ...item,
      active: isPortalPathActive(pathname, item.href),
    })),
  }));

  const activeGroup = groups.find((group) => group.active) ?? groups[0];

  return {
    groups,
    activeGroup,
  };
}
