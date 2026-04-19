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
        <div className="admin-control-grid">
          <article>
            <span>Pipeline</span>
            <h3>Track design-partner conversion</h3>
            <p>Move from local proof to portal adoption to paid expansion with benchmark evidence at each step.</p>
          </article>
          <article>
            <span>Pricing</span>
            <h3>Connect seats to actual usage</h3>
            <p>Commercial plans should track who is using the product and how much operational support each account requires.</p>
          </article>
          <article>
            <span>Retention</span>
            <h3>Watch customer health before churn</h3>
            <p>Benchmark value, sync activity, and support issues should all feed retention judgment before revenue drops.</p>
          </article>
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
