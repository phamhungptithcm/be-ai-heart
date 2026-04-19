import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { LeadCaptureForm } from "../../components/LeadCaptureForm.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Book Demo",
  description: "Submit a concrete repository pilot request and use a working demo to prove project memory, diagrams, and benchmark ROI.",
  path: "/book-demo",
  keywords: ["demo", "pilot", "repository", "benchmark proof"],
});

export default function BookDemoPage() {
  return (
    <WebsiteShell
      eyebrow="Book Demo"
      title="Use the demo to prove one repository, not to sell abstract AI promises."
      description="A good BeHeart demo should show scan depth, diagram clarity, document-aware retrieval, and a benchmark story a buyer can repeat internally."
      actions={[
        { label: "Start Trial", href: "/start-trial", primary: true },
        { label: "Pricing", href: "/pricing" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="amber"
      aside={<p className="website-aside-copy">Demo motion should feel operational and credible, not like a generic AI landing page pitch.</p>}
    >
      <WebsiteSection
        eyebrow="Demo scope"
        title="A strong demo proves one repository end to end."
        description="The best enterprise demos stay concrete: one repo, one benchmark, one visible operating model."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Current project memory</h3>
            <p>Show code, docs, and diagrams being loaded into one usable memory layer.</p>
          </div>
          <div>
            <h3>Customer portal view</h3>
            <p>Show what changes after CLI sync: repository profile, diagrams, and benchmark visibility on web.</p>
          </div>
          <div>
            <h3>Admin support model</h3>
            <p>Explain how the BeHeart owner supports customers and operations without mixing internal and public surfaces.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Recommended agenda"
        title="Use the meeting to reduce buyer risk, not to perform breadth."
        description="The agenda should move from local-first proof into portal visibility and then into support and rollout confidence."
      >
        <div className="website-step-list">
          <article>
            <span>00-10m</span>
            <div>
              <h3>Show the repo memory being built</h3>
              <p>Run through scan, overview, and a generated diagram so the audience sees the product is grounded in their project structure.</p>
            </div>
          </article>
          <article>
            <span>10-20m</span>
            <div>
              <h3>Show a benchmark comparison</h3>
              <p>Walk through baseline vs heart-assisted output with token, money, and cleanup deltas that a manager can repeat internally.</p>
            </div>
          </article>
          <article>
            <span>20-30m</span>
            <div>
              <h3>Show the portal and admin boundaries</h3>
              <p>Clarify what customers see, what the platform owner sees, and how tenant-scoped sync and support work in practice.</p>
            </div>
          </article>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Qualification"
        title="A good-fit team usually has these signals."
        description="This helps the website support demo qualification without a heavy CRM-style flow."
      >
        <div className="website-checklist-grid">
          <article>
            <span>Usage pattern</span>
            <h3>Already using AI to code</h3>
            <ul>
              <li>Engineers are prompting against real repos</li>
              <li>Token spend or review cleanup is starting to sting</li>
              <li>There is at least one repo worth piloting on</li>
            </ul>
          </article>
          <article>
            <span>Buying trigger</span>
            <h3>Needs measurable proof</h3>
            <ul>
              <li>Wants ROI beyond “the output felt faster”</li>
              <li>Needs benchmark evidence for team rollout</li>
              <li>Cares about architecture and reuse quality</li>
            </ul>
          </article>
          <article>
            <span>Operational fit</span>
            <h3>Can run a two-week pilot</h3>
            <ul>
              <li>Can share one repo for guided setup</li>
              <li>Has someone to review benchmark outcomes</li>
              <li>Can compare before vs after on real tasks</li>
            </ul>
          </article>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Request demo"
        title="Submit one concrete pilot request."
        description="This is a real service-backed lead capture flow. Good requests focus on one repository, one buyer concern, and one benchmark outcome."
      >
        <LeadCaptureForm
          intakeKind="demo"
          sourcePage="/book-demo"
          title="Book a guided working demo"
          description="Tell us what repository should be used, who needs confidence, and what proof the session must produce."
          submitLabel="Submit demo request"
          successTitle="Demo request received"
          successDescription="The request is now visible in admin for qualification, revenue tracking, and guided follow-up."
        />
      </WebsiteSection>
    </WebsiteShell>
  );
}
