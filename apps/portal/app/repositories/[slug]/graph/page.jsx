import { PortalRepositoryGraphClient } from "../../../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const { slug = "repository" } = await params;
  return createPortalMetadata({
    title: `${slug} graph`,
    description: "Repository graph summary and explorer.",
    path: `/repositories/${slug}/graph`,
  });
}

export default async function RepositoryGraphPage({ params }) {
  const { slug = "unknown" } = await params;
  return (
    <PortalShell
      title={`${slug} graph`}
      description="Live relationship viewer from the latest synced graph artifact."
    >
      <PortalSection eyebrow="Graph" title="Live graph">
        <PortalRepositoryGraphClient slug={slug} />
      </PortalSection>
    </PortalShell>
  );
}
