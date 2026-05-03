import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
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
        <div className="website-aside-stack">
          <p className="website-aside-copy">Best fit: teams already paying for AI but still repeating repo discovery and review cleanup.</p>
          <div className="website-inline-stat">
            <span>SMB</span>
            <span>Design partner</span>
            <span>ROI proof</span>
          </div>
        </div>
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
