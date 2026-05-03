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
      title="Workspace health"
      description="See what is synced, stale, benchmarked, and waiting for action."
      shellMode="overview"
      showToolbar={false}
    >
      <PortalOverviewEnterpriseClient />
    </PortalShell>
  );
}
