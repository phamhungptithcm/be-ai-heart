import {
  PortalBenchmarkHistoryClient,
  PortalBenchmarkSummaryClient,
} from "../../components/PortalBenchmarkHistoryClient.jsx";
import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Benchmarks",
  description: "Customer benchmark history and ROI visibility for token savings, memory savings, and rollout proof.",
  path: "/benchmarks",
});

export default function PortalBenchmarksPage() {
  return (
    <PortalShell title="Benchmarks" description="Customer benchmark visibility belongs in the portal because this is where teams decide if AI rollout is saving money or just burning it differently.">
      <PortalSection eyebrow="ROI snapshot" title="Current benchmark-ready signals" subtitle="Workspace-level snapshot">
        <PortalBenchmarkSummaryClient />
      </PortalSection>
      <PortalSection eyebrow="Report history" title="What will live here" subtitle="Customer-facing benchmark outputs">
        <PortalBenchmarkHistoryClient />
      </PortalSection>
    </PortalShell>
  );
}
