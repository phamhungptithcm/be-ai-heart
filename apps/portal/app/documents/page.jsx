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
      title="Docs"
      description="Review synced specs and queue business requirement updates."
    >
      <PortalDocumentsWorkspaceClient />
    </PortalShell>
  );
}
