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
      title="Repositories"
      description="Repo memory readiness."
    >
      <PortalSection>
        <PortalProfilesClient />
      </PortalSection>
    </PortalShell>
  );
}
