import { PortalProfilesClient } from "../../components/PortalProfilesClient.jsx";
import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Repositories",
  description: "Customer inventory of synced repository profiles, diagrams, documents, and efficiency signals.",
  path: "/repositories",
});

export default function PortalRepositoriesPage() {
  return (
    <PortalShell
      title="Repository profiles"
      description="Every synced repository becomes a visible project-memory profile where customers can inspect structure, documents, diagrams, and efficiency signals."
    >
      <PortalSection eyebrow="Inventory" title="All repositories" subtitle="Synced profile inventory">
        <PortalProfilesClient />
      </PortalSection>
    </PortalShell>
  );
}
