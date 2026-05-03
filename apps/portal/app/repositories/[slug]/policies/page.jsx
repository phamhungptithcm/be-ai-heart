import { PortalRepositoryPoliciesClient } from "../../../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const { slug = "repository" } = await params;
  return createPortalMetadata({
    title: `${slug} policies`,
    description: "Repository policy warnings and governance state.",
    path: `/repositories/${slug}/policies`,
  });
}

export default async function RepositoryPoliciesPage({ params }) {
  const { slug = "unknown" } = await params;
  return (
    <PortalShell
      title={`${slug} policies / governance`}
      description="Policy warnings and rollout readiness for this repo."
    >
      <PortalSection eyebrow="Governance" title="Repo warnings">
        <PortalRepositoryPoliciesClient slug={slug} />
      </PortalSection>
    </PortalShell>
  );
}
