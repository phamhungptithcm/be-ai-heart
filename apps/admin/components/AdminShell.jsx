"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminNavigationState } from "./AdminNav.jsx";
import { fetchAdminJson } from "../src/api-client.js";
import {
  ADMIN_ROUTE_PERMISSIONS,
  actorHasPermission,
} from "../../../packages/shared-schema/src/enterprise.js";
import { BEHEART_RELEASE_VERSION } from "../../../packages/shared-schema/src/release.js";

function AdminMark() {
  return (
    <div className="admin-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function AdminIcon({ name }) {
  const icons = {
    overview: (
      <path d="M4 4h6v6H4zm10 0h6v9h-6zM4 14h6v6H4zm10 2h6v10h-6z" />
    ),
    customers: (
      <path d="M10 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM4 25c0-4 3.5-7 8-7s8 3 8 7M17 25c.5-2.7 2.8-4.8 6-5.4" />
    ),
    support: (
      <path d="M15 24v3m-7-9H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 6v-6Zm2-8h6m-10 4h10" />
    ),
    documents: (
      <path d="M8 4h9l5 5v15H8zm8 1v5h5M11 14h8M11 18h8M11 22h6" />
    ),
    benchmarks: (
      <path d="M6 22V10m6 12V4m6 18v-8m6 8v-5M4 26h22" />
    ),
    revenue: (
      <path d="M8 8h14M8 14h14M8 20h14M4 8h.01M4 14h.01M4 20h.01M21 4v20" />
    ),
    ops: (
      <path d="M15 5v5m0 10v5M7.9 7.9l3.5 3.5m7.2 7.2 3.5 3.5M5 15h5m10 0h5M7.9 22.1l3.5-3.5m7.2-7.2 3.5-3.5" />
    ),
    shield: (
      <path d="M15 4 24 8v6c0 6-4.2 10.3-9 12-4.8-1.7-9-6-9-12V8zm0 6v5m0 4h.01" />
    ),
    pulse: (
      <path d="M4 16h5l2.5-6 4 12 2.5-6H26M4 8h22M4 24h22" />
    ),
    billing: (
      <path d="M5 8h20v14H5zm0 4h20M10 18h4m3 0h4M8 5h14" />
    ),
  };

  return (
    <svg viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] ?? icons.overview}
    </svg>
  );
}

function AdminMenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AdminChevron() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AdminShell({
  title,
  description,
  children,
  eyebrow = "Internal Control Plane",
  shellMode = "default",
  showToolbar = true,
}) {
  const pathname = usePathname() ?? "/";
  const [navOpen, setNavOpen] = useState(false);
  const [viewerActor, setViewerActor] = useState(null);
  const [viewerStatus, setViewerStatus] = useState("loading");
  const navigation = getAdminNavigationState(pathname, viewerActor);
  const allowAnonymousShell =
    pathname === "/sign-in" || pathname === "/auth/complete";
  const activePermission = resolveRoutePermission(pathname, ADMIN_ROUTE_PERMISSIONS);
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

    fetchAdminJson("/api/session", { allowMissing: true })
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
    <main className="admin-app">
      <a className="admin-skip-link" href="#admin-main">
        Skip to content
      </a>
      <div className="admin-shell admin-shell-dashboard">
        <button
          type="button"
          className="admin-dashboard-overlay"
          data-open={navOpen}
          aria-hidden={!navOpen}
          tabIndex={navOpen ? 0 : -1}
          onClick={() => setNavOpen(false)}
        />

        <aside id="admin-main-navigation" className="admin-dashboard-sidebar" data-open={navOpen} aria-label="Admin navigation">
          <div className="admin-dashboard-sidebar-shell">
            <div className="admin-dashboard-sidebar-head">
              <Link href="/" className="admin-brand admin-brand-sidebar" aria-label="BeHeart admin">
                <AdminMark />
                <div>
                  <strong>BeHeart Admin</strong>
                  <span>Owner analytics and platform control</span>
                  <small className="admin-brand-version">{`BeHeart ${BEHEART_RELEASE_VERSION}`}</small>
                </div>
              </Link>
              <button
                type="button"
                className="admin-dashboard-close"
                aria-label="Close admin navigation"
                onClick={() => setNavOpen(false)}
              >
                <span />
                <span />
              </button>
            </div>

            <section className="admin-sidebar-summary">
              <span>{navigation.activeGroup.eyebrow}</span>
              <strong>{navigation.activeGroup.description}</strong>
              <p>{navigation.activeGroup.summary}</p>
            </section>

            <div className="admin-sidebar-groups">
              {navigation.groups.map((group) => (
                <section key={group.label} className="admin-sidebar-group">
                  <div className="admin-sidebar-group-head">
                    <strong>{group.label}</strong>
                    <small>{group.meta}</small>
                  </div>
                  <div className="admin-sidebar-links">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} className="admin-sidebar-link" data-active={item.active}>
                        <span className="admin-sidebar-link-icon">
                          <AdminIcon name={item.icon} />
                        </span>
                        <span className="admin-sidebar-link-copy">
                          <strong>{item.label}</strong>
                          <small>{item.meta}</small>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="admin-sidebar-footer">
              <article>
                <span>Control lane</span>
                <strong>Revenue + support + ops</strong>
                <p>Commercial proof, platform risk, and customer pressure are tracked in one owner-facing workspace.</p>
              </article>
              <div className="admin-sidebar-footer-actions">
                {actorHasPermission(navigation.actor, "admin.support.read") ? (
                  <Link href="/support" className="admin-toolbar-chip">
                    Support
                  </Link>
                ) : null}
                {actorHasPermission(navigation.actor, "admin.revenue.read") ? (
                  <Link href="/revenue" className="admin-toolbar-chip admin-toolbar-chip-primary">
                    Revenue
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <div className="admin-dashboard-workspace">
          <div className="admin-dashboard-topbar">
            <header className="admin-appbar">
              <div className="admin-appbar-leading">
                <button
                  type="button"
                  className="admin-sidebar-toggle"
                  aria-expanded={navOpen}
                  aria-controls="admin-main-navigation"
                  aria-label={navOpen ? "Collapse navigation" : "Expand navigation"}
                  onClick={() => setNavOpen((current) => !current)}
                >
                  <AdminMenuIcon />
                </button>
                <div className="admin-breadcrumbs">
                  <span>{navigation.activeGroup.label}</span>
                  <AdminChevron />
                  <strong>{navigation.activeItem.label}</strong>
                </div>
              </div>

              <div className="admin-appbar-trailing">
                <div className="admin-appbar-pill">
                  {viewerStatus === "loading"
                    ? "Loading access"
                    : navigation.actor.primary_role || "Sign-in required"}
                </div>
                <div className="admin-appbar-actions">
                  <span className="admin-appbar-pill">Scoped filters live inside each page</span>
                  {actorHasPermission(navigation.actor, "admin.customers.read") ? (
                    <Link href="/customers" className="admin-toolbar-chip">
                      Customers
                    </Link>
                  ) : null}
                  {actorHasPermission(navigation.actor, "admin.support.read") ? (
                    <Link href="/support" className="admin-toolbar-chip admin-toolbar-chip-primary">
                      Support
                    </Link>
                  ) : null}
                </div>
              </div>
            </header>

            <div className="admin-context-tabs" aria-label={`${navigation.activeGroup.label} pages`}>
              {navigation.activeGroup.items.map((item) => (
                <Link key={item.href} href={item.href} className="admin-context-tab" data-active={item.active}>
                  <span className="admin-context-tab-icon">
                    <AdminIcon name={item.icon} />
                  </span>
                  <span className="admin-context-tab-copy">
                    <strong>{item.label}</strong>
                    <small>{item.meta}</small>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="admin-main" data-shell-mode={shellMode} id="admin-main">
            {isAccessDenied ? (
              <section className="admin-section">
                <div className="admin-section-head">
                  <div>
                    <p className="admin-section-eyebrow">
                      {viewerActor ? "Access denied" : "Sign-in required"}
                    </p>
                    <h2>
                      {viewerActor
                        ? "This control-plane page is outside your internal role scope."
                        : "Open an internal admin session first."}
                    </h2>
                    <p>
                      {viewerActor
                        ? "Internal RBAC is additive but least-privilege. Use a role with the matching operational scope."
                        : "Admin is internal-only. Use hosted sign-in before opening control-plane pages."}
                    </p>
                  </div>
                </div>
                <div className="admin-page-header-actions">
                  <Link href="/sign-in" className="admin-button-link admin-button-link-primary">
                    Sign in
                  </Link>
                  <Link href="/" className="admin-button-link">
                    Open allowed pages
                  </Link>
                </div>
              </section>
            ) : null}
            {showToolbar ? (
              <div className="admin-app-notice">
                <div>
                  <span>Operating split</span>
                  <strong>Admin tracks supportability, revenue posture, and rollout risk without leaking customer-private controls into the public website.</strong>
                </div>
                <Link href="/customers" className="admin-button-link">
                  Open customer inventory
                </Link>
              </div>
            ) : null}

            <section className="admin-page-header" data-shell-mode={shellMode}>
              <div>
                <p className="admin-eyebrow">{eyebrow}</p>
                <h1>{title}</h1>
                <p>{description}</p>
              </div>
              <div className="admin-page-header-actions">
                {actorHasPermission(navigation.actor, "admin.customers.read") ? (
                  <Link href="/customers" className="admin-button-link admin-button-link-primary">
                    Review customers
                  </Link>
                ) : null}
                {actorHasPermission(navigation.actor, "admin.ops_health.read") ? (
                  <Link href="/ops-health" className="admin-button-link">
                    Check ops health
                  </Link>
                ) : null}
              </div>
            </section>

            <div className="admin-stack">{isAccessDenied ? null : children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function AdminSection({ title, subtitle, children, eyebrow }) {
  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          {eyebrow ? <p className="admin-section-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="admin-section-body">{children}</div>
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
