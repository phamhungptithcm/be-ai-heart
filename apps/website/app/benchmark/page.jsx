import { WebsiteProductMotionVisual } from "../../components/WebsiteProductMotionVisual.jsx";
import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Benchmark",
  description: "Measure token usage, memory refresh reduction, review cleanup, duplicate work, context retention, and rollout ROI with baseline vs BeHeart-assisted runs.",
  path: "/benchmark",
  keywords: ["benchmark", "token savings", "ROI", "AI evaluation"],
});

export default function BenchmarkPage() {
  return (
    <WebsiteShell
      eyebrow="Benchmark"
      title="Prove AI delivery changed before you expand it."
      description="BeHeart benchmarks compare the same task on the same repo with and without BeHeart memory, then label evidence as observed, estimated, or mixed before any ROI claim is shared."
      actions={[
        { label: "Read Benchmark Docs", href: "/docs/v1/benchmarking", primary: true },
        { label: "Request Pilot", href: "/book-demo" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="amber"
      aside={<WebsiteProductMotionVisual variant="benchmark" />}
    >
      <section className="website-proof-strip" aria-label="Benchmark posture">
        <div>
          <span>Comparison</span>
          <strong>Same scenario</strong>
          <p>Baseline and assisted runs use the same repo snapshot, task, and model class.</p>
        </div>
        <div>
          <span>Evidence</span>
          <strong>Mode-labeled</strong>
          <p>Reports keep observed telemetry separate from estimates and incomplete captures.</p>
        </div>
        <div>
          <span>Decision</span>
          <strong>Rollout gate</strong>
          <p>Teams expand only after cost, cleanup, reuse, and trust signals are readable.</p>
        </div>
      </section>

      <WebsiteSection
        eyebrow="Metrics"
        title="Measure cost, quality, and memory together."
        description="A smaller prompt is not enough if the final patch creates duplicate work or violates architecture."
      >
        <div className="website-benchmark-metrics">
          {[
            ["Token and cost savings", "Prompt, discovery, tool, completion, elapsed time, and token-cost deltas."],
            ["Context retention", "Follow-up memory, document hits, handoff success, and reduced re-explaining."],
            ["Duplicate-work avoidance", "Reuse hits, duplicate checks, and whether existing modules were found before new code."],
            ["Architecture quality", "Policy violations, review edits, tests, correctness, maintainability, and reuse score."],
          ].map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Scenario catalog"
        title="Pilot on tasks that reveal real AI waste."
        description="The benchmark catalog covers the task types teams actually struggle to control."
      >
        <div className="website-signal-lane">
          {["Bug fix", "Feature addition", "Duplicate refactor", "Cross-module change", "Document-required task"].map((scenario, index) => (
            <article key={scenario}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{scenario}</h3>
              <p>Run baseline and assisted evidence with cited scenario, dataset, model class, and confidence label.</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Reports"
        title="Outputs are built for engineers and buyers."
        description="The same evidence supports review, budget approval, renewal, and admin support."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Engineer report</h3>
            <p>Run artifacts, reuse evidence, docs hits, policy warnings, and context quality observations.</p>
          </div>
          <div>
            <h3>Manager summary</h3>
            <p>Token delta, cost delta, cleanup change, risk notes, and recommendation to continue or pause.</p>
          </div>
          <div>
            <h3>Portal and admin views</h3>
            <p>Portal shows customer-readable evidence. Admin shows internal customer health, support, billing posture, and expansion signals.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Domain evidence"
        title="Domain packs get benchmark stories too."
        description="The Tolling Management pack includes benchmark scenarios and ROI hypotheses, while public claims wait for measured evidence."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Tolling scenario</h3>
            <p>Trip posting, dedupe, support, and document-required tasks can reveal repeated context cost and missed domain rules.</p>
          </div>
          <div>
            <h3>Demo kit proof</h3>
            <p>The sales demo kit can be used for discovery and design partner feedback before runtime ROI exists.</p>
          </div>
          <div>
            <h3>Evidence label</h3>
            <p>Hypothesis, estimated, mixed, and observed language must remain distinct in public and buyer-facing copy.</p>
          </div>
        </div>
      </WebsiteSection>
    </WebsiteShell>
  );
}
