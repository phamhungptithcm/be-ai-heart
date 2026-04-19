"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PLATFORM_ITEMS = Object.freeze([
  {
    href: "/product",
    label: "Platform overview",
    detail: "Heart memory, sync architecture, and role split",
  },
  {
    href: "/docs/v1/cli-sync",
    label: "CLI + MCP",
    detail: "Local-first sync and governed context delivery",
  },
  {
    href: "/security",
    label: "Security controls",
    detail: "Tenant scope, policy rails, and hosted trust boundary",
  },
  {
    href: "/docs/v1/portal-admin",
    label: "Portal + admin",
    detail: "Customer workspace and internal control plane",
  },
]);

const PRIMARY_LINKS = Object.freeze([
  { href: "/benchmark", label: "Benchmark" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/customers", label: "Customers" },
]);

const ACTION_LINKS = Object.freeze([
  { href: "/sign-in", label: "Sign in" },
  { href: "/book-demo", label: "Book demo" },
  { href: "/start-trial", label: "Start trial", primary: true },
]);

function isActivePath(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WebsiteHeaderNav() {
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const isPlatformActive = PLATFORM_ITEMS.some((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    setMobileOpen(false);
    setPlatformOpen(false);
  }, [pathname]);

  return (
    <div className="website-nav-shell">
      <div className="website-nav-desktop">
        <nav className="website-nav" aria-label="Primary">
          <div
            className="website-nav-dropdown"
            onMouseEnter={() => setPlatformOpen(true)}
            onMouseLeave={() => setPlatformOpen(false)}
          >
            <button
              type="button"
              className="website-nav-link website-nav-dropdown-trigger"
              data-active={isPlatformActive}
              aria-expanded={platformOpen}
              onClick={() => setPlatformOpen((current) => !current)}
            >
              Platform
              <span className="website-nav-caret" aria-hidden="true">
                <svg viewBox="0 0 12 8" fill="none">
                  <path d="M1 1.5 6 6.5 11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <div className="website-nav-menu" data-open={platformOpen}>
              {PLATFORM_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className="website-nav-menu-link">
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </Link>
              ))}
            </div>
          </div>
          {PRIMARY_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="website-nav-link" data-active={isActivePath(pathname, item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="website-header-actions" aria-label="Primary actions">
          {ACTION_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className={item.primary ? "primary" : ""} data-active={isActivePath(pathname, item.href)}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="website-nav-toggle"
        aria-expanded={mobileOpen}
        aria-label="Toggle navigation"
        onClick={() => setMobileOpen((current) => !current)}
      >
        <span />
        <span />
      </button>

      <div className="website-nav-mobile" data-open={mobileOpen}>
        <div className="website-nav-mobile-group">
          <p>Platform</p>
          {PLATFORM_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="website-nav-mobile-link">
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </Link>
          ))}
        </div>
        <div className="website-nav-mobile-group">
          <p>Explore</p>
          {PRIMARY_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="website-nav-mobile-link">
              <strong>{item.label}</strong>
            </Link>
          ))}
        </div>
        <div className="website-nav-mobile-actions">
          {ACTION_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className={item.primary ? "primary" : ""}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
