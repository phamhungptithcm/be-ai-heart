"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { listWebsiteServices } from "../src/services.js";

const SERVICE_ITEMS = Object.freeze(
  listWebsiteServices().map((service) => ({
    href: `/services/${service.slug}`,
    label: service.title,
    detail: service.subtitle,
  })),
);

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
  const [servicesOpen, setServicesOpen] = useState(false);
  const isServicesActive =
    pathname === "/services" || SERVICE_ITEMS.some((item) => isActivePath(pathname, item.href));
  const mobileNavId = "website-mobile-nav";

  useEffect(() => {
    setMobileOpen(false);
    setServicesOpen(false);
  }, [pathname]);

  return (
    <div className="website-nav-shell">
      <div className="website-nav-desktop">
        <nav className="website-nav" aria-label="Primary">
          <div
            className="website-nav-dropdown"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button
              type="button"
              className="website-nav-link website-nav-dropdown-trigger"
              data-active={isServicesActive}
              aria-expanded={servicesOpen}
              onClick={() => setServicesOpen((current) => !current)}
            >
              Services
              <span className="website-nav-caret" aria-hidden="true">
                <svg viewBox="0 0 12 8" fill="none">
                  <path d="M1 1.5 6 6.5 11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <div className="website-nav-menu" data-open={servicesOpen}>
              {SERVICE_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className="website-nav-menu-link">
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </Link>
              ))}
              <div className="website-nav-menu-footer">
                <Link href="/services">Browse all services</Link>
              </div>
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
        data-open={mobileOpen}
        aria-expanded={mobileOpen}
        aria-controls={mobileNavId}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        onClick={() => setMobileOpen((current) => !current)}
      >
        <strong className="website-nav-toggle-label">{mobileOpen ? "Close" : "Menu"}</strong>
        <svg className="website-nav-toggle-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d={mobileOpen ? "M4 4 12 12" : "M2.5 5H13.5"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d={mobileOpen ? "M12 4 4 12" : "M5.5 11H13.5"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div id={mobileNavId} className="website-nav-mobile" data-open={mobileOpen}>
        <div className="website-nav-mobile-group">
          <p>Services</p>
          {SERVICE_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="website-nav-mobile-link">
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </Link>
          ))}
          <Link href="/services" className="website-nav-mobile-link">
            <strong>All Services</strong>
            <span>See the full service map and how each offering fits together.</span>
          </Link>
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
