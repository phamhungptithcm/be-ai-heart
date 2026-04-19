import { AdminOpsHealthSummaryClient } from "../../components/AdminProfilesClient.jsx";
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
      <AdminSection eyebrow="Reliability" title="Operational health indicators" subtitle="Current scaffold">
        <AdminOpsHealthSummaryClient />
      </AdminSection>
      <AdminSection eyebrow="Owner watchlist" title="Operational scope" subtitle="What the owner monitors here">
        <div className="admin-control-grid">
          <article>
            <span>Freshness</span>
            <h3>Sync reliability</h3>
            <p>Know when customer repository profiles stop updating or become partially stale.</p>
          </article>
          <article>
            <span>Quality</span>
            <h3>Artifact quality</h3>
            <p>Inspect whether diagram, document, and heart-link generation still produces usable support output.</p>
          </article>
          <article>
            <span>Readiness</span>
            <h3>Platform readiness</h3>
            <p>Separate pre-GTM scaffolding from the controls that will be required before enterprise rollout.</p>
          </article>
        </div>
      </AdminSection>

      <AdminSection eyebrow="Escalation lanes" title="Use ops health to decide where the next intervention belongs" subtitle="Internal routing logic">
        <div className="admin-rail-list">
          <article>
            <span>Customer</span>
            <div>
              <h3>Support intervention</h3>
              <p>When sync or diagram output is weak for one tenant, route the issue through customer success and support, not a generic platform backlog.</p>
            </div>
          </article>
          <article>
            <span>Product</span>
            <div>
              <h3>Capability gap</h3>
              <p>When multiple customers show the same missing signal, convert the pattern into a product backlog item tied to ROI or trust.</p>
            </div>
          </article>
          <article>
            <span>Platform</span>
            <div>
              <h3>Systemic platform risk</h3>
              <p>When auth, publish, or storage paths fail broadly, treat it as a platform reliability issue before new GTM push.</p>
            </div>
          </article>
        </div>
      </AdminSection>
    </AdminShell>
  );
}
