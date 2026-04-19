import { PortalShell } from "../../components/PortalShell.jsx";
import { PortalUsageAnalyticsClient } from "../../components/PortalUsageAnalyticsClient.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Usage",
  description: "Customer usage view for savings, sync freshness, and project-memory depth across workspace repositories.",
  path: "/usage",
});

export default function PortalUsagePage() {
  return (
    <PortalShell
      title="Usage and savings"
      description="Inspect tenant-scoped operational telemetry, benchmark-derived savings, and adoption depth across workspaces, repositories, users, models, and clients."
    >
      <PortalUsageAnalyticsClient />
    </PortalShell>
  );
}
