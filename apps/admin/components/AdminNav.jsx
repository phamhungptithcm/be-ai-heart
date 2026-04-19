import {
  ADMIN_NAVIGATION_GROUPS,
  filterNavigationGroupsForActor,
  resolveActorAccess,
} from "../../../packages/shared-schema/src/enterprise.js";

export function isAdminPathActive(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAdminNavigationState(pathname, actor) {
  const hasActor = Boolean(actor);
  const resolvedActor = resolveActorAccess(
    actor ?? {
      surface: "admin",
      roles: [],
    },
  );
  const visibleGroups = filterNavigationGroupsForActor(
    ADMIN_NAVIGATION_GROUPS,
    resolvedActor,
  );
  const groups = (visibleGroups.length > 0
    ? visibleGroups
    : hasActor
      ? ADMIN_NAVIGATION_GROUPS
      : [createAnonymousAdminGroup(pathname)]
  ).map((group) => ({
    ...group,
    active: group.items.some((item) => isAdminPathActive(pathname, item.href)),
    items: group.items.map((item) => ({
      ...item,
      active: isAdminPathActive(pathname, item.href),
    })),
  }));

  const activeGroup = groups.find((group) => group.active) ?? groups[0];
  const activeItem =
    activeGroup.items.find((item) => item.active) ?? activeGroup.items[0];

  return {
    groups,
    activeGroup,
    activeItem,
    actor: resolvedActor,
  };
}

function createAnonymousAdminGroup(pathname) {
  return {
    label: "Access",
    href: pathname === "/auth/complete" ? "/auth/complete" : "/sign-in",
    meta: "Internal authentication required",
    eyebrow: "Internal control plane",
    description: "Admin pages require an authenticated internal role.",
    summary: "Sign in with an internal BeHeart admin account before loading customer, observability, or billing operations data.",
    items: [
      {
        href: pathname === "/auth/complete" ? "/auth/complete" : "/sign-in",
        label: pathname === "/auth/complete" ? "Auth Completion" : "Sign In",
        meta: "Open the internal admin session flow",
        icon: "overview",
      },
    ],
  };
}
