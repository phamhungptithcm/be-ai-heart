import { PortalRepositoryBenchmarkClient } from "../../../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const { slug = "repository" } = await params;
  return createPortalMetadata({
    title: `${slug} benchmark ROI`,
    description: "Repository benchmark and ROI evidence.",
    path: `/repositories/${slug}/benchmarks`,
  });
}

export default async function RepositoryBenchmarksPage({ params }) {
  const { slug = "unknown" } = await params;
  return (
    <PortalShell
      title={`${slug} benchmarks / ROI`}
      description="Measured and estimated ROI evidence for this repo."
    >
      <PortalSection eyebrow="Benchmark ROI" title="Repo benchmark evidence">
        <PortalRepositoryBenchmarkClient slug={slug} />
      </PortalSection>
    </PortalShell>
  );
}
