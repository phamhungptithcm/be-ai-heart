import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Product",
  description: "See how BeHeart connects CLI, MCP, portal, docs, diagrams, and policy-aware context into one AI operating layer.",
  path: "/product",
  keywords: ["CLI", "MCP", "portal", "project memory"],
});

export default function ProductPage() {
  return (
    <WebsiteShell
      eyebrow="Product"
      title="Turn a repo into a durable operating layer for AI."
      description="BeHeart connects project memory, diagrams, policy, portal visibility, and benchmark proof so AI work stays cheaper, cleaner, and easier to trust."
      actions={[
        { label: "Start Trial", href: "/start-trial", primary: true },
        { label: "See Benchmark", href: "/benchmark" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="teal"
      aside={<p className="website-aside-copy">The product is built to reduce repeated model discovery work before code generation begins.</p>}
    >
      <WebsiteSection title="Core product surfaces">
        <div className="website-split-grid">
          <article>
            <span>CLI</span>
            <h3>Index and compile</h3>
            <p>Scan code and project documents, inspect graph artifacts, and generate context packs or diagrams locally.</p>
          </article>
          <article>
            <span>MCP</span>
            <h3>Serve project memory</h3>
            <p>Expose symbol lookup, impact analysis, document search, and context pack workflows to AI tools through MCP.</p>
          </article>
          <article>
            <span>Portal</span>
            <h3>Review on the web</h3>
            <p>Synced repository profiles, benchmark history, and diagrams move into a customer-facing workspace after signup.</p>
          </article>
        </div>
      </WebsiteSection>
      <WebsiteSection title="Why this is different">
        <div className="website-detail-grid">
          <div>
            <h3>Not only code graph</h3>
            <p>Requirements, design docs, ADRs, and benchmark history belong in the same memory model.</p>
          </div>
          <div>
            <h3>Not only retrieval</h3>
            <p>Policy and reuse signals help steer the model toward cleaner architecture decisions.</p>
          </div>
          <div>
            <h3>Not only token savings</h3>
            <p>The target is cheaper, cleaner, and more reliable delivery, not just a smaller prompt.</p>
          </div>
        </div>
      </WebsiteSection>
    </WebsiteShell>
  );
}
