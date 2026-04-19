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
      <AdminSection eyebrow="Runbook" title="Support responsibilities" subtitle="Owner-only surface">
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

      <AdminSection eyebrow="Support checklist" title="What a high-quality support pass should confirm" subtitle="Internal operating standard">
        <div className="admin-checklist-grid">
          <article>
            <span>Repository truth</span>
            <h3>The mirrored profile is current</h3>
            <ul>
              <li>Profile freshness looks reasonable</li>
              <li>Document memory is present where expected</li>
              <li>Warnings are visible, not silently dropped</li>
            </ul>
          </article>
          <article>
            <span>Buyer trust</span>
            <h3>The customer can interpret the outputs</h3>
            <ul>
              <li>Diagrams are readable enough to use</li>
              <li>Benchmark summaries are understandable</li>
              <li>Portal next steps are clear</li>
            </ul>
          </article>
          <article>
            <span>Expansion safety</span>
            <h3>The account is not being pushed too early</h3>
            <ul>
              <li>Proof exists before upsell pressure</li>
              <li>Support debt is not hiding behind good-looking metrics</li>
              <li>Operational blockers are documented</li>
            </ul>
          </article>
        </div>
      </AdminSection>
    </AdminShell>
  );
}
