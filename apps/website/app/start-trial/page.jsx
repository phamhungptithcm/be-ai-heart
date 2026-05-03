import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { LeadCaptureForm } from "../../components/LeadCaptureForm.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Start Trial",
  description: "Start a local CLI trial for one repository, then move into portal visibility, model setup, and benchmark proof when ready.",
  path: "/start-trial",
  keywords: ["trial", "CLI AI agent", "portal chat", "benchmark", "design partner"],
});

export default function StartTrialPage() {
  return (
    <WebsiteShell
      eyebrow="Start Trial"
      title="Try the CLI locally, then bring the team into the portal."
      description="The recommended path is one repo, local CLI memory, one context pack, one MCP connection, one benchmark report, then portal chat and model setup when the team needs shared visibility."
      actions={[
        { label: "Open Portal", href: "/sign-in", primary: true },
        { label: "Try CLI", href: "/docs/v1/getting-started" },
        { label: "Book demo", href: "/book-demo" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "docs", "sign-in", "start-trial", "book-demo"]}
      accent="amber"
      aside={<p className="website-aside-copy">Use the trial to prove memory quality, context pack usefulness, MCP readiness, and benchmark evidence before rollout.</p>}
    >
      <WebsiteSection
        eyebrow="Trial motion"
        title="Start small enough to finish."
        description="Prove local value first, then move toward shared portal visibility."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Run the CLI AI agent</h3>
            <p>Index the repo, choose a model, inspect readiness, and compile task-specific context packs.</p>
          </div>
          <div>
            <h3>Connect MCP</h3>
            <p>Expose repo memory to a supported AI client through narrow tool contracts and verify the handshake.</p>
          </div>
          <div>
            <h3>Sync into the portal</h3>
            <p>Once value is proven, the team sees repo memory, portal chat, model settings, benchmarks, and access controls.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="CLI path"
        title="The first commands are the product."
        description="Use one repository and keep the loop inspectable."
      >
        <div className="website-command-block">
          <span>Starter path</span>
          <strong>Use one repo and keep the loop tight</strong>
          <pre>{`npm install -g beheart
heart init
heart doctor
heart scan
heart pack "add SSO login audit logging"
heart login
heart sync setup --slug your-project --task "add SSO login audit logging"
heart models providers
heart connect doctor`}</pre>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Start trial"
        title="Request a self-serve or guided pilot."
        description="Share team size, repo count, and the proof you need."
      >
        <LeadCaptureForm
          intakeKind="trial"
          sourcePage="/start-trial"
          title="Start a trial request"
          description="Use this for smaller teams that want a fast self-serve pilot but still need the product owner to understand the repo and benchmark goal."
          submitLabel="Submit trial request"
          successTitle="Trial request received"
          successDescription="The trial request is now stored in the service host and visible to the internal admin team."
        />
      </WebsiteSection>
    </WebsiteShell>
  );
}
