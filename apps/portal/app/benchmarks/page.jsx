import { Suspense } from "react";

import {
  PortalBenchmarkHistoryClient,
  PortalBenchmarkSummaryClient,
} from "../../components/PortalBenchmarkHistoryClient.jsx";
import { PortalBenchmarkLauncherClient } from "../../components/PortalBenchmarkLauncherClient.jsx";
import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Benchmarks",
  description: "Customer benchmark history and ROI visibility for token savings, memory savings, and rollout proof.",
  path: "/benchmarks",
});

export default function PortalBenchmarksPage() {
  return (
    <PortalShell title="Benchmarks" description="Run and review benchmark evidence without fake precision.">
      <PortalSection eyebrow="Launch" title="Run benchmark">
        <Suspense fallback={null}>
          <PortalBenchmarkLauncherClient />
        </Suspense>
      </PortalSection>
      <PortalSection eyebrow="ROI snapshot" title="Evidence snapshot">
        <PortalBenchmarkSummaryClient />
      </PortalSection>
      <PortalSection eyebrow="Report history" title="Report archive">
        <PortalBenchmarkHistoryClient />
      </PortalSection>
    </PortalShell>
  );
}
