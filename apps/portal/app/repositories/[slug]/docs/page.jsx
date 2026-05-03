import { PortalRepositoryDocsClient } from "../../../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const { slug = "repository" } = await params;
  return createPortalMetadata({
    title: `${slug} docs and specs`,
    description: "Repository docs, specs, decisions, and business requirements memory.",
    path: `/repositories/${slug}/docs`,
  });
}

export default async function RepositoryDocsPage({ params }) {
  const { slug = "unknown" } = await params;
  return (
    <PortalShell
      title={`${slug} docs`}
      description="Specs, decisions, and business requirements attached to this repo."
    >
      <PortalSection eyebrow="Docs memory" title="Repo docs">
        <PortalRepositoryDocsClient slug={slug} />
      </PortalSection>
    </PortalShell>
  );
}
