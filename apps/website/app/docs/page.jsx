import { DocsExplorerClient } from "../../components/DocsExplorerClient.jsx";
import { WebsiteDocsSidebar } from "../../components/WebsiteDocsSidebar.jsx";
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
      description="Try the CLI, scan one repo, connect MCP, configure model setup, sync reviewed artifacts, and understand what BeHeart is designed to protect."
      actions={[
        { label: "Try CLI", href: "/docs/v1/getting-started", primary: true },
        { label: "CLI Sync", href: "/docs/v1/cli-sync" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="teal"
      heroVariant="docs"
      aside={
        <div className="website-aside-stack">
          <p className="website-aside-copy">
            Docs are the operating manual for the local-first loop: install, scan, connect, sync, and prove value.
          </p>
          <div className="website-inline-stat">
            <span>{catalog.documents.length} guides</span>
            <span>{catalog.versions.length} version lane</span>
            <span>{catalog.latestVersion?.toUpperCase() ?? "V1"}</span>
          </div>
        </div>
      }
    >
      <div className="website-docs-layout">
        <WebsiteDocsSidebar documents={catalog.documents} activeHref="/docs" />
        <div className="website-docs-main">
          <WebsiteSection
            eyebrow="Docs explorer"
            title="Find the next setup or rollout step."
            description="Guides are short, versioned, and focused on the path from local CLI proof to portal adoption."
          >
            <DocsExplorerClient
              documents={catalog.documents}
              versions={catalog.versions}
              initialVersion={catalog.latestVersion ?? ""}
            />
          </WebsiteSection>

          <WebsiteSection
            eyebrow="Featured guides"
            title="Start with product purpose, install, and sync."
            description="Use these first when evaluating BeHeart on a real repository."
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
            title="Install, scan, inspect, then sync."
            description="The first proof stays close to the repo and creates artifacts the team can verify."
          >
            <div className="website-command-block">
              <span>Starter path</span>
              <strong>Run inside one repository</strong>
              <pre>{`npm install -g beheart
heart
heart models add-key --provider openai --api-key-stdin
heart doctor
heart scan
heart pack "add SSO login audit logging"
heart mcp tools
heart sync profile`}</pre>
            </div>
          </WebsiteSection>
        </div>
      </div>
    </WebsiteShell>
  );
}
