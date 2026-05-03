import { PortalRepositorySyncClient } from "../../../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const { slug = "repository" } = await params;
  return createPortalMetadata({
    title: `${slug} sync status`,
    description: "Repository CLI sync status, artifact versions, and next local-first action.",
    path: `/repositories/${slug}/sync`,
  });
}

export default async function RepositorySyncPage({ params }) {
  const { slug = "unknown" } = await params;
  return (
    <PortalShell
      title={`${slug} sync status`}
      description="CLI sync state and artifact versions for this repo."
    >
      <PortalSection eyebrow="CLI sync" title="Artifact sync">
        <PortalRepositorySyncClient slug={slug} />
      </PortalSection>
    </PortalShell>
  );
}
