import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Benchmark",
  description: "Measure token savings, memory refresh reduction, review cleanup, and rollout ROI with baseline vs heart-assisted runs.",
  path: "/benchmark",
  keywords: ["benchmark", "token savings", "ROI", "AI evaluation"],
});

export default function BenchmarkPage() {
  return (
    <WebsiteShell
      eyebrow="Benchmark"
      title="Measure whether AI got cheaper, cleaner, and easier to trust."
      description="BeHeart benchmarks compare baseline prompting against heart-assisted execution on the same repository, task statement, and model class."
      actions={[
        { label: "Start Trial", href: "/start-trial", primary: true },
        { label: "Book Demo", href: "/book-demo" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "security", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="amber"
      aside={
        <div className="website-metric-grid">
          <div>
            <span>Token Saving</span>
            <strong>Tracked</strong>
            <p>Baseline vs heart-assisted runs are compared directly.</p>
          </div>
          <div>
            <span>Patch Quality</span>
            <strong>Reviewed</strong>
            <p>Blind review and cleanup effort matter as much as prompt size.</p>
          </div>
        </div>
      }
    >
      <WebsiteSection title="What gets measured">
        <div className="website-detail-grid">
          <div>
            <h3>Time to acceptable patch</h3>
            <p>How fast a team reaches a change that can pass review with minimal cleanup.</p>
          </div>
          <div>
            <h3>Duplicate implementation rate</h3>
            <p>Whether the model reused existing patterns or rebuilt logic that already existed.</p>
          </div>
          <div>
            <h3>Architecture compliance</h3>
            <p>Whether the output stayed inside project boundaries and preferred implementation paths.</p>
          </div>
        </div>
      </WebsiteSection>
      <WebsiteSection title="Outputs for decision makers">
        <div className="website-split-grid">
          <article>
            <span>Manager</span>
            <h3>ROI summary</h3>
            <p>A short report focused on cost, delivery time, and rollout confidence.</p>
          </article>
          <article>
            <span>Engineer</span>
            <h3>Technical breakdown</h3>
            <p>Run artifacts, task-level outcomes, and context quality observations.</p>
          </article>
          <article>
            <span>Audit</span>
            <h3>Raw artifacts</h3>
            <p>Inputs, generated outputs, and scoring evidence remain inspectable.</p>
          </article>
        </div>
      </WebsiteSection>
    </WebsiteShell>
  );
}
