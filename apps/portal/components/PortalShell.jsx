"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getPortalNavigationState } from "./PortalNav.jsx";

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

export function PortalShell({ title, description, children, eyebrow = "Customer Workspace" }) {
  const pathname = usePathname() ?? "/";
  const [navOpen, setNavOpen] = useState(false);
  const navigation = getPortalNavigationState(pathname);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <main className="portal-app">
      <a className="portal-skip-link" href="#portal-main">
        Skip to content
      </a>
      <div className="portal-shell">
        <div className="portal-frame">
          <header className="portal-topbar" data-mobile-open={navOpen}>
            <div className="portal-topbar-main">
              <Link href="/" className="portal-brand" aria-label="BeHeart portal">
                <PortalMark />
                <div>
                  <strong>BeHeart Portal</strong>
                  <span>Customer workspace for AI delivery operations</span>
                </div>
              </Link>

              <nav className="portal-primary-nav" aria-label="Portal navigation">
                {navigation.groups.map((group) => (
                  <Link key={group.label} href={group.href} className="portal-primary-link" data-active={group.active}>
                    <span>{group.label}</span>
                    <small>{group.meta}</small>
                  </Link>
                ))}
              </nav>

              <div className="portal-topbar-actions">
                <Link href="/sign-in" className="portal-toolbar-chip">
                  Session
                </Link>
                <Link href="/billing" className="portal-toolbar-chip">
                  Billing
                </Link>
                <Link href="/benchmarks" className="portal-toolbar-chip portal-toolbar-chip-primary">
                  Benchmark ROI
                </Link>
              </div>

              <button
                type="button"
                className="portal-nav-toggle"
                aria-expanded={navOpen}
                aria-label={navOpen ? "Collapse portal navigation" : "Expand portal navigation"}
                onClick={() => setNavOpen((current) => !current)}
              >
                <span />
                <span />
              </button>
            </div>

            <div className="portal-subnav-shell">
              <div className="portal-subnav-copy">
                <span>{navigation.activeGroup.eyebrow}</span>
                <strong>{navigation.activeGroup.description}</strong>
                <p>{navigation.activeGroup.summary}</p>
              </div>
              <nav className="portal-subnav" aria-label={`${navigation.activeGroup.label} pages`}>
                {navigation.activeGroup.items.map((item) => (
                  <Link key={item.href} href={item.href} className="portal-subnav-link" data-active={item.active}>
                    <strong>{item.label}</strong>
                    <small>{item.meta}</small>
                  </Link>
                ))}
              </nav>
            </div>

            <div className="portal-mobile-menu" data-open={navOpen}>
              {navigation.groups.map((group) => (
                <section key={group.label} className="portal-mobile-group">
                  <Link href={group.href} className="portal-mobile-group-link" data-active={group.active}>
                    <strong>{group.label}</strong>
                    <span>{group.meta}</span>
                  </Link>
                  <div className="portal-mobile-group-items">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} className="portal-mobile-item" data-active={item.active}>
                        <strong>{item.label}</strong>
                        <small>{item.meta}</small>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </header>

          <div className="portal-main">
            <header className="portal-toolbar">
              <div className="portal-toolbar-copy">
                <span>Hosted boundary</span>
                <strong>CLI sync, web reads, and tenant session state stay behind the BeHeart API host.</strong>
              </div>
              <div className="portal-toolbar-actions">
                <Link href="/sign-in" className="portal-toolbar-chip">
                  Session
                </Link>
                <Link href="/documents" className="portal-toolbar-chip">
                  Documents
                </Link>
                <Link href="/benchmarks" className="portal-toolbar-chip portal-toolbar-chip-primary">
                  Benchmark ROI
                </Link>
              </div>
            </header>

            <section className="portal-page-header" id="portal-main">
              <div>
                <p className="portal-eyebrow">{eyebrow}</p>
                <h1>{title}</h1>
                <p>{description}</p>
              </div>
              <div className="portal-page-header-actions">
                <Link href="/repositories" className="portal-button-link portal-button-link-primary">
                  Open repositories
                </Link>
                <Link href="/usage" className="portal-button-link">
                  View savings
                </Link>
              </div>
            </section>

            <div className="portal-stack">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function PortalSection({ title, subtitle, children, eyebrow }) {
  return (
    <section className="portal-section">
      <div className="portal-section-head">
        <div>
          {eyebrow ? <p className="portal-section-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="portal-section-body">{children}</div>
    </section>
  );
}
