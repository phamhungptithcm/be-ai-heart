import { PortalDocumentsWorkspaceClient } from "../../components/PortalDocumentsWorkspaceClient.jsx";
import { PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Documents",
  description: "Customer document workspace for requirement updates, business context, and synced repository memory.",
  path: "/documents",
});

export default function PortalDocumentsPage() {
  return (
    <PortalShell
      title="Documents"
      description="Customers manage business documents and requirement updates here, then sync them into repository memory with the CLI."
    >
      <PortalDocumentsWorkspaceClient />
    </PortalShell>
  );
}
