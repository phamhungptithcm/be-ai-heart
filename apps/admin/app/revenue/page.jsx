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

      <AdminSection eyebrow="Source tables" title="Underlying intake and ROI tables" subtitle="Detailed raw views">
        <div className="admin-stack-block">
          <AdminIntakeRequestsClient />
          <AdminBenchmarkSummaryClient />
        </div>
      </AdminSection>
    </AdminShell>
  );
}
