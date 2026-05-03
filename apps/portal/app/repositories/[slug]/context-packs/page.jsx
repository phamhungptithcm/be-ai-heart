import { PortalRepositoryContextPacksClient } from "../../../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const { slug = "repository" } = await params;
  return createPortalMetadata({
    title: `${slug} context packs`,
    description: "Repository context pack history and creation.",
    path: `/repositories/${slug}/context-packs`,
  });
}

export default async function RepositoryContextPacksPage({ params }) {
  const { slug = "unknown" } = await params;
  return (
    <PortalShell
      title={`${slug} context packs`}
      description="Task-scoped context generated from synced repo memory."
    >
      <PortalSection eyebrow="Context packs" title="Task packs">
        <PortalRepositoryContextPacksClient slug={slug} />
      </PortalSection>
    </PortalShell>
  );
}
