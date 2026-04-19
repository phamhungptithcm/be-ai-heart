import { AdminOpsHealthCommandCenterClient, AdminOpsHealthSummaryClient } from "../../components/AdminProfilesClient.jsx";
import { AdminShell, AdminSection } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Ops health",
  description: "Internal operational health for sync reliability, artifact quality, and platform supportability.",
  path: "/ops-health",
});

export default function AdminOpsHealthPage() {
  return (
    <AdminShell title="Ops health" description="Platform operations, sync depth, and supportability need an internal surface separate from customer-facing portal pages.">
      <AdminSection eyebrow="Reliability" title="Operational health indicators" subtitle="Internal command center">
        <AdminOpsHealthSummaryClient />
      </AdminSection>
      <AdminSection eyebrow="Owner watchlist" title="Command center" subtitle="Freshness, quality, rollout safety">
        <AdminOpsHealthCommandCenterClient />
      </AdminSection>

      <AdminSection eyebrow="Escalation lanes" title="Use ops health to decide where the next intervention belongs" subtitle="Internal routing logic">
        <div className="admin-command-grid">
          <section className="admin-command-panel">
            <header className="admin-command-head">
              <div>
                <span>Routing logic</span>
                <h3>Where the next intervention belongs</h3>
                <p>Ops health exists to separate tenant-specific blockers from broad platform reliability work.</p>
              </div>
            </header>
            <div className="admin-risk-list">
              <article className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>Customer lane</strong>
                  <span>One repo or one tenant is stale, under-documented, or missing benchmark proof.</span>
                </div>
                <div className="admin-risk-meta">
                  <b>Support</b>
                  <small>Tenant scoped</small>
                </div>
              </article>
              <article className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>Product lane</strong>
                  <span>Multiple customers show the same missing signal, weak visualization, or recurring trust friction.</span>
                </div>
                <div className="admin-risk-meta">
                  <b>Product</b>
                  <small>Pattern driven</small>
                </div>
              </article>
              <article className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>Platform lane</strong>
                  <span>Auth, storage, sync host, or publish infrastructure is failing broadly.</span>
                </div>
                <div className="admin-risk-meta">
                  <b>Platform</b>
                  <small>Systemic</small>
                </div>
              </article>
            </div>
          </section>

          <section className="admin-command-panel">
            <header className="admin-command-head">
              <div>
                <span>Operational review order</span>
                <h3>What the owner should verify every pass</h3>
                <p>Healthy internal review starts with sync truth, then evidence quality, then expansion readiness.</p>
              </div>
            </header>
            <div className="admin-risk-list">
              <article className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>1. Sync freshness</strong>
                  <span>Make sure repository and document mirrors are current before any decision is made from them.</span>
                </div>
              </article>
              <article className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>2. Evidence quality</strong>
                  <span>Confirm diagrams, policy warnings, and benchmark artifacts are still useful and readable.</span>
                </div>
              </article>
              <article className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>3. Rollout pressure</strong>
                  <span>Only push broader adoption when support debt and benchmark gaps are visible and manageable.</span>
                </div>
              </article>
            </div>
          </section>
        </div>
      </AdminSection>
    </AdminShell>
  );
}
