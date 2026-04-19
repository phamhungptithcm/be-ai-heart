import { PortalBenchmarkReportClient } from "../../../components/PortalBenchmarkReportClient.jsx";
import { PortalShell } from "../../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const reportId = resolvedParams?.reportId ?? "benchmark-report";

  return createPortalMetadata({
    title: `Benchmark report ${reportId}`,
    description: "Customer benchmark detail view with ROI proof and baseline vs heart-assisted comparison.",
    path: `/benchmarks/${reportId}`,
  });
}

export default async function PortalBenchmarkReportPage({ params }) {
  const resolvedParams = await params;
  const reportId = resolvedParams?.reportId ?? "unknown";

  return (
    <PortalShell
      title={`Benchmark report ${reportId}`}
      description="Customer-facing benchmark detail view showing ROI proof and run comparison."
    >
      <PortalBenchmarkReportClient reportId={reportId} />
    </PortalShell>
  );
}
