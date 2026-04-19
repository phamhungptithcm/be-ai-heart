import Link from "next/link";
import { WebsiteHeaderNav } from "./WebsiteHeaderNav.jsx";

function WebsiteMark() {
  return (
    <div className="website-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export function WebsiteShell({
  eyebrow,
  title,
  description,
  actions = [],
  nav = [],
  aside = null,
  accent = "teal",
  heroVariant = "compact",
  children,
}) {
  return (
    <main className={`website-page website-accent-${accent}`}>
      <div className="website-shell">
        <a className="website-skip-link" href="#website-main">
          Skip to content
        </a>
        <header className="website-header">
          <div className="website-header-shell">
            <Link href="/" className="website-brand" aria-label="BeHeart home">
              <WebsiteMark />
              <div>
                <strong>BeHeart</strong>
                <span>Project memory for AI software teams</span>
              </div>
            </Link>
            <WebsiteHeaderNav items={nav} />
          </div>
        </header>

        <div className="website-frame">
          <section className={`website-hero website-hero-${heroVariant}`} id="website-main">
            <div className={`website-copy website-copy-${heroVariant}`}>
              <p className="website-eyebrow">
                <span className="website-eyebrow-dot" />
                {eyebrow}
              </p>
              <h1>{title}</h1>
              <p className="website-description">{description}</p>
              <div className="website-actions">
                {actions.map((action) => (
                  <Link key={action.label} href={action.href} className={action.primary ? "primary" : ""}>
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
            <aside className={`website-aside website-aside-${heroVariant}`}>{aside}</aside>
          </section>

          <div className="website-body">{children}</div>
        </div>

        <footer className="website-footer">
          <div className="website-footer-shell">
            <div className="website-footer-brand">
              <WebsiteMark />
              <div>
                <strong>BeHeart</strong>
                <p>Code, documents, policy, and benchmark memory for AI-assisted delivery.</p>
              </div>
            </div>
            <div className="website-footer-links">
              <Link href="/product">Product</Link>
              <Link href="/benchmark">Benchmark</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/security">Security</Link>
              <Link href="/sign-in">Sign In</Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

export function WebsiteSection({ eyebrow, title, description, children }) {
  return (
    <section className="website-section">
      <div className="website-section-heading">
        {eyebrow ? <p className="website-section-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="website-section-content">{children}</div>
    </section>
  );
}
