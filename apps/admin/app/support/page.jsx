import { AdminIntakeRequestsClient } from "../../components/AdminIntakeRequestsClient.jsx";
import { AdminSupportOperationsClient } from "../../components/AdminSupportOperationsClient.jsx";
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
      <AdminSection eyebrow="Support cockpit" title="Queue board and intervention lanes" subtitle="Customer-facing blockers first">
        <AdminSupportOperationsClient />
      </AdminSection>
      <AdminSection eyebrow="New accounts" title="Incoming demo and trial requests" subtitle="Qualification and follow-up">
        <AdminIntakeRequestsClient />
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
