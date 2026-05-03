import { PortalGlobalContextPacksClient } from "../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Context Packs",
  description: "Workspace index for context pack history and task context previews.",
  path: "/context-packs",
});

export default function PortalContextPacksPage() {
  return (
    <PortalShell
      title="Context packs"
      description="Task-ready repo memory."
    >
      <PortalGlobalContextPacksClient />
    </PortalShell>
  );
}
