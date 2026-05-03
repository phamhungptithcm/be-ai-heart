import Link from "next/link";
import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Pricing",
  description: "BeHeart packaging for local CLI proof, design partner pilots, team portal adoption, billing readiness, and enterprise governance.",
  path: "/pricing",
  keywords: ["pricing", "design partner", "billing readiness", "ROI", "AI coding governance"],
});

const pricingPlans = [
  {
    stage: "Free",
    name: "Local CLI",
    price: "$0",
    cadence: "per developer",
    description: "Prove project memory on one workstation before asking the team to buy anything.",
    cta: "Try CLI",
    href: "/docs/v1/getting-started",
    included: [
      "Local repo scan and overview",
      "Context packs and docs search",
      "Basic MCP tool setup",
      "Limited benchmark scenarios",
    ],
    bestFor: "Individual engineers and tech leads validating one repo.",
  },
  {
    stage: "Design partner",
    name: "Team Pilot",
    price: "Pilot quote",
    cadence: "guided engagement",
    description: "A focused pilot with portal visibility, model setup review, and a concrete benchmark readout.",
    cta: "Request pilot",
    href: "/book-demo",
    highlighted: true,
    included: [
      "Pilot-scoped seats and repositories",
      "Synced portal workspace",
      "Portal chat and model setup review",
      "Guided benchmark evidence review",
    ],
    bestFor: "SMB teams already using AI coding tools and needing proof.",
  },
  {
    stage: "Team",
    name: "Growth",
    price: "Team quote",
    cadence: "after pilot proof",
    description: "A broader rollout for teams that have validated the first repo and need operating visibility.",
    cta: "Plan rollout",
    href: "/book-demo",
    included: [
      "Team-scoped seats and repositories",
      "Benchmark history and ROI dashboard",
      "Governance and policy workspace",
      "Payment and billing readiness review",
      "Priority implementation support",
    ],
    bestFor: "Engineering managers standardizing AI-assisted delivery.",
  },
  {
    stage: "Enterprise",
    name: "Governance",
    price: "Custom",
    cadence: "annual or private deployment",
    description: "Custom procurement, security review, billing posture, and deployment support for serious rollout.",
    cta: "Contact sales",
    href: "/book-demo",
    included: [
      "Custom seats, repos, and benchmark engagement",
      "Admin, audit, retention, and export planning",
      "SSO/SAML, VPC, and private deployment review",
      "Dedicated support and rollout design",
    ],
    bestFor: "Mid-market and enterprise buyers with governance needs.",
  },
];

const serviceBundles = [
  ["Durable Project Memory", "/services/durable-project-memory"],
  ["CLI AI Agent", "/services/cli-ai-agent"],
  ["Web Portal And Chat", "/services/web-portal-chat"],
  ["MCP Runtime", "/services/mcp-runtime"],
  ["Domain Packs", "/services/domain-packs"],
  ["Benchmark ROI", "/services/benchmark-roi"],
  ["Governance And Enterprise Readiness", "/services/governance-enterprise-readiness"],
];

export default function PricingPage() {
  return (
    <WebsiteShell
      eyebrow="Pricing"
      title="Package BeHeart around the rollout stage you can prove."
      description="Start free with the CLI, add portal and benchmark proof for a design partner pilot, then expand into governed rollout when evidence and security review support it."
      actions={[
        { label: "Try CLI", href: "/docs/v1/getting-started", primary: true },
        { label: "Request pilot", href: "/book-demo" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="amber"
      aside={
        <div className="website-pricing-aside">
          <span>Package logic</span>
          <strong>Local proof first. Team payment after evidence.</strong>
          <p>Published packaging stays directional until a pilot defines seats, repos, model usage, billing needs, and deployment path.</p>
        </div>
      }
    >
      <WebsiteSection
        eyebrow="Plans"
        title="Pick the smallest package that proves the next decision."
        description="BeHeart pricing is tied to usage stage: local proof, team pilot, growth rollout, enterprise governance."
      >
        <div className="website-pricing-grid">
          {pricingPlans.map((plan) => (
            <article key={plan.name} className="website-pricing-card" data-highlighted={plan.highlighted ? "true" : "false"}>
              <div className="website-pricing-card-head">
                <span>{plan.stage}</span>
                <h3>{plan.name}</h3>
                <div className="website-price-line">
                  <strong>{plan.price}</strong>
                  <small>{plan.cadence}</small>
                </div>
                <p>{plan.description}</p>
              </div>
              <ul>
                {plan.included.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="website-pricing-best">{plan.bestFor}</p>
              <Link href={plan.href} className={plan.highlighted ? "primary" : ""}>
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="What you are buying"
        title="The paid product is a service bundle, not just a dashboard."
        description="Plans combine local tooling, hosted visibility, portal chat/model setup, benchmark evidence, billing readiness, and governance support."
      >
        <div className="website-bundle-row">
          {serviceBundles.map(([service, href]) => (
            <Link key={service} href={href}>
              {service}
            </Link>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Buying guardrails"
        title="Upgrade when the evidence is visible."
        description="Do not buy a bigger plan until the current stage shows useful memory, cleaner reuse, and credible benchmark evidence."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Before pilot</h3>
            <p>Show one repo scan, one context pack, one MCP connection, and one benchmark report.</p>
          </div>
          <div>
            <h3>Before growth</h3>
            <p>Show repeated team usage, docs freshness, policy warnings, and ROI trend history.</p>
          </div>
          <div>
            <h3>Before enterprise</h3>
            <p>Confirm SSO, retention, audit, export, billing provider, deployment, and support requirements.</p>
          </div>
        </div>
      </WebsiteSection>
    </WebsiteShell>
  );
}
