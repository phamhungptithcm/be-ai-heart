import { PortalGlobalDiagramsClient } from "../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Diagrams",
  description: "Generated diagrams for the latest synced repository.",
  path: "/diagrams",
});

export default function PortalDiagramsPage() {
  return (
    <PortalShell
      title="Diagrams"
      description="Generated repo diagrams."
    >
      <PortalGlobalDiagramsClient />
    </PortalShell>
  );
}
