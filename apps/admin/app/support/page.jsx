import { AdminIntakeRequestsClient } from "../../components/AdminIntakeRequestsClient.jsx";
import { AdminSupportSummaryClient } from "../../components/AdminProfilesClient.jsx";
import { AdminShell, AdminSection } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Support",
  description: "Internal support queue for synced repositories, new intake, stale profiles, and customer blockers.",
  path: "/support",
});

export default function AdminSupportPage() {
  return (
    <AdminShell title="Support" description="Internal support should focus on customer blockers: failed syncs, stale profiles, diagram issues, and architecture warning visibility.">
      <AdminSection eyebrow="Triage" title="Support queue signals" subtitle="Operational triage">
        <AdminSupportSummaryClient />
      </AdminSection>
      <AdminSection eyebrow="New accounts" title="Incoming demo and trial requests" subtitle="Qualification and follow-up">
        <AdminIntakeRequestsClient />
      </AdminSection>
      <AdminSection eyebrow="Queue scaffolding" title="Actionable queues and internal runbooks" subtitle="Operator-facing support lanes">
        <div className="admin-command-grid">
          <section className="admin-command-panel">
            <header className="admin-command-head">
              <div>
                <span>Queue table</span>
                <h3>Support actions that unblock trust and adoption</h3>
                <p>Support should work a small number of explicit queues instead of burying actions inside generic notes or long prose sections.</p>
              </div>
            </header>
            <div className="admin-data-table-shell">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Queue</th>
                    <th>Priority</th>
                    <th>Owner lane</th>
                    <th>Next action</th>
                    <th>Internal note</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="admin-table-primary">
                      <strong>Sync failures</strong>
                      <small>stale or failed mirrors</small>
                    </td>
                    <td><span className="admin-table-badge" data-tone="neutral">High</span></td>
                    <td>Support + platform</td>
                    <td>Confirm last successful CLI sync and inspect failed publish events.</td>
                    <td>Escalate only after verifying whether the portal or sync source is the real blocker.</td>
                  </tr>
                  <tr>
                    <td className="admin-table-primary">
                      <strong>Benchmark gap follow-up</strong>
                      <small>missing ROI proof</small>
                    </td>
                    <td><span className="admin-table-badge">Medium</span></td>
                    <td>Customer success</td>
                    <td>Book the next benchmark-ready workflow and confirm the scenario owner.</td>
                    <td>Capture blockers, timing, and expansion dependency before handing off.</td>
                  </tr>
                  <tr>
                    <td className="admin-table-primary">
                      <strong>Security posture review</strong>
                      <small>audit and session drift</small>
                    </td>
                    <td><span className="admin-table-badge">Medium</span></td>
                    <td>Support admin</td>
                    <td>Review auth failures, recent session revocations, and export posture.</td>
                    <td>Record customer-facing guidance without leaking internal-only details.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-command-panel">
            <header className="admin-command-head">
              <div>
                <span>Runbook</span>
                <h3>What a good support pass should verify</h3>
                <p>Support quality depends on checking sync truth, customer clarity, and rollout safety in a repeatable order.</p>
              </div>
            </header>
            <div className="admin-risk-list">
              <article className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>Repository truth</strong>
                  <span>Profile freshness, document memory, and warning visibility are current.</span>
                </div>
                <div className="admin-risk-meta">
                  <b>1</b>
                  <small>First check</small>
                </div>
              </article>
              <article className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>Buyer trust</strong>
                  <span>Portal outputs and benchmark summaries are understandable enough for customer use.</span>
                </div>
                <div className="admin-risk-meta">
                  <b>2</b>
                  <small>Second check</small>
                </div>
              </article>
              <article className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>Expansion safety</strong>
                  <span>Support debt is visible before any team is pushed toward a larger rollout.</span>
                </div>
                <div className="admin-risk-meta">
                  <b>3</b>
                  <small>Third check</small>
                </div>
              </article>
            </div>
          </section>
        </div>
      </AdminSection>
      <AdminSection eyebrow="Responsibilities" title="Support responsibilities" subtitle="Owner-only surface">
        <div className="admin-rail-list">
          <article>
            <span>Sync</span>
            <div>
              <h3>Investigate failed syncs</h3>
              <p>Support starts with understanding whether the customer portal has the latest repository memory and document artifacts.</p>
            </div>
          </article>
          <article>
            <span>Artifact</span>
            <div>
              <h3>Review diagram outputs</h3>
              <p>Help customers understand what the generated class, high-level, and sequence diagrams actually mean before they rely on them in delivery decisions.</p>
            </div>
          </article>
          <article>
            <span>Expansion</span>
            <div>
              <h3>Guide rollout readiness</h3>
              <p>Use benchmark and profile data to decide whether the customer is ready to expand usage or still needs operational help.</p>
            </div>
          </article>
        </div>
      </AdminSection>
    </AdminShell>
  );
}
