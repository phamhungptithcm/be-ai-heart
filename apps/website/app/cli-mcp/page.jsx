import Link from "next/link";
import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "CLI AI Agent And MCP",
  description:
    "Use the BeHeart CLI AI agent, model setup, CLI IDE workbench, and MCP runtime to keep repo memory available to AI coding tools.",
  path: "/cli-mcp",
  keywords: ["AI CLI", "CLI agent", "MCP", "model selection", "context packs", "local-first"],
});

export default function CliMcpPage() {
  return (
    <WebsiteShell
      eyebrow="CLI AI agent / MCP"
      title="Local-first AI workflows with model choice and MCP access."
      description="Developers use the CLI AI agent and workbench from the repo. MCP-compatible tools query project memory through narrow tool contracts. The portal can show team-safe chat and settings without becoming a raw shell."
      actions={[
        { label: "Try CLI", href: "/docs/v1/getting-started", primary: true },
        { label: "Read CLI Docs", href: "/docs/v1/cli-sync" },
        { label: "Book demo", href: "/book-demo" },
      ]}
      nav={["home", "product", "services", "how-it-works", "cli-mcp", "benchmark", "pricing", "security", "docs", "book-demo"]}
      accent="slate"
      aside={
        <div className="website-command-block">
          <span>CLI AI agent</span>
          <strong>Run from your repo</strong>
          <pre>{`npm install -g beheart
heart
heart models add-key --provider openai --api-key-stdin
heart models select openai/gpt-5.1
heart chat --context repo "plan a safe refactor"
heart mcp tools`}</pre>
        </div>
      }
    >
      <section className="website-proof-strip" aria-label="CLI and MCP posture">
        <div>
          <span>CLI</span>
          <strong>Agent and workbench</strong>
          <p>Readiness, model setup, context attachments, domain packs, and benchmarks start locally.</p>
        </div>
        <div>
          <span>Models</span>
          <strong>Provider neutral</strong>
          <p>OpenAI, Anthropic, Gemini, OpenRouter, Mistral, and Groq use the registry and BYOK posture.</p>
        </div>
        <div>
          <span>MCP</span>
          <strong>Narrow tools</strong>
          <p>AI clients ask for overview, context packs, docs search, policy checks, and benchmark summaries.</p>
        </div>
      </section>

      <WebsiteSection
        eyebrow="Developer loop"
        title="The CLI AI agent is the first daily workflow."
        description="It has to prove useful before a team buys a hosted product."
      >
        <div className="website-split-grid">
          <article>
            <span>Readiness</span>
            <h3>Start from project state</h3>
            <p>The workbench shows config, policy, scan, docs/spec, MCP, benchmark, and domain pack readiness.</p>
          </article>
          <article>
            <span>Model setup</span>
            <h3>Choose provider and model</h3>
            <p>Model discovery, fallback manifests, selected model, and masked key state keep provider setup explicit.</p>
          </article>
          <article>
            <span>Context</span>
            <h3>Attach repo memory</h3>
            <p>Use graph, docs, context packs, benchmark reports, and Tolling Management pack context before asking.</p>
          </article>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="CLI IDE workbench"
        title="A guided coding surface instead of a blank prompt."
        description="The current CLI workbench is available now. Deeper IDE-style and portal workbench views stay labeled as staged until fully implemented."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Task mode</h3>
            <p>Plan, inspect, pack, benchmark, connect MCP, or build a domain demo kit with explicit next actions.</p>
          </div>
          <div>
            <h3>Artifact cards</h3>
            <p>Context packs, citations, generated artifacts, risks, and benchmark summaries are reviewable outputs.</p>
          </div>
          <div>
            <h3>Confirmations</h3>
            <p>Risky actions require user approval and leave auditable product records where hosted surfaces are involved.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="MCP runtime"
        title="Agents query memory through product contracts."
        description="MCP tools expose project understanding without giving the portal arbitrary shell access."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Context access</h3>
            <p>AI tools can request cited context for a task instead of re-reading the whole repository.</p>
          </div>
          <div>
            <h3>Domain pack tools</h3>
            <p>Agents can list, inspect, validate, and generate source-cited domain artifacts through allowlisted pack tools.</p>
          </div>
          <div>
            <h3>Benchmark summary</h3>
            <p>Compact ROI evidence can reach agents without exposing unsafe local paths or raw evidence bundles.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection title="Portal chat safety boundary" eyebrow="Portal">
        <div className="website-story-grid">
          <article>
            <span>Model selection</span>
            <h3>User-visible provider choice</h3>
            <p>Portal chat shows selected provider, model, preset, token budget, and provider data exposure notes.</p>
          </article>
          <article>
            <span>Provider keys</span>
            <h3>Masked key posture</h3>
            <p>Hosted provider keys require encrypted server-side storage; otherwise provider environment variables are used.</p>
          </article>
          <article>
            <span>Allowed actions</span>
            <h3>No raw browser shell</h3>
            <p>Portal commands map to allowlisted BeHeart actions such as scan request, pack preview, domain build, and benchmark review.</p>
          </article>
        </div>
      </WebsiteSection>

      <section className="website-cta-band">
        <div>
          <p className="website-section-eyebrow">Next step</p>
          <h2>Try the CLI before asking the team to adopt anything.</h2>
          <p>Install the CLI, scan one repo, build one context pack, then connect MCP and review benchmark evidence.</p>
        </div>
        <div className="website-cta-grid">
          <Link className="primary" href="/docs/v1/getting-started">
            Try CLI
          </Link>
          <Link href="/docs/v1/cli-sync">Read CLI docs</Link>
          <Link href="/book-demo">Book demo</Link>
        </div>
      </section>
    </WebsiteShell>
  );
}
