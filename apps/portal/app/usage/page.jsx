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
      title="Usage"
      description="Live usage and benchmark-backed savings in one place."
    >
      <PortalUsageAnalyticsClient />
    </PortalShell>
  );
}
