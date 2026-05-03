import { WebsiteProductMotionVisual } from "../../components/WebsiteProductMotionVisual.jsx";
import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "How it works",
  description: "How BeHeart turns local repo scans into durable memory, CLI agent context, MCP tools, portal chat, governance, and benchmark-backed ROI.",
  path: "/how-it-works",
  keywords: ["local-first AI workflow", "repo sync", "project memory", "AI engineering workflow"],
});

export default function HowItWorksPage() {
  return (
    <WebsiteShell
      eyebrow="How it works"
      title="BeHeart gives AI a current map before the task starts."
      description="The loop is simple: scan locally, store memory artifacts, choose a model, compile task context, expose it through MCP, sync safe summaries, and measure whether the work improved."
      actions={[
        { label: "Try CLI", href: "/docs/v1/getting-started", primary: true },
        { label: "CLI Sync Docs", href: "/docs/v1/cli-sync" },
      ]}
      nav={["home", "product", "how-it-works", "cli-mcp", "benchmark", "pricing", "security", "docs", "book-demo"]}
      accent="teal"
      aside={<WebsiteProductMotionVisual variant="workflow" />}
    >
      <WebsiteSection
        eyebrow="Data flow"
        title="From repo checkout to AI-ready memory."
        description="Every step creates an inspectable artifact. The portal reflects synced truth; the repo remains the source of local memory."
      >
        <div className="website-flow-steps">
          {[
            ["01", "Install and initialize", "`heart init` creates config, policy defaults, and the local memory workspace."],
            ["02", "Scan source and docs", "`heart scan` indexes code, docs, requirements, diagrams, policy files, benchmark inputs, and domain packs."],
            ["03", "Choose model and context", "The CLI AI agent can attach repo memory, docs/spec sync, benchmark evidence, or Tolling Management pack context."],
            ["04", "Serve through MCP", "AI tools call narrow MCP tools for overview, symbol lookup, docs search, impact, domain packs, and policy checks."],
            ["05", "Use portal visibility", "Portal shows repo profile, graph health, docs freshness, context previews, model setup, chat, and warnings."],
            ["06", "Benchmark the change", "Baseline vs assisted runs show token, cleanup, reuse, quality, and evidence mode."],
          ].map(([step, title, body]) => (
            <article key={step}>
              <span>{step}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="What the user sees"
        title="Each surface has one job."
        description="The product stays clean because local execution, customer visibility, and internal operations do not blur together."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Developer</h3>
            <p>Runs the CLI AI agent and MCP locally so AI gets the right context before coding.</p>
          </div>
          <div>
            <h3>Customer team</h3>
            <p>Uses the portal to inspect repo readiness, portal chat, model setup, docs freshness, context packs, and benchmark ROI.</p>
          </div>
          <div>
            <h3>Founder/admin</h3>
            <p>Uses admin for support, sync health, revenue posture, billing readiness, enterprise leads, and audit events.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Trust model"
        title="BeHeart avoids fake certainty."
        description="Generated diagrams, graph summaries, and ROI dashboards are useful only when freshness, confidence, and evidence source are visible."
      >
        <div className="website-story-grid">
          <article>
            <span>Freshness</span>
            <h3>Stale scans point back to the CLI</h3>
            <p>Portal data shows when the local repo needs a fresh scan.</p>
          </article>
          <article>
            <span>Evidence</span>
            <h3>Observed and estimated stay separate</h3>
            <p>ROI claims cite the benchmark report, scenario, model class, and confidence label.</p>
          </article>
          <article>
            <span>Safety</span>
            <h3>Chat commands are allowlisted</h3>
            <p>Portal workbench actions map to product commands and require confirmation for risky work.</p>
          </article>
        </div>
      </WebsiteSection>
    </WebsiteShell>
  );
}
