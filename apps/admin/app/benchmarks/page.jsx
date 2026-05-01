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
      <AdminSection eyebrow="Reading the proof" title="Internal review standard for benchmark evidence" subtitle="What the team should enforce">
        <div className="admin-data-table-shell">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Reader</th>
                <th>Primary question</th>
                <th>What the report must show</th>
                <th>Why it matters</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="admin-table-primary">
                  <strong>Manager or buyer</strong>
                  <small>Budget and rollout owner</small>
                </td>
                <td>Is AI becoming cheaper and more predictable?</td>
                <td>Token savings, time delta, and cleanup reduction in one readable summary.</td>
                <td>The report must justify continued spend without a technical walkthrough.</td>
              </tr>
              <tr>
                <td className="admin-table-primary">
                  <strong>Engineer or lead</strong>
                  <small>Implementation and review owner</small>
                </td>
                <td>Do I trust the measurement and the task setup?</td>
                <td>Scenario, model, raw artifacts, and evidence bundle coverage.</td>
                <td>Without technical credibility, the archive turns into sales collateral instead of proof.</td>
              </tr>
              <tr>
                <td className="admin-table-primary">
                  <strong>Owner</strong>
                  <small>Commercial and support operator</small>
                </td>
                <td>Should this customer expand, repeat, or pause?</td>
                <td>Coverage across repositories and a clear link to supportability.</td>
                <td>Expansion decisions should only follow reproducible, supportable value.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AdminSection>
    </AdminShell>
  );
}
