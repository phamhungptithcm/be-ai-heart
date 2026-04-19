"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminNavigationState } from "./AdminNav.jsx";

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

export function AdminShell({ title, description, children, eyebrow = "Internal Control Plane" }) {
  const pathname = usePathname() ?? "/";
  const [navOpen, setNavOpen] = useState(false);
  const navigation = getAdminNavigationState(pathname);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <main className="admin-app">
      <a className="admin-skip-link" href="#admin-main">
        Skip to content
      </a>
      <div className="admin-shell">
        <div className="admin-frame">
          <header className="admin-topbar" data-mobile-open={navOpen}>
            <div className="admin-topbar-main">
              <Link href="/" className="admin-brand" aria-label="BeHeart admin">
                <AdminMark />
                <div>
                  <strong>BeHeart Admin</strong>
                  <span>Owner analytics and platform control</span>
                </div>
              </Link>

              <nav className="admin-primary-nav" aria-label="Admin navigation">
                {navigation.groups.map((group) => (
                  <Link key={group.label} href={group.href} className="admin-primary-link" data-active={group.active}>
                    <span>{group.label}</span>
                    <small>{group.meta}</small>
                  </Link>
                ))}
              </nav>

              <div className="admin-topbar-actions">
                <Link href="/support" className="admin-toolbar-chip">
                  Support
                </Link>
                <Link href="/customers" className="admin-toolbar-chip">
                  Customers
                </Link>
                <Link href="/revenue" className="admin-toolbar-chip admin-toolbar-chip-primary">
                  Revenue
                </Link>
              </div>

              <button
                type="button"
                className="admin-nav-toggle"
                aria-expanded={navOpen}
                aria-label={navOpen ? "Collapse admin navigation" : "Expand admin navigation"}
                onClick={() => setNavOpen((current) => !current)}
              >
                <span />
                <span />
              </button>
            </div>

            <div className="admin-subnav-shell">
              <div className="admin-subnav-copy">
                <span>{navigation.activeGroup.eyebrow}</span>
                <strong>{navigation.activeGroup.description}</strong>
                <p>{navigation.activeGroup.summary}</p>
              </div>
              <nav className="admin-subnav" aria-label={`${navigation.activeGroup.label} pages`}>
                {navigation.activeGroup.items.map((item) => (
                  <Link key={item.href} href={item.href} className="admin-subnav-link" data-active={item.active}>
                    <strong>{item.label}</strong>
                    <small>{item.meta}</small>
                  </Link>
                ))}
              </nav>
            </div>

            <div className="admin-mobile-menu" data-open={navOpen}>
              {navigation.groups.map((group) => (
                <section key={group.label} className="admin-mobile-group">
                  <Link href={group.href} className="admin-mobile-group-link" data-active={group.active}>
                    <strong>{group.label}</strong>
                    <span>{group.meta}</span>
                  </Link>
                  <div className="admin-mobile-group-items">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} className="admin-mobile-item" data-active={item.active}>
                        <strong>{item.label}</strong>
                        <small>{item.meta}</small>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </header>

          <div className="admin-main">
            <header className="admin-toolbar">
              <div className="admin-toolbar-copy">
                <span>Operating split</span>
                <strong>Website acquires, portal proves value, admin protects revenue and reliability.</strong>
              </div>
              <div className="admin-toolbar-actions">
                <Link href="/support" className="admin-toolbar-chip">
                  Support
                </Link>
                <Link href="/customers" className="admin-toolbar-chip">
                  Customers
                </Link>
                <Link href="/revenue" className="admin-toolbar-chip admin-toolbar-chip-primary">
                  Revenue
                </Link>
              </div>
            </header>

            <section className="admin-page-header" id="admin-main">
              <div>
                <p className="admin-eyebrow">{eyebrow}</p>
                <h1>{title}</h1>
                <p>{description}</p>
              </div>
              <div className="admin-page-header-actions">
                <Link href="/customers" className="admin-button-link admin-button-link-primary">
                  Review customers
                </Link>
                <Link href="/ops-health" className="admin-button-link">
                  Check ops health
                </Link>
              </div>
            </section>

            <div className="admin-stack">{children}</div>
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
