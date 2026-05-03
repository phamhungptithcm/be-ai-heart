import { PortalRepositoryDiagramsClient } from "../../../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const { slug = "repository" } = await params;
  return createPortalMetadata({
    title: `${slug} diagrams`,
    description: "Generated repository diagrams with confidence and citations.",
    path: `/repositories/${slug}/diagrams`,
  });
}

export default async function RepositoryDiagramsPage({ params }) {
  const { slug = "unknown" } = await params;
  return (
    <PortalShell
      title={`${slug} diagrams`}
      description="Generated Mermaid diagrams with source and confidence labels."
    >
      <PortalSection eyebrow="Diagrams" title="Live diagram viewer">
        <PortalRepositoryDiagramsClient slug={slug} />
      </PortalSection>
    </PortalShell>
  );
}
