import Link from "next/link";
import { MemorySignalVisual } from "../components/MemorySignalVisual.jsx";
import { WebsiteShell, WebsiteSection } from "../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Project memory for AI-assisted software teams",
  description: "Stop paying AI to re-learn your repository. BeHeart turns code, docs, policy, and benchmark history into durable project memory.",
  path: "/",
  keywords: ["project memory", "AI delivery", "token savings", "software teams"],
});

export default function HomePage() {
  return (
    <WebsiteShell
      eyebrow="Domain / AI Delivery"
      title={
        <>
          AI can write code.
          <span className="website-highlight"> BeHeart makes it remember.</span>
        </>
      }
      description="BeHeart turns code, requirements, design docs, architecture policy, and benchmark history into durable project memory so software teams can prove AI is cheaper, cleaner, and safer before they scale it."
      actions={[
        { label: "Start Trial", href: "/start-trial", primary: true },
        { label: "Run Benchmark", href: "/benchmark" },
        { label: "Sign In", href: "/sign-in" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="teal"
      heroVariant="immersive"
      aside={<MemorySignalVisual />}
    >
      <section className="website-proof-strip" aria-label="Value proof">
        <div>
          <span>Token savings</span>
          <strong>Scenario-based</strong>
          <p>Published savings are benchmark-specific until enough observed multi-run evidence exists.</p>
        </div>
        <div>
          <span>Cleanup reduction</span>
          <strong>Confidence-labeled</strong>
          <p>Every benchmark should show whether the result is observed, estimated, or mixed evidence.</p>
        </div>
        <div>
          <span>Rollout proof</span>
          <strong>Under review</strong>
          <p>ROI claims stay directional until repeated observed runs make the proof defensible.</p>
        </div>
      </section>

      <WebsiteSection
        eyebrow="Why teams switch"
        title="One system for project memory, governed AI work, and visible ROI."
        description="BeHeart should feel like delivery infrastructure, not another AI wrapper."
      >
        <div className="website-story-grid">
          <article>
            <span>Persistent memory</span>
            <h3>Every repo gets a durable heart</h3>
            <p>Code graph, biz docs, system design, ADRs, policies, and benchmark history stay queryable across sessions.</p>
          </article>
          <article>
            <span>Safer AI work</span>
            <h3>Context arrives with architectural rails</h3>
            <p>Preferred reuse paths, deprecated areas, and sensitive zones keep agent output closer to production reality.</p>
          </article>
          <article>
            <span>Proof, not promises</span>
            <h3>Benchmark reports justify the spend</h3>
            <p>Customers can see token savings, time-to-patch improvements, cleanup reduction, and the provenance label behind each claim.</p>
          </article>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="What the heart remembers"
        title="More than a graph. A working memory model for delivery."
        description="The wedge is not code search. It is durable project understanding that AI can act on."
      >
        <div className="website-feature-columns">
          <div className="website-feature-list">
            <article>
              <h3>Code structure</h3>
              <p>Symbols, modules, imports, relationships, and impact paths.</p>
            </article>
            <article>
              <h3>Document memory</h3>
              <p>Business requirements, tech design, system design, tickets, ADRs, and uploaded briefs.</p>
            </article>
            <article>
              <h3>Policy layer</h3>
              <p>Boundaries, reuse preferences, deprecated paths, and context exclusions.</p>
            </article>
          </div>
          <div className="website-feature-list">
            <article>
              <h3>CLI + MCP access</h3>
              <p>Developers stay local-first while agents can query the same memory model through MCP.</p>
            </article>
            <article>
              <h3>Portal visibility</h3>
              <p>Diagrams, repository profiles, docs, usage, and benchmark artifacts become explorable on the web.</p>
            </article>
            <article>
              <h3>Operational ROI</h3>
              <p>Customers and admins can inspect savings, runs, quality signals, and sync status over time.</p>
            </article>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="How it moves"
        title="From local repository to controlled AI workflow."
        description="The product story should read like an operating path, not a pile of disconnected features."
      >
        <div className="website-signal-lane">
          <article>
            <span>01</span>
            <h3>Scan and link</h3>
            <p>`heart scan` builds the project memory from code, docs, and decisions with incremental updates.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Serve context</h3>
            <p>CLI and MCP return the smallest high-signal pack for the task, with reuse and policy awareness.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Review on the web</h3>
            <p>Portal surfaces synced diagrams, repository summaries, document state, and benchmark history.</p>
          </article>
          <article>
            <span>04</span>
            <h3>Prove the value</h3>
            <p>Benchmarks show whether the AI became cheaper, cleaner, and easier to trust.</p>
          </article>
        </div>
      </WebsiteSection>

      <section className="website-cta-band">
        <div>
          <p className="website-section-eyebrow">For SMB teams first</p>
          <h2>Start local, prove savings, then scale into the BeHeart portal.</h2>
          <p>
            The buying motion should feel lighter than the waste it removes: quick setup, visible ROI, and a
            safer path for AI-assisted engineering.
          </p>
        </div>
        <div className="website-actions">
          <Link className="primary" href="/start-trial">
            Start Trial
          </Link>
          <Link href="/book-demo">Book Demo</Link>
        </div>
      </section>
    </WebsiteShell>
  );
}
