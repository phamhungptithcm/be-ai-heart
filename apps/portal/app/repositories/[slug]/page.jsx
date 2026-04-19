import { PortalRepositoryProfileClient } from "../../../components/PortalRepositoryProfileClient.jsx";
import { PortalShell } from "../../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug ?? "repository";

  return createPortalMetadata({
    title: `${slug} repository profile`,
    description: "Customer view of synced project memory, diagrams, documents, and repository-level efficiency signals.",
    path: `/repositories/${slug}`,
  });
}

export default async function RepositoryProfilePage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug ?? "unknown";

  return (
    <PortalShell
      title={`${slug} repository profile`}
      description="Customer view of synced project memory, visual diagrams, and repository-level operational context."
    >
      <PortalRepositoryProfileClient slug={slug} />
    </PortalShell>
  );
}
