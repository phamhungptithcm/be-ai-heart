import { PortalOperationsDashboardClient } from "../components/PortalOperationsDashboardClient.jsx";
import { PortalProfilesClient } from "../components/PortalProfilesClient.jsx";
import { PortalWorkspaceSummaryClient } from "../components/PortalWorkspaceSummaryClient.jsx";
import { PortalShell, PortalSection } from "../components/PortalShell.jsx";
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
      description="Use the BeHeart portal to inspect synced repositories, document memory, benchmark proof, billing posture, and hosted workspace health in one customer-facing surface."
    >
      <PortalSection eyebrow="Customer cockpit" title="Operational control center" subtitle="Real-time customer-facing view for memory coverage, benchmark savings, and workspace freshness">
        <PortalOperationsDashboardClient />
      </PortalSection>
      <PortalSection eyebrow="Sync health" title="Workspace registry" subtitle="Customer-facing sync, memory depth, and readiness">
        <PortalWorkspaceSummaryClient />
      </PortalSection>
      <PortalSection eyebrow="Repository memory" title="Synced repositories" subtitle="Operational repository inventory inside this workspace">
        <PortalProfilesClient />
      </PortalSection>
    </PortalShell>
  );
}
