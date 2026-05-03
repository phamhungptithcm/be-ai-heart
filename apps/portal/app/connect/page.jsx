import { PortalConnectClient } from "../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "MCP / CLI Connect",
  description: "Local-first CLI and MCP setup visibility.",
  path: "/connect",
});

export default function PortalConnectPage() {
  return (
    <PortalShell
      title="CLI / MCP"
      description="Install, scan locally, sync artifacts, and run MCP."
    >
      <PortalSection eyebrow="Local-first setup" title="Connect local tools">
        <PortalConnectClient />
      </PortalSection>
    </PortalShell>
  );
}
