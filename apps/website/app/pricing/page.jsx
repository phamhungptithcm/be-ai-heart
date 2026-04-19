import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { WebsiteInsightRail } from "../../components/WebsiteInsightRail.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Pricing",
  description: "Pricing that starts with local proof and expands only when benchmark-backed ROI is visible.",
  path: "/pricing",
  keywords: ["pricing", "SMB", "ROI", "trial"],
});

export default function PricingPage() {
  return (
    <WebsiteShell
      eyebrow="Pricing"
      title="Start with proof, expand only when the economics are clear."
      description="BeHeart pricing is built for teams that need AI efficiency without enterprise-size prompt waste or enterprise-size procurement too early."
      actions={[
        { label: "Start Trial", href: "/start-trial", primary: true },
        { label: "Book Demo", href: "/book-demo" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="amber"
      aside={
        <WebsiteInsightRail
          eyebrow="Commercial logic"
          title="Pricing should follow measurable savings, not precede them."
          description="The buyer needs enough proof to justify spend without jumping into heavy procurement too early."
          metrics={[
            { label: "Pilot path", value: "Local-first", detail: "One repo, one benchmark, one internal owner." },
            { label: "Expansion gate", value: "ROI visible", detail: "Upgrade when token, time, and cleanup improvements are real." },
            { label: "Support motion", value: "Self-serve to guided", detail: "Teams can start alone and pull in BeHeart later." },
          ]}
          bars={[
            { label: "SMB fit", value: 88, caption: "Best when AI spend needs guardrails early", tone: "brand" },
            { label: "Time to value", value: 72, caption: "Fastest through CLI + benchmark proof", tone: "teal" },
            { label: "Procurement drag", value: 28, caption: "Lower when the portal proves savings first", tone: "ink" },
          ]}
          notes={[
            { label: "Pricing signal", detail: "Portal reporting should make renewal and expansion feel earned, not upsold." },
            { label: "What buyers compare", detail: "Token spend, engineer cleanup time, and rollout risk are the three real competitors." },
          ]}
        />
      }
    >
      <WebsiteSection
        eyebrow="Commercial ladder"
        title="Packaging should feel cheaper than the AI waste it removes."
        description="The buyer has to see a clear path from local proof to team rollout without jumping straight into enterprise procurement."
      >
        <div className="website-plan-grid">
          <article className="website-plan-card">
            <span>Local</span>
            <h3>Free or low-friction trial</h3>
            <p>CLI-first onboarding for one repository, one benchmark, and one internal champion.</p>
            <ul>
              <li>Local scan and diagrams</li>
              <li>Single-team benchmark workflow</li>
              <li>Best for first proof of value</li>
            </ul>
          </article>
          <article className="website-plan-card">
            <span>Team</span>
            <h3>Portal workspace</h3>
            <p>Customer workspace, synced diagrams, repository visibility, and shared benchmark history.</p>
            <ul>
              <li>Workspace visibility and documents</li>
              <li>Usage and efficiency reporting</li>
              <li>Ideal for SMB teams scaling AI usage carefully</li>
            </ul>
          </article>
          <article className="website-plan-card">
            <span>Enterprise</span>
            <h3>Governance and support</h3>
            <p>Rollout assistance, security review, procurement support, and operational controls.</p>
            <ul>
              <li>Tenant controls and support lane</li>
              <li>Security and auditability posture</li>
              <li>Fit for multi-team or regulated environments</li>
            </ul>
          </article>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Buying criteria"
        title="Customers should buy for economic proof, clearer governance, and cleaner delivery."
        description="Price only makes sense when the team can connect spend to lower token waste, fewer duplicate changes, and better review outcomes."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Lower AI waste</h3>
            <p>Less repeated repo discovery and fewer oversized prompts across repeated tasks.</p>
          </div>
          <div>
            <h3>Cleaner changes</h3>
            <p>Better reuse and less architecture drift when the model already knows the project memory.</p>
          </div>
          <div>
            <h3>Operational clarity</h3>
            <p>Managers and engineers can inspect diagrams, benchmark history, and profile freshness in one place.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="What is visible"
        title="Keep benchmark, security, and support in the buying conversation."
        description="For smaller teams, trust and clarity are conversion features. Hiding them makes the product feel expensive and risky."
      >
        <div className="website-checklist-grid">
          <article>
            <span>Before upgrade</span>
            <h3>Show benchmark evidence</h3>
            <ul>
              <li>Token savings and cost delta</li>
              <li>Review cleanup change</li>
              <li>Context depth and memory retention</li>
            </ul>
          </article>
          <article>
            <span>Before rollout</span>
            <h3>Show security posture</h3>
            <ul>
              <li>Local-first adoption path</li>
              <li>Policy exclusions and sensitive-path controls</li>
              <li>Tenant-scoped sessions and hosted boundaries</li>
            </ul>
          </article>
          <article>
            <span>Before renewal</span>
            <h3>Show operational value</h3>
            <ul>
              <li>Portal visibility across repos</li>
              <li>Admin support and health signals</li>
              <li>Expansion tied to proven usage, not optimism</li>
            </ul>
          </article>
        </div>
      </WebsiteSection>
    </WebsiteShell>
  );
}
