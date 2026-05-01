import { AdminIntakeRequestsClient } from "../../components/AdminIntakeRequestsClient.jsx";
import { AdminBenchmarkSummaryClient } from "../../components/AdminBenchmarkSummaryClient.jsx";
import { AdminRevenueCommandCenterClient } from "../../components/AdminRevenueCommandCenterClient.jsx";
import { AdminShell, AdminSection } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Revenue",
  description: "Internal revenue view for demo and trial intake, benchmark proof, and expansion-readiness signals.",
  path: "/revenue",
});

export default function AdminRevenuePage() {
  return (
    <AdminShell title="Revenue and retention" description="Commercial pipeline, proof, and expansion health for the internal BeHeart control plane.">
      <AdminSection eyebrow="Owner cockpit" title="Commercial and retention command center" subtitle="Pipeline, benchmark proof, and expansion signals">
        <AdminRevenueCommandCenterClient />
      </AdminSection>
      <AdminSection eyebrow="Revenue operations" title="Operational guardrails for commercial decisions" subtitle="Owner operations">
        <div className="admin-command-grid">
          <section className="admin-command-panel">
            <header className="admin-command-head">
              <div>
                <span>Commercial standards</span>
                <h3>What should be true before a customer moves to the next commercial stage</h3>
                <p>Revenue decisions should stay tied to usage truth, benchmark evidence, and support load.</p>
              </div>
            </header>
            <div className="admin-summary-list">
              <article>
                <span>Proof before expansion</span>
                <strong>Benchmark-backed repositories should exist before a larger seat conversation</strong>
                <p>Use ROI evidence to justify spend instead of relying on one-off enthusiasm or raw traffic spikes.</p>
              </article>
              <article>
                <span>Seats before waste</span>
                <strong>Seat pressure only matters when usage is healthy and support debt is controlled</strong>
                <p>High seat utilization without sync quality or benchmark coverage is not healthy expansion.</p>
              </article>
              <article>
                <span>Retention before revenue</span>
                <strong>Renewals should be reviewed alongside support backlog, stale repos, and policy drift</strong>
                <p>Commercial posture should reflect the real delivery experience, not just contract dates.</p>
              </article>
            </div>
          </section>

          <section className="admin-command-panel">
            <header className="admin-command-head">
              <div>
                <span>Decision matrix</span>
                <h3>How the owner should route each account</h3>
                <p>Keep commercial motion explicit so support, sales, and platform all operate from the same rubric.</p>
              </div>
            </header>
            <div className="admin-data-table-shell">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Motion</th>
                    <th>When it fits</th>
                    <th>Primary proof</th>
                    <th>Risk check</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="admin-table-primary">
                      <strong>Guided pilot</strong>
                      <small>Design partner or strategic account</small>
                    </td>
                    <td>Large team, multiple repositories, and explicit governance need.</td>
                    <td>Benchmark report plus portal visibility.</td>
                    <td>Support queue and auth posture are still manageable.</td>
                  </tr>
                  <tr>
                    <td className="admin-table-primary">
                      <strong>Self-serve expansion</strong>
                      <small>Healthy trial or active account</small>
                    </td>
                    <td>Usage is growing and memory readiness is already stable.</td>
                    <td>Usage telemetry plus benchmark-backed savings.</td>
                    <td>Seat pressure is real, not just entitlement noise.</td>
                  </tr>
                  <tr>
                    <td className="admin-table-primary">
                      <strong>Pause and repair</strong>
                      <small>Operationally weak account</small>
                    </td>
                    <td>Stale repos, warning-heavy outputs, or low proof coverage.</td>
                    <td>Support review and repository sync truth.</td>
                    <td>Do not expand until trust blockers are removed.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </AdminSection>

      <AdminSection eyebrow="Source tables" title="Underlying intake and ROI tables" subtitle="Detailed raw views">
        <div className="admin-stack-block">
          <AdminIntakeRequestsClient />
          <AdminBenchmarkSummaryClient />
        </div>
      </AdminSection>
    </AdminShell>
  );
}
