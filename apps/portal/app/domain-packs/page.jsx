import { DomainPacksBrowserClient } from "../../components/PortalDomainPacksClient.jsx";
import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Domain Packs",
  description: "Browse source-backed domain packs, layers, overlays, and generated artifacts.",
  path: "/domain-packs",
});

export default function DomainPacksPage() {
  return (
    <PortalShell
      title="Domain Packs"
      description="Select a vertical pack, customize overlays, generate assets, and review source citations."
    >
      <PortalSection
        eyebrow="Domain Packs"
        title="Pack Registry"
        subtitle="Available source-backed packs for CLI, MCP, portal, and chat workflows"
      >
        <DomainPacksBrowserClient />
      </PortalSection>
    </PortalShell>
  );
}
