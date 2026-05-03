import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { LeadCaptureForm } from "../../components/LeadCaptureForm.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Book Demo",
  description: "Request a design partner call or working demo for repo memory, CLI agent workflows, portal chat, domain packs, and benchmark ROI.",
  path: "/book-demo",
  keywords: ["demo", "design partner", "CLI agent", "portal chat", "tolling demo kit", "benchmark proof"],
});

export default function BookDemoPage() {
  return (
    <WebsiteShell
      eyebrow="Book Demo"
      title="Request a focused design partner demo."
      description="Use one repository, one AI workflow, one domain pack or portal flow, and one benchmark question so the session produces usable evidence."
      actions={[
        { label: "Book demo", href: "#request-demo", primary: true },
        { label: "Tolling kit", href: "/domain-demo-kits/tolling-management" },
        { label: "Pricing", href: "/pricing" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="amber"
      aside={<p className="website-aside-copy">A useful demo shows durable repo memory, model choice, portal visibility, security boundaries, and benchmark evidence without unsupported ROI claims.</p>}
    >
      <WebsiteSection
        eyebrow="Demo scope"
        title="Keep the demo concrete."
        description="Choose one path so the buyer sees a complete workflow instead of a feature tour."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Developer local workflow</h3>
            <p>Show heart scan, context pack generation, CLI AI agent chat, MCP setup, and one benchmark run.</p>
          </div>
          <div>
            <h3>Team portal workflow</h3>
            <p>Show synced repo memory, portal chat and model selection, context preview, usage, access, and benchmark history.</p>
          </div>
          <div>
            <h3>Domain pack demo workflow</h3>
            <p>Show the Tolling Management pack and Tolling Sales MVP Demo Kit with demo-only data and source-backed boundaries.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Request demo"
        title="Submit one concrete pilot request."
        description="Focus on one repository, one buyer concern, and one benchmark or domain-pack outcome."
      >
        <div id="request-demo" />
        <LeadCaptureForm
          intakeKind="demo"
          sourcePage="/book-demo"
          title="Book a guided working demo"
          description="Tell us which repository to use, who needs confidence, and what proof the session must produce."
          submitLabel="Submit demo request"
          successTitle="Demo request received"
          successDescription="The request is now visible in admin for qualification, revenue tracking, and guided follow-up."
        />
      </WebsiteSection>
    </WebsiteShell>
  );
}
