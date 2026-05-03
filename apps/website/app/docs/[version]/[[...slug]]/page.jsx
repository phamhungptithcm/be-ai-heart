import Link from "next/link";
import { notFound } from "next/navigation";

import { DocsExplorerClient } from "../../../../components/DocsExplorerClient.jsx";
import { WebsiteDocsSidebar } from "../../../../components/WebsiteDocsSidebar.jsx";
import { WebsiteShell, WebsiteSection } from "../../../../components/WebsiteShell.jsx";
import { loadDocEntry, loadDocsCatalog } from "../../../../src/docs/index.js";
import { createWebsiteMetadata } from "../../../../src/metadata.js";

const MDX_COMPONENTS = {
  a: (props) => <a {...props} className="website-prose-link" />,
  pre: (props) => <pre {...props} className="website-prose-pre" />,
  code: ({ className, ...props }) => (
    <code
      {...props}
      className={className ? `${className} website-prose-code` : "website-prose-code"}
    />
  ),
  blockquote: (props) => <blockquote {...props} className="website-prose-quote" />,
  h2: (props) => <DocHeading as="h2" className="website-prose-heading" {...props} />,
  h3: (props) => <DocHeading as="h3" className="website-prose-subheading" {...props} />,
};

export async function generateStaticParams() {
  const catalog = await loadDocsCatalog();
  return [
    ...catalog.versions.map((version) => ({ version, slug: [] })),
    ...catalog.documents.map((document) => ({
      version: document.version,
      slug: document.slugSegments,
    })),
  ];
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const version = resolvedParams?.version ?? "";
  const slugSegments = resolvedParams?.slug ?? [];
  const catalog = await loadDocsCatalog();

  if (!slugSegments.length) {
    return createWebsiteMetadata({
      title: `${version.toUpperCase()} docs`,
      description: `Versioned documentation index for ${version.toUpperCase()} onboarding, sync, security, and benchmark guidance.`,
      path: `/docs/${version}`,
      keywords: ["docs", version, "project memory"],
    });
  }

  const document = catalog.documents.find(
    (entry) => entry.version === version && entry.slug === slugSegments.join("/"),
  );

  if (!document) {
    return createWebsiteMetadata({
      title: "Docs",
      description: "Versioned docs for onboarding, sync, security, and benchmark workflows.",
      path: "/docs",
    });
  }

  return createWebsiteMetadata({
    title: document.metadata.title,
    description: document.metadata.description,
    path: document.href,
    keywords: [...(document.metadata.keywords ?? []), document.version, "docs"],
  });
}

export default async function WebsiteDocEntryPage({ params }) {
  const resolvedParams = await params;
  const version = resolvedParams?.version ?? "";
  const slugSegments = resolvedParams?.slug ?? [];
  const catalog = await loadDocsCatalog();

  if (!catalog.versions.includes(version)) {
    notFound();
  }

  if (!slugSegments.length) {
    const versionDocuments = catalog.documents.filter((entry) => entry.version === version);
    return (
      <WebsiteShell
        eyebrow={`Docs · ${version.toUpperCase()}`}
        title={`${version.toUpperCase()} documentation`}
        description="Browse the current guide set for onboarding, benchmark proof, sync workflows, and hosted surface boundaries."
        actions={[
          { label: "Back to Docs", href: "/docs", primary: true },
          { label: "Start Trial", href: "/start-trial" },
        ]}
        nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
        accent="teal"
        heroVariant="docs"
        aside={<p className="website-aside-copy">Each version keeps the operator path stable while the product surface evolves.</p>}
      >
        <div className="website-docs-layout">
          <WebsiteDocsSidebar documents={versionDocuments} activeHref={`/docs/${version}`} />
          <div className="website-docs-main">
            <WebsiteSection
              eyebrow="Version index"
              title="Browse the current guide set."
              description="Use this versioned explorer when you want a stable link to onboarding, benchmark, security, or hosted platform guidance."
            >
              <DocsExplorerClient
                documents={versionDocuments}
                versions={[version]}
                initialVersion={version}
              />
            </WebsiteSection>
          </div>
        </div>
      </WebsiteShell>
    );
  }

  const document = await loadDocEntry({
    version,
    slugSegments,
  });

  if (!document) {
    notFound();
  }

  const Content = document.Content;
  const relatedDocuments = catalog.documents.filter(
    (entry) => entry.version === version && entry.slug !== document.slug,
  );

  return (
    <WebsiteShell
      eyebrow={`Docs · ${version.toUpperCase()}`}
      title={document.metadata.title}
      description={document.metadata.description}
      actions={[
        { label: "Back to Docs", href: "/docs", primary: true },
        { label: "Open Version", href: `/docs/${version}` },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="teal"
      heroVariant="docs"
      aside={
        <div className="website-doc-sidebar">
          <p className="website-aside-copy">
            {document.headings.length
              ? "Use the guide, copy the commands, and keep rollout decisions tied to reviewed artifacts."
              : "This guide is intentionally short and operational."}
          </p>
        </div>
      }
    >
      <section className="website-doc-article-shell">
        <div className="website-doc-breadcrumb">
          <Link href="/docs">Docs</Link>
          <span>/</span>
          <Link href={`/docs/${version}`}>{version.toUpperCase()}</Link>
          <span>/</span>
          <strong>{document.metadata.title}</strong>
        </div>

        <div className="website-doc-article website-doc-article-with-sidebar">
          <WebsiteDocsSidebar
            documents={catalog.documents.filter((entry) => entry.version === version)}
            activeHref={document.href}
          />
          <article className="website-prose">
            <Content components={MDX_COMPONENTS} />
          </article>

          <aside className="website-doc-related">
            {document.headings.length ? (
              <div className="website-doc-toc website-doc-toc-panel">
                <span>On this page</span>
                {document.headings.map((heading) => (
                  <a key={heading.slug} href={`#${heading.slug}`}>
                    {heading.title}
                  </a>
                ))}
              </div>
            ) : null}
            <span>Related</span>
            <div className="website-doc-related-list">
              {relatedDocuments.slice(0, 4).map((entry) => (
                <Link key={`${entry.version}:${entry.slug}`} href={entry.href}>
                  <strong>{entry.metadata.title}</strong>
                  <p>{entry.metadata.description}</p>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </WebsiteShell>
  );
}

function DocHeading({ as: Tag, children, id, ...props }) {
  const resolvedId = id ?? sanitizeHeading(children);
  return (
    <Tag {...props} id={resolvedId}>
      {children}
    </Tag>
  );
}

function sanitizeHeading(children) {
  return String(flattenHeading(children))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function flattenHeading(children) {
  if (Array.isArray(children)) {
    return children.map(flattenHeading).join(" ");
  }

  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (children && typeof children === "object" && "props" in children) {
    return flattenHeading(children.props.children);
  }

  return "";
}
