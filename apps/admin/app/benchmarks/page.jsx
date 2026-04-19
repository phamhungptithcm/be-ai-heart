import { AdminBenchmarkHistoryClient } from "../../components/AdminBenchmarkHistoryClient.jsx";
import { AdminBenchmarkSummaryClient } from "../../components/AdminBenchmarkSummaryClient.jsx";
import { AdminShell, AdminSection } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Benchmarks",
  description: "Internal benchmark oversight for commercial proof, customer rollout health, and revenue-linked efficiency evidence.",
  path: "/benchmarks",
});

export default function AdminBenchmarksPage() {
  return (
    <AdminShell
      title="Benchmarks"
      description="Internal benchmark oversight for sales proof, customer rollout health, and revenue-linked efficiency evidence."
    >
      <AdminSection eyebrow="Commercial evidence" title="Benchmark summary" subtitle="Owner-level oversight">
        <AdminBenchmarkSummaryClient />
      </AdminSection>
      <AdminSection eyebrow="Report archive" title="Published benchmark history" subtitle="Customer-facing proof with internal visibility">
        <AdminBenchmarkHistoryClient />
      </AdminSection>
      <AdminSection eyebrow="Reading the proof" title="A good benchmark report should be commercially usable" subtitle="Internal review standard">
        <div className="admin-rail-list">
          <article>
            <span>Manager</span>
            <div>
              <h3>Can summarize value quickly</h3>
              <p>The report should make token savings, cost delta, and delivery quality legible to a buyer in one read.</p>
            </div>
          </article>
          <article>
            <span>Engineer</span>
            <div>
              <h3>Can inspect technical detail</h3>
              <p>The report should expose task type, raw artifacts, and measurement logic so the team trusts the claims.</p>
            </div>
          </article>
          <article>
            <span>Owner</span>
            <div>
              <h3>Can use it in pipeline decisions</h3>
              <p>The benchmark needs to justify trial continuation, expansion, or a pause in rollout if value is not yet proven.</p>
            </div>
          </article>
        </div>
      </AdminSection>
    </AdminShell>
  );
}
