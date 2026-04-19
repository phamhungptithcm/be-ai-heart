import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { LeadCaptureForm } from "../../components/LeadCaptureForm.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Start Trial",
  description: "Start a self-serve or guided pilot for one repository and prove value before wider rollout.",
  path: "/start-trial",
  keywords: ["trial", "pilot", "CLI", "portal"],
});

export default function StartTrialPage() {
  return (
    <WebsiteShell
      eyebrow="Start Trial"
      title="Trial locally, then unlock the portal."
      description="The recommended customer path is local CLI adoption first, then repository sync, visual diagram review, and team workspace management in the portal."
      actions={[
        { label: "Install CLI", href: "/docs", primary: true },
        { label: "Book Demo", href: "/book-demo" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "docs", "sign-in", "start-trial", "book-demo"]}
      accent="amber"
      aside={<p className="website-aside-copy">Trials should prove token savings, diagram clarity, and project memory quality before wider rollout.</p>}
    >
      <WebsiteSection
        eyebrow="Trial motion"
        title="The first trial should be small enough to finish and strong enough to convince."
        description="The product should help a team prove local value first, then move toward shared portal visibility only after the signal is real."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Run the CLI</h3>
            <p>Index the repo, inspect the graph, and compile task-specific context packs.</p>
          </div>
          <div>
            <h3>Generate diagrams</h3>
            <p>Use symbol graph, high-level, class, and sequence diagrams to build stakeholder trust faster.</p>
          </div>
          <div>
            <h3>Sync into the portal</h3>
            <p>Once value is proven, the customer sees the project visually on the web and manages the workspace there.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="What success looks like"
        title="A credible trial ends with proof, not just setup."
        description="Use the trial to answer whether the heart is improving cost, reuse, and review quality on work the team already has."
      >
        <div className="website-checklist-grid">
          <article>
            <span>Week 1</span>
            <h3>Build project memory</h3>
            <ul>
              <li>Scan the repo and ingest core docs</li>
              <li>Generate high-level and class diagrams</li>
              <li>Confirm missing context warnings are understandable</li>
            </ul>
          </article>
          <article>
            <span>Week 2</span>
            <h3>Run a benchmark</h3>
            <ul>
              <li>Pick one real bug fix or feature task</li>
              <li>Compare baseline vs heart-assisted runs</li>
              <li>Review token, cleanup, and architecture adherence</li>
            </ul>
          </article>
          <article>
            <span>After proof</span>
            <h3>Unlock the portal</h3>
            <ul>
              <li>Publish profile and document artifacts</li>
              <li>Share benchmark evidence with the team</li>
              <li>Decide whether expansion is justified</li>
            </ul>
          </article>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="CLI path"
        title="The website should make the first commands obvious."
        description="Self-serve adoption falls apart when trial pages talk in concepts without showing the operator path."
      >
        <div className="website-command-block">
          <span>Starter path</span>
          <strong>Use one repo and keep the loop tight</strong>
          <pre>{`heart scan
heart overview
heart diagram generate class
heart benchmark compare baseline.json assisted.json
heart diagram sync --slug your-project`}</pre>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Start trial"
        title="Request a self-serve or guided pilot."
        description="Trial intake should capture the exact team size, repo count, and operating goal so follow-up stays grounded in the real rollout path."
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
