import {
  PORTAL_NAVIGATION_GROUPS,
  filterNavigationGroupsForActor,
  resolveActorAccess,
} from "../../../packages/shared-schema/src/enterprise.js";

export function isPortalPathActive(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPortalNavigationState(pathname, actor) {
  const hasActor = Boolean(actor);
  const resolvedActor = resolveActorAccess(
    actor ?? {
      surface: "portal",
      roles: [],
    },
  );
  const visibleGroups = filterNavigationGroupsForActor(
    PORTAL_NAVIGATION_GROUPS,
    resolvedActor,
  );
  const groups = (
    visibleGroups.length > 0
      ? visibleGroups
      : hasActor
        ? PORTAL_NAVIGATION_GROUPS
        : [createAnonymousPortalGroup(pathname)]
  ).map((group) => ({
    ...group,
    active: group.items.some((item) => isPortalPathActive(pathname, item.href)),
    items: group.items.map((item) => ({
      ...item,
      active: isPortalPathActive(pathname, item.href),
    })),
  }));

  const activeGroup = groups.find((group) => group.active) ?? groups[0];
  const activeItem = activeGroup.items.find((item) => item.active) ?? activeGroup.items[0];

  return {
    groups,
    activeGroup,
    activeItem,
    actor: resolvedActor,
  };
}

function createAnonymousPortalGroup(pathname) {
  return {
    label: "Access",
    href: pathname === "/auth/complete" ? "/auth/complete" : "/sign-in",
    meta: "Authentication required",
    eyebrow: "Customer workspace",
    description: "Portal pages require an authenticated tenant session.",
    summary: "Sign in with an allowed organization role to load tenant-scoped repository, billing, and audit data.",
    items: [
      {
        href: pathname === "/auth/complete" ? "/auth/complete" : "/sign-in",
        label: pathname === "/auth/complete" ? "Auth Completion" : "Sign In",
        meta: "Open the hosted portal session flow",
        icon: "overview",
      },
    ],
  };
}
