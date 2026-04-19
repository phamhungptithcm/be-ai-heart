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
    <PortalShell title="Benchmarks" description="Benchmark evidence, report history, and rollout proof for the customer workspace.">
      <PortalSection eyebrow="Launch" title="Run a benchmark from the portal" subtitle="Workspace-scoped local runner">
        <Suspense fallback={null}>
          <PortalBenchmarkLauncherClient />
        </Suspense>
      </PortalSection>
      <PortalSection eyebrow="ROI snapshot" title="Benchmark snapshot" subtitle="Workspace-level proof">
        <PortalBenchmarkSummaryClient />
      </PortalSection>
      <PortalSection eyebrow="Report history" title="Published report archive" subtitle="Customer-facing benchmark outputs">
        <PortalBenchmarkHistoryClient />
      </PortalSection>
    </PortalShell>
  );
}
