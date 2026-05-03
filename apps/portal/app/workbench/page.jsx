import { PortalWorkbenchClient } from "../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "AI Chat Workbench",
  description: "Scoped portal command box for repo memory, docs, graph, benchmarks, and governance.",
  path: "/workbench",
});

export default function PortalWorkbenchPage() {
  return (
    <PortalShell
      title="Agent Workbench"
      description="Chat with repo memory, docs, graph, domain packs, benchmarks, and safe BeHeart tools."
    >
      <PortalSection>
        <PortalWorkbenchClient />
      </PortalSection>
    </PortalShell>
  );
}
