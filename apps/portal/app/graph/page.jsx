import { PortalGlobalGraphClient } from "../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Graph",
  description: "Live relationship graph for the latest synced repository.",
  path: "/graph",
});

export default function PortalGraphPage() {
  return (
    <PortalShell
      title="Graph"
      description="Live repo relationships."
    >
      <PortalGlobalGraphClient />
    </PortalShell>
  );
}
