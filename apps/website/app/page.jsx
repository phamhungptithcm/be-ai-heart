import Link from "next/link";
import { MemorySignalVisual } from "../components/MemorySignalVisual.jsx";
import { WebsiteShell, WebsiteSection } from "../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Durable project memory for AI-assisted teams",
  description:
    "BeHeart connects repo memory, CLI agent workflows, portal chat, MCP, domain packs, and benchmark evidence so AI-assisted teams can work with context they can trust.",
  path: "/",
  keywords: ["project memory", "AI coding", "CLI agent", "MCP", "portal chat", "benchmark ROI"],
});

const productModules = [
  ["CLI AI agent", "Run heart locally, choose a model, attach repo memory, and ask with citations."],
  ["CLI IDE workbench", "See readiness, context, artifacts, and confirmations in one terminal lane."],
  ["Web portal", "Review repos, docs, graphs, context previews, benchmarks, usage, and access."],
  ["Portal chat", "Use model-aware chat over synced artifacts and allowed BeHeart actions."],
  ["MCP runtime", "Let compatible agents request context packs, docs, policies, and benchmark summaries."],
  ["Domain packs", "Add source-backed industry memory, starting with Tolling Management."],
];

const journeys = [
  {
    title: "Developer local workflow",
    steps: ["Install the CLI", "Scan one repo", "Build a context pack", "Connect MCP", "Run a benchmark"],
  },
  {
    title: "Team portal workflow",
    steps: ["Sync reviewed artifacts", "Choose context and model", "Use portal chat", "Review benchmark evidence", "Manage access"],
  },
  {
    title: "Domain pack sales demo",
    steps: ["Select Tolling Management", "Generate demo-safe kit", "Show Account 360", "Customize overlay", "Plan pilot proof"],
  },
  {
    title: "Enterprise evaluation",
    steps: ["Review security boundaries", "Confirm billing posture", "Assess SSO and retention needs", "Choose deployment path", "Approve pilot gate"],
  },
];

function VisualProofBlocks() {
  return (
    <div className="website-mock-grid" aria-label="Product proof blocks">
      <article className="website-mock-card website-mini-terminal">
        <span>CLI workbench</span>
        <strong>heart agent</strong>
        <pre>{`$ heart
repo: checkout-service
model: openai/gpt-5.1
context: repo + tolling-management

/pack "audit invoice dispute flow"`}</pre>
      </article>
      <article className="website-mock-card website-chat-mock">
        <span>Portal chat</span>
        <strong>Model selection visible</strong>
        <div>
          <p>Provider: Anthropic</p>
          <p>Model: Claude Sonnet</p>
          <p>Context: Repo graph, docs/spec sync, benchmark report</p>
        </div>
      </article>
      <article className="website-mock-card website-context-card">
        <span>Context pack</span>
        <strong>Repo memory with citations</strong>
        <ul>
          <li>Files and symbols</li>
          <li>Requirements and decisions</li>
          <li>Reuse candidates</li>
          <li>Risks and next actions</li>
        </ul>
      </article>
      <article className="website-mock-card website-tolling-card">
        <span>Domain demo kit</span>
        <strong>Tolling Sales MVP Demo Kit</strong>
        <p>Demo-only Account 360, customer portal preview, architecture story, proposal starter, and ROI hypothesis.</p>
        <Link href="/domain-demo-kits/tolling-management">Open kit</Link>
      </article>
      <article className="website-mock-card website-roi-card">
        <span>Benchmark ROI</span>
        <strong>Evidence before claims</strong>
        <p>Reports label observed, estimated, or mixed evidence before savings language reaches a buyer.</p>
        <Link href="/benchmark">Read benchmark flow</Link>
      </article>
    </div>
  );
}

