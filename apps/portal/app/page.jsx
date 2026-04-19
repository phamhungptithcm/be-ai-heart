import { PortalOverviewEnterpriseClient } from "../components/PortalOverviewEnterpriseClient.jsx";
import { PortalShell } from "../components/PortalShell.jsx";
import { createPortalMetadata } from "../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Workspace overview",
  description: "Customer workspace overview for synced repositories, diagrams, benchmarks, and project-memory health.",
  path: "/",
});

export default function PortalHomePage() {
  return (
    <PortalShell
      title="Customer command center"
      description="Track tenant-scoped memory readiness, action items, benchmark posture, and workspace freshness in the default customer overview."
      shellMode="overview"
      showToolbar={false}
    >
      <PortalOverviewEnterpriseClient />
    </PortalShell>
  );
}
