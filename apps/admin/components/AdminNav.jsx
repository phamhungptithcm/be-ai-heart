const ADMIN_NAV_GROUPS = Object.freeze([
  {
    label: "Operations",
    href: "/",
    meta: "Customers, support, memory",
    eyebrow: "Operating plane",
    description: "Admin should expose customer posture, support queues, and memory drift in one high-trust operating surface.",
    summary: "The owner needs to spot churn risk, sync problems, and support drag before they turn into revenue loss.",
    items: [
      { href: "/", label: "Overview", meta: "Owner cockpit" },
      { href: "/customers", label: "Customers", meta: "Accounts and repository footprint" },
      { href: "/support", label: "Support", meta: "Queues and follow-through" },
      { href: "/documents", label: "Documents", meta: "Submissions and memory drift" },
    ],
  },
  {
    label: "Commercial",
    href: "/revenue",
    meta: "Revenue, ROI, growth",
    eyebrow: "Commercial control",
    description: "Expansion signals should stay tied to benchmark proof, retention health, and account qualification.",
    summary: "Admin is where pricing confidence, renewal risk, and sales readiness become visible enough to act on.",
    items: [
      { href: "/benchmarks", label: "Benchmarks", meta: "Cross-customer ROI" },
      { href: "/revenue", label: "Revenue", meta: "Pipeline, MRR, retention" },
      { href: "/ops-health", label: "Ops health", meta: "Service and rollout risk" },
    ],
  },
]);

export function isAdminPathActive(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAdminNavigationState(pathname) {
  const groups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    active: group.items.some((item) => isAdminPathActive(pathname, item.href)),
    items: group.items.map((item) => ({
      ...item,
      active: isAdminPathActive(pathname, item.href),
    })),
  }));

  const activeGroup = groups.find((group) => group.active) ?? groups[0];

  return {
    groups,
    activeGroup,
  };
}
