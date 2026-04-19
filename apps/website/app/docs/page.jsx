import { DocsExplorerClient } from "../../components/DocsExplorerClient.jsx";
import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { loadDocsCatalog } from "../../src/docs/index.js";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Docs",
  description: "Versioned MDX docs for onboarding, CLI sync, security posture, portal/admin boundaries, and benchmark operations.",
  path: "/docs",
  keywords: ["docs", "MDX", "CLI", "benchmark", "security"],
});

export default async function DocsPage() {
  const catalog = await loadDocsCatalog();
  const featuredDocuments = catalog.documents.slice(0, 3);

  return (
    <WebsiteShell
      eyebrow="Docs"
      title="Versioned docs for setup, proof, and governed rollout."
      description="The docs surface is file-backed, versioned, searchable, and written to help a team move from local CLI proof into portal adoption without vague sales language."
      actions={[
        { label: "Start Trial", href: "/start-trial", primary: true },
        { label: "Book Demo", href: "/book-demo" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="teal"
      aside={
        <div className="website-aside-stack">
          <p className="website-aside-copy">
            The docs are part of the product because smaller teams need clarity before they spend budget
            on AI tooling.
          </p>
          <div className="website-inline-stat">
            <span>{catalog.documents.length} guides</span>
            <span>{catalog.versions.length} version lane</span>
            <span>{catalog.latestVersion?.toUpperCase() ?? "V1"}</span>
          </div>
        </div>
      }
    >
      <WebsiteSection
        eyebrow="Docs explorer"
        title="Search the operator path before you talk to sales."
        description="Everything here is backed by MDX content so installation, sync, security, and benchmark guidance can evolve without rebuilding the information architecture."
      >
        <DocsExplorerClient
          documents={catalog.documents}
          versions={catalog.versions}
          initialVersion={catalog.latestVersion ?? ""}
        />
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Featured guides"
        title="Start with the shortest paths to trust."
        description="These guides cover the first pilot loop: CLI scan, sync, benchmark, and platform responsibilities."
      >
        <div className="website-doc-grid">
          {featuredDocuments.map((document) => (
            <article key={`${document.version}:${document.slug}`}>
              <span>{document.metadata.category}</span>
              <h3>{document.metadata.title}</h3>
              <p>{document.metadata.description}</p>
              <ul>
                {document.headings.slice(0, 3).map((heading) => (
                  <li key={`${document.slug}:${heading.slug}`}>{heading.title}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="CLI quickstart"
        title="Keep the first proof local, measurable, and easy to repeat."
        description="The best self-serve motion is still one repository, one benchmark, and one clear sync into the portal."
      >
        <div className="website-command-block">
          <span>Starter path</span>
          <strong>Scan, diagram, benchmark, then sync</strong>
          <pre>{`heart scan
heart overview
heart diagram generate high-level
heart benchmark compare baseline.json assisted.json
heart diagram sync --slug acme-billing`}</pre>
        </div>
      </WebsiteSection>
    </WebsiteShell>
  );
}
