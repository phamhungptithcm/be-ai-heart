"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getPortalNavigationState } from "./PortalNav.jsx";
import { fetchPortalJson } from "../src/api-client.js";
import {
  PORTAL_ROUTE_PERMISSIONS,
  actorHasPermission,
} from "../../../packages/shared-schema/src/enterprise.js";
import { BEHEART_RELEASE_VERSION } from "../../../packages/shared-schema/src/release.js";

function PortalMark() {
  return (
    <div className="portal-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function PortalIcon({ name }) {
  const icons = {
    overview: (
      <path d="M4 4h6v6H4zm10 0h6v9h-6zM4 14h6v6H4zm10 13H4v-9h10z" />
    ),
    repositories: (
      <path d="M6 5h16v6H6zm0 9h7v8H6zm10 0h6v8h-6zM4 3h20v22H4z" />
    ),
    documents: (
      <path d="M8 4h9l5 5v15H8zm8 1v5h5M11 14h8M11 18h8M11 22h6" />
    ),
    benchmarks: (
      <path d="M6 22V10m6 12V4m6 18v-8m6 8v-5M4 26h22" />
    ),
    usage: (
      <path d="M6 21c2-6 6-10 11-12 2 4 3 8 3 12-4 2-8 3-12 3-1 0-2-1-2-3Zm0 0 5-5" />
    ),
    billing: (
      <path d="M5 8h20v14H5zm0 4h20M10 18h4m3 0h4M8 5h14" />
    ),
    access: (
      <path d="M10 15V9a5 5 0 0 1 10 0v6m-12 0h14v11H8zm7 4v3" />
    ),
    policy: (
      <path d="M15 4 24 7v7c0 6-4.2 10.4-9 12-4.8-1.6-9-6-9-12V7zm-4.5 10 3 3 6-6" />
    ),
    shield: (
      <path d="M15 4 24 8v6c0 6-4.2 10.3-9 12-4.8-1.7-9-6-9-12V8zm0 6v5m0 4h.01" />
    ),
    settings: (
      <path d="m15 4 2 3 3.5-.2 1 3.3 3 1.6-1.6 3 1.6 3-3 1.6-1 3.3-3.5-.2-2 3-2-3-3.5.2-1-3.3-3-1.6 1.6-3-1.6-3 3-1.6 1-3.3 3.5.2zM15 11.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
    ),
  };

  return (
    <svg viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] ?? icons.overview}
    </svg>
  );
}

function PortalMenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PortalChevron() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PortalShell({
  title,
  description,
  children,
  eyebrow = "Customer Workspace",
  shellMode = "default",
  showToolbar = false,
  showHeaderActions = false,
}) {
  const pathname = usePathname() ?? "/";
  const [navOpen, setNavOpen] = useState(false);
  const [viewerActor, setViewerActor] = useState(null);
  const [viewerStatus, setViewerStatus] = useState("loading");
  const navigation = getPortalNavigationState(pathname, viewerActor);
  const allowAnonymousShell =
    pathname === "/sign-in" || pathname === "/auth/complete";
  const activePermission = resolveRoutePermission(pathname, PORTAL_ROUTE_PERMISSIONS);
  const isAccessDenied =
    viewerStatus === "ready" &&
    !allowAnonymousShell &&
    (!viewerActor ||
      (activePermission &&
        !actorHasPermission(navigation.actor, activePermission)));

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = navOpen ? "hidden" : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [navOpen]);

  useEffect(() => {
    let active = true;

    fetchPortalJson("/api/session", { allowMissing: true })
      .then((payload) => {
        if (!active) {
          return;
        }
        setViewerActor(payload.actor ?? null);
        setViewerStatus("ready");
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setViewerActor(null);
        setViewerStatus("ready");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="portal-app">
      <a className="portal-skip-link" href="#portal-main">
        Skip to content
      </a>
      <div className="portal-shell portal-shell-dashboard">
        <button
          type="button"
          className="portal-dashboard-overlay"
          data-open={navOpen}
          aria-hidden={!navOpen}
          tabIndex={navOpen ? 0 : -1}
          onClick={() => setNavOpen(false)}
        />

        <aside id="portal-main-navigation" className="portal-dashboard-sidebar" data-open={navOpen} aria-label="Portal navigation">
          <div className="portal-dashboard-sidebar-shell">
            <div className="portal-dashboard-sidebar-head">
              <Link href="/" className="portal-brand portal-brand-sidebar" aria-label="BeHeart portal">
                <PortalMark />
                <div>
                  <strong>BeHeart Portal</strong>
                  <span>Project memory for AI teams</span>
                  <small className="portal-brand-version">{`BeHeart ${BEHEART_RELEASE_VERSION}`}</small>
                </div>
              </Link>
              <button
                type="button"
                className="portal-dashboard-close"
                aria-label="Close portal navigation"
                onClick={() => setNavOpen(false)}
              >
                <span />
                <span />
              </button>
            </div>

            <section className="portal-sidebar-summary">
              <span>{navigation.activeGroup.label}</span>
              <strong>{navigation.activeItem.label}</strong>
              <p>{navigation.activeItem.meta}</p>
            </section>

            <div className="portal-sidebar-groups">
              {navigation.groups.map((group) => (
                <section key={group.label} className="portal-sidebar-group">
                  <div className="portal-sidebar-group-head">
                    <strong>{group.label}</strong>
                    <small>{group.meta}</small>
                  </div>
                  <div className="portal-sidebar-links">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} className="portal-sidebar-link" data-active={item.active}>
                        <span className="portal-sidebar-link-icon">
                          <PortalIcon name={item.icon} />
                        </span>
                        <span className="portal-sidebar-link-copy">
                          <strong>{item.label}</strong>
                          <small>{item.meta}</small>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="portal-sidebar-footer">
              <article>
                <span>Sync</span>
                <strong>CLI is the source of repo truth.</strong>
                <p>Portal shows the latest published artifacts.</p>
              </article>
              <div className="portal-sidebar-footer-actions">
                {actorHasPermission(navigation.actor, "portal.documents.read") ? (
                  <Link href="/documents" className="portal-toolbar-chip">
                    Documents
                  </Link>
                ) : null}
                {actorHasPermission(navigation.actor, "portal.billing.read") ? (
                  <Link href="/billing" className="portal-toolbar-chip portal-toolbar-chip-primary">
                    Billing
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <div className="portal-dashboard-workspace">
          <div className="portal-dashboard-topbar">
            <header className="portal-appbar">
              <div className="portal-appbar-leading">
                <button
                  type="button"
                  className="portal-sidebar-toggle"
                  aria-expanded={navOpen}
                  aria-controls="portal-main-navigation"
                  aria-label={navOpen ? "Collapse navigation" : "Expand navigation"}
                  onClick={() => setNavOpen((current) => !current)}
                >
                  <PortalMenuIcon />
                </button>
                <div className="portal-breadcrumbs">
                  <span>{navigation.activeGroup.label}</span>
                  <PortalChevron />
                  <strong>{navigation.activeItem.label}</strong>
                </div>
              </div>

              <div className="portal-appbar-trailing">
                <div className="portal-appbar-pill">
                  {viewerStatus === "loading"
                    ? "Loading"
                    : navigation.actor.primary_role
                      ? "Signed in"
                      : "Sign in"}
                </div>
              </div>
            </header>

            <div className="portal-context-tabs" aria-label={`${navigation.activeGroup.label} pages`}>
              {navigation.activeGroup.items.map((item) => (
                <Link key={item.href} href={item.href} className="portal-context-tab" data-active={item.active}>
                  <span className="portal-context-tab-icon">
                    <PortalIcon name={item.icon} />
                  </span>
                  <span className="portal-context-tab-copy">
                    <strong>{item.label}</strong>
                    <small>{item.meta}</small>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="portal-main" data-shell-mode={shellMode} id="portal-main">
            {isAccessDenied ? (
              <section className="portal-section">
                <div className="portal-section-head">
                  <div>
                    <p className="portal-section-eyebrow">
                      {viewerActor ? "Access denied" : "Sign-in required"}
                    </p>
                    <h2>
                      {viewerActor
                        ? "This portal page is outside your role scope."
                        : "Open a tenant-scoped portal session first."}
                    </h2>
                    <p>
                      {viewerActor
                        ? "Your role can only see the portal pages that match your org responsibilities."
                        : "Customer access stays tenant-scoped. Use hosted sign-in before opening workspace pages."}
                    </p>
                  </div>
                </div>
                <div className="portal-page-header-actions">
                  <Link href="/sign-in" className="portal-button-link portal-button-link-primary">
                    Sign in
                  </Link>
                  <Link href="/" className="portal-button-link">
                    Open allowed pages
                  </Link>
                </div>
              </section>
            ) : null}
            {showToolbar ? (
              <div className="portal-app-notice">
                <div>
                  <span>Hosted boundary</span>
                  <strong>Repository memory, benchmark proof, and customer access are served through one tenant-scoped workspace boundary.</strong>
                </div>
                <Link href="/repositories" className="portal-button-link">
                  Open repository inventory
                </Link>
              </div>
            ) : null}

            <section className="portal-page-header" data-shell-mode={shellMode}>
              <div>
                <p className="portal-eyebrow">{eyebrow}</p>
                <h1>{title}</h1>
                {description ? <p>{description}</p> : null}
              </div>
              {showHeaderActions ? (
                <div className="portal-page-header-actions">
                  {actorHasPermission(navigation.actor, "portal.repositories.read") ? (
                    <Link href="/repositories" className="portal-button-link portal-button-link-primary">
                      Open repositories
                    </Link>
                  ) : null}
                  {actorHasPermission(navigation.actor, "portal.usage.read") ? (
                    <Link href="/usage" className="portal-button-link">
                      View savings
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </section>

            <div className="portal-stack">{isAccessDenied ? null : children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function PortalSection({ title, subtitle, children, eyebrow }) {
  const hasHeader = Boolean(title || subtitle || eyebrow);
  return (
    <section className="portal-section">
      {hasHeader ? (
        <div className="portal-section-head">
          <div>
            {eyebrow ? <p className="portal-section-eyebrow">{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
      ) : null}
      <div className="portal-section-body">{children}</div>
    </section>
  );
}

function resolveRoutePermission(pathname, routePermissions) {
  return (
    Object.entries(routePermissions)
      .sort((left, right) => right[0].length - left[0].length)
      .find(([href]) =>
        href === "/"
          ? pathname === "/"
          : pathname === href || pathname.startsWith(`${href}/`),
      )?.[1] ?? ""
  );
}
