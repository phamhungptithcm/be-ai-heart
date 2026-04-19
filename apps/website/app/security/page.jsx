import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { WebsiteInsightRail } from "../../components/WebsiteInsightRail.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Security",
  description: "Understand local-first indexing, tenant-scoped access, policy controls, and how BeHeart treats project memory safely.",
  path: "/security",
  keywords: ["security", "governance", "tenant access", "redaction"],
});

export default function SecurityPage() {
  return (
    <WebsiteShell
      eyebrow="Security"
      title="Security is part of the product, not marketing garnish."
      description="Project memory only matters if customers can trust what is indexed, what is excluded, and how synced artifacts are handled."
      actions={[
        { label: "Read Docs", href: "/docs", primary: true },
        { label: "Book Demo", href: "/book-demo" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="teal"
      aside={
        <WebsiteInsightRail
          eyebrow="Trust boundary"
          title="Sensitive paths, redaction, and policy controls need visible boundaries."
          description="Security here should read like a system map: what stays local, what syncs, and what remains tenant-scoped."
          metrics={[
            { label: "Local-first start", value: "Yes", detail: "Index and validate value before any shared publication." },
            { label: "Portal scope", value: "Tenant-scoped", detail: "Customer-facing data is isolated from admin operations." },
            { label: "Control plane split", value: "3 surfaces", detail: "Website sells, portal proves, admin operates." },
          ]}
          bars={[
            { label: "Local indexing coverage", value: 92, caption: "Best trust story for first adoption", tone: "teal" },
            { label: "Policy exclusion readiness", value: 74, caption: "Sensitive paths and memory rules stay explicit", tone: "brand" },
            { label: "Shared-surface exposure", value: 22, caption: "Only the minimum artifacts should leave the local lane", tone: "ink" },
          ]}
          notes={[
            { label: "Enterprise concern", detail: "Customers need to know which artifacts become visible in portal or admin, and which never should." },
            { label: "Rollout story", detail: "Security pages convert better when they expose concrete boundaries instead of generic promises." },
          ]}
        />
      }
    >
      <WebsiteSection eyebrow="Security stance" title="Security should explain clear boundaries, not vague intent." description="The product earns trust when teams can see what stays local, what gets published, and which controls exist before shared rollout.">
        <div className="website-detail-grid">
          <div>
            <h3>Local-first indexing</h3>
            <p>Teams can start with local scans and validate value before syncing anything to a shared surface.</p>
          </div>
          <div>
            <h3>Selective context</h3>
            <p>Policy rules should exclude sensitive paths from prompts and visual profiles when needed.</p>
          </div>
          <div>
            <h3>Operational support</h3>
            <p>The admin surface exists so the owner can support customers without blurring public and internal responsibilities.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection eyebrow="Core controls" title="The hosted layer still needs visible control points." description="Enterprise credibility comes from naming the control plane clearly and making risk handling legible to buyers.">
        <div className="website-rail-list">
          <article>
            <span>Control 01</span>
            <div>
              <h3>Tenant-scoped sessions and access</h3>
              <p>Public website, customer portal, and internal admin should stay cleanly separated so customer data never rides through the wrong surface.</p>
            </div>
          </article>
          <article>
            <span>Control 02</span>
            <div>
              <h3>Selective memory publication</h3>
              <p>Not every indexed symbol or document belongs in every context pack, benchmark artifact, or synced diagram surface.</p>
            </div>
          </article>
          <article>
            <span>Control 03</span>
            <div>
              <h3>Traceable benchmark evidence</h3>
              <p>Customers need to understand what was measured, which scenario was used, and how the report reached its ROI summary.</p>
            </div>
          </article>
        </div>
      </WebsiteSection>

      <WebsiteSection eyebrow="Required next controls" title="Security roadmap for serious rollout" description="The security page should make upcoming gaps explicit so smaller teams can still trust the adoption path.">
        <div className="website-split-grid">
          <article>
            <span>Policy</span>
            <h3>Sensitive path exclusion</h3>
            <p>Define what can and cannot be loaded into AI context or synced into portal artifacts.</p>
          </article>
          <article>
            <span>Redaction</span>
            <h3>Document-safe extraction</h3>
            <p>Handle PDFs, DOCX files, and specs without leaking content that should stay out of prompts.</p>
          </article>
          <article>
            <span>Audit</span>
            <h3>Traceable benchmark runs</h3>
            <p>Customers need evidence for what was measured, not just headline numbers.</p>
          </article>
        </div>
      </WebsiteSection>
    </WebsiteShell>
  );
}
