import { PortalWorkspacesClient } from "../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Workspaces",
  description: "Tenant workspace sync map for local-first repository memory.",
  path: "/workspaces",
});

export default function PortalWorkspacesPage() {
  return (
    <PortalShell
      title="Workspaces"
      description="Check which local repos have published artifacts."
    >
      <PortalSection eyebrow="Sync map" title="Artifact state">
        <PortalWorkspacesClient />
      </PortalSection>
    </PortalShell>
  );
}
