import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Security",
  description: "Understand local-first indexing, provider key handling, tenant-scoped access, MCP action safety, governance, and enterprise deployment boundaries.",
  path: "/security",
  keywords: ["security", "governance", "provider keys", "MCP safety", "enterprise deployment", "redaction"],
});

export default function SecurityPage() {
  return (
    <WebsiteShell
      eyebrow="Security"
      title="Local-first by default. Governed when synced."
      description="BeHeart is designed to show what stays in the repo, what can sync to the portal, how provider keys are handled, and which controls protect project memory."
      actions={[
        { label: "Read Security Docs", href: "/docs/v1/security-governance", primary: true },
        { label: "Book Demo", href: "/book-demo" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="teal"
      aside={<p className="website-aside-copy">Security copy avoids unsupported compliance claims. Enterprise controls such as SSO, advanced retention, and private deployment are reviewed per customer.</p>}
    >
      <WebsiteSection
        eyebrow="Trust boundaries"
        title="The source repo stays the first source of truth."
        description="Hosted surfaces show reviewed artifacts and status; they do not imply raw private source is mirrored by default."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Local-first indexing</h3>
            <p>Teams can scan, inspect, and benchmark locally before sharing anything with a hosted surface.</p>
          </div>
          <div>
            <h3>Selective publication</h3>
            <p>Portal sync focuses on repository profile, diagrams, docs freshness, policy posture, and benchmark evidence.</p>
          </div>
          <div>
            <h3>Separated surfaces</h3>
            <p>The website sells, the portal serves customers, and admin stays internal-only.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Model providers"
        title="Provider and API key setup is security-sensitive."
        description="Model selection and portal chat are useful only when provider exposure and secret handling are clear."
      >
        <div className="website-detail-grid">
          <div>
            <h3>CLI keys</h3>
            <p>CLI model keys stay local with user-only permissions or resolve from provider environment variables.</p>
          </div>
          <div>
            <h3>Portal keys</h3>
            <p>Hosted portal keys require encrypted server-side storage; API responses and UI state expose only masked key presence.</p>
          </div>
          <div>
            <h3>Provider exposure</h3>
            <p>Users see selected provider, model, preset, budget, and context source before data is sent to a model.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Controls"
        title="Governance is visible where work happens."
        description="Policy, role, and audit signals stay close to the repo and portal views that use them."
      >
        <div className="website-rail-list">
          <article>
            <span>MCP</span>
            <div>
              <h3>Allowlisted runtime actions</h3>
              <p>MCP and portal chat actions map to explicit BeHeart tools instead of arbitrary shell execution.</p>
            </div>
          </article>
          <article>
            <span>Access</span>
            <div>
              <h3>Tenant-scoped roles</h3>
              <p>Customer actors use portal roles; internal operators use separate admin roles.</p>
            </div>
          </article>
          <article>
            <span>Enterprise</span>
            <div>
              <h3>Deployment review path</h3>
              <p>SSO, RBAC, audit, retention, export, VPC, and on-prem needs are evaluation items until implemented and tested.</p>
            </div>
          </article>
        </div>
      </WebsiteSection>
    </WebsiteShell>
  );
}
