import Link from "next/link";

const CATEGORY_LABELS = Object.freeze({
  overview: "Overview",
  onboarding: "Install and start",
  operator: "CLI and sync",
  roi: "Benchmark ROI",
  trust: "Security",
  security: "Security",
  platform: "Portal and admin",
});

export function WebsiteDocsSidebar({ documents = [], activeHref = "" }) {
  const groups = documents.reduce((result, document) => {
    const category = document.metadata?.category ?? "guide";
    if (!result.has(category)) {
      result.set(category, []);
    }
    result.get(category).push(document);
    return result;
  }, new Map());

  return (
    <aside className="website-docs-sidebar" aria-label="Documentation navigation">
      <div className="website-docs-sidebar-head">
        <span>Docs</span>
        <strong>BeHeart guidebook</strong>
        <p>Install, understand, operate, benchmark, and govern the product from one place.</p>
      </div>
      <nav className="website-docs-sidebar-nav">
        {[...groups.entries()].map(([category, entries]) => (
          <div key={category} className="website-docs-sidebar-group">
            <p>{CATEGORY_LABELS[category] ?? category}</p>
            {entries.map((entry) => (
              <Link key={`${entry.version}:${entry.slug}`} href={entry.href} data-active={entry.href === activeHref}>
                <strong>{entry.metadata.title}</strong>
                <span>{entry.metadata.description}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
