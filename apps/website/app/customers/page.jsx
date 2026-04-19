import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { WebsiteInsightRail } from "../../components/WebsiteInsightRail.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Customers",
  description: "See which teams are the right fit for design partner pilots, SMB rollout, and benchmark-driven adoption.",
  path: "/customers",
  keywords: ["customers", "SMB", "design partner", "AI adoption"],
});

export default function CustomersPage() {
  return (
    <WebsiteShell
      eyebrow="Customers"
      title="The right early customer is a team that already feels AI waste."
      description="The strongest design partners are organizations that want AI speed but cannot afford uncontrolled token spend, duplicate work, or architecture drift."
      actions={[
        { label: "Book Demo", href: "/book-demo", primary: true },
        { label: "See Pricing", href: "/pricing" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="amber"
      aside={
        <WebsiteInsightRail
          eyebrow="ICP signal"
          title="The best design partners already feel AI waste in delivery."
          description="This page should behave like an early customer scorecard, not a generic testimonial wall."
          metrics={[
            { label: "Primary fit", value: "SMB teams", detail: "Need speed but cannot afford uncontrolled token burn." },
            { label: "Strong motion", value: "Design partner", detail: "Best when the team can run benchmarks on real tasks quickly." },
            { label: "Retention hook", value: "Visible ROI", detail: "Savings and cleaner output keep the product sticky." },
          ]}
          bars={[
            { label: "SMB engineering teams", value: 86, caption: "Most urgent mix of budget pressure and AI ambition", tone: "brand" },
            { label: "Consultancies and agencies", value: 68, caption: "Need repeatable context transfer across many repos", tone: "teal" },
            { label: "Growing product orgs", value: 74, caption: "Need governance and benchmark-backed rollout", tone: "cyan" },
          ]}
          notes={[
            { label: "What to add next", detail: "This surface should mature into case studies, benchmark proof, and fit-by-segment examples." },
            { label: "What to avoid", detail: "Testimonials without cost, governance, or reuse proof will make BeHeart feel generic." },
          ]}
        />
      }
    >
      <WebsiteSection title="Best-fit customer profile">
        <div className="website-detail-grid">
          <div>
            <h3>SMB engineering teams</h3>
            <p>They want faster delivery but do not have the budget to burn tokens or tolerate unstable AI output.</p>
          </div>
          <div>
            <h3>Consultancies and agencies</h3>
            <p>They need repeatable context transfer across many client repositories and many short-lived tasks.</p>
          </div>
          <div>
            <h3>Growing product orgs</h3>
            <p>They need one place to prove reuse, architecture discipline, and benchmark-backed rollout value.</p>
          </div>
        </div>
      </WebsiteSection>
    </WebsiteShell>
  );
}
