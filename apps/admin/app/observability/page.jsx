import { AdminObservabilityClient } from "../../components/AdminObservabilityClient.jsx";
import { AdminSection, AdminShell } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Observability",
  description: "Internal requests, metrics, alerts, and export posture for the hosted service lane.",
  path: "/observability",
});

export default function AdminObservabilityPage() {
  return (
    <AdminShell
      title="Observability"
      description="Inspect hosted request metrics, alert posture, and export state through the existing admin observability APIs."
    >
      <AdminSection eyebrow="Platform health" title="Requests, alerts, and exports" subtitle="Observable hosted behavior without leaving admin">
        <AdminObservabilityClient />
      </AdminSection>
    </AdminShell>
  );
}