export default function HomePage() {
  return (
    <WebsiteShell
      eyebrow="Durable project memory"
      title={
        <>
          Durable project memory for{" "}
          <span className="website-highlight">AI-assisted teams.</span>
        </>
      }
      description="BeHeart turns a repository into durable memory for AI coding. The CLI, MCP, portal, domain packs, and benchmarks help agents reuse existing work, follow rules, and prove value before rollout."
      actions={[
        { label: "Try CLI", href: "/docs/v1/getting-started", primary: true },
        { label: "Book demo", href: "/book-demo" },
        { label: "Tolling kit", href: "/domain-demo-kits/tolling-management" },
      ]}
      nav={["home", "product", "services", "cli-mcp", "benchmark", "pricing", "security", "docs", "sign-in", "book-demo"]}
      accent="teal"
      heroVariant="immersive"
      aside={<MemorySignalVisual />}
    >
      <section className="website-proof-strip" aria-label="Product posture">
        <div>
          <span>Problem</span>
          <strong>AI loses context</strong>
          <p>Teams pay for repo rediscovery, repeated prompts, duplicate work, and review cleanup.</p>
        </div>
        <div>
          <span>Solution</span>
          <strong>Memory plus workflow</strong>
          <p>BeHeart links repo memory, CLI, portal, MCP, models, docs, domains, and evidence.</p>
        </div>
        <div>
          <span>Proof</span>
          <strong>Benchmark-led</strong>
          <p>ROI language stays tied to scenario reports and evidence labels instead of broad savings promises.</p>
        </div>
      </section>

      <WebsiteSection
        eyebrow="Why it matters"
        title="AI coding breaks down when the system starts cold."
        description="The model can inspect files, but teams still have to preserve project intent, reuse paths, boundaries, and proof."
      >
        <div className="website-story-grid">
          <article>
            <span>Context</span>
            <h3>Project knowledge disappears between sessions</h3>
            <p>Developers re-explain architecture, requirements, ownership, and past decisions instead of building from durable memory.</p>
          </article>
          <article>
            <span>Reuse</span>
            <h3>Agents recreate what already exists</h3>
            <p>Without graph-backed context packs, AI often misses reusable modules, tests, domain rules, and accepted implementation paths.</p>
          </article>
          <article>
            <span>Trust</span>
            <h3>Buyers need evidence and control</h3>
            <p>Design partners and enterprises need security boundaries, billing posture, deployment options, and benchmark proof.</p>
          </article>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Product modules"
        title="One operating layer across local tools and team surfaces."
        description="Each module has a specific job, status, and adoption path."
      >
        <div className="website-module-grid">
          {productModules.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Visual proof"
        title="Show the product story with proof blocks."
        description="The page shows the CLI, portal chat, context packs, demo kit, and benchmark story with clear status labels."
      >
        <VisualProofBlocks />
      </WebsiteSection>

      <WebsiteSection
        eyebrow="User journeys"
        title="Clear paths for developers, teams, sellers, and enterprise buyers."
        description="Each visitor gets a practical next step without reading the full product plan."
      >
        <div className="website-journey-grid">
          {journeys.map((journey) => (
            <article key={journey.title}>
              <h3>{journey.title}</h3>
              <ol>
                {journey.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="How it works"
        title="Scan locally, serve context, then prove value."
        description="The recommended path starts with one repo and expands only when the evidence is readable."
      >
        <div className="website-signal-lane">
          <article>
            <span>01</span>
            <h3>Build repo memory</h3>
            <p>Scan code, docs, specs, policies, and benchmark artifacts into local project memory.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Use CLI and MCP</h3>
            <p>Run the CLI AI agent or connect MCP so coding tools can request compact context.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Work in the portal</h3>
            <p>Review synced summaries, portal chat, model setup, context previews, usage, and access.</p>
          </article>
          <article>
            <span>04</span>
            <h3>Measure the rollout</h3>
            <p>Use benchmarks and governance reviews before a pilot becomes a wider deployment.</p>
          </article>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Roadmap clarity"
        title="Enterprise readiness is a rollout path."
        description="Shared graph storage, advanced retention, SSO/SAML, private deployment, and deeper billing automation remain customer-specific or staged until implemented and tested."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Ready for pilots</h3>
            <p>Local CLI, MCP, repo memory, context packs, benchmark reports, portal/admin surfaces, and Tolling pack artifacts.</p>
          </div>
          <div>
            <h3>Being connected</h3>
            <p>Portal AI chat, model selection, provider key setup, generated artifact cards, and billing posture.</p>
          </div>
          <div>
            <h3>Enterprise evaluation</h3>
            <p>Deployment model, audit, retention, SSO, RBAC, support, and security review are handled through guided evaluation.</p>
          </div>
        </div>
      </WebsiteSection>

      <section className="website-cta-band">
        <div>
          <p className="website-section-eyebrow">Next step</p>
          <h2>Start with one repo, one workflow, and one proof point.</h2>
          <p>
            Try the CLI, review the tolling kit, or book a focused demo when your team is ready for a guided pilot.
          </p>
        </div>
        <div className="website-cta-grid">
          <Link className="primary" href="/docs/v1/getting-started">
            Try CLI
          </Link>
          <Link href="/book-demo">Book demo</Link>
          <Link href="/domain-demo-kits/tolling-management">Tolling kit</Link>
        </div>
      </section>
    </WebsiteShell>
  );
}
