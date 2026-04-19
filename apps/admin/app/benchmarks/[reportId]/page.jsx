import { AdminBenchmarkReportClient } from "../../../components/AdminBenchmarkReportClient.jsx";
import { AdminShell } from "../../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const reportId = resolvedParams?.reportId ?? "benchmark-report";

  return createAdminMetadata({
    title: `Benchmark report ${reportId}`,
    description: "Internal benchmark detail for rollout analysis, sales support, and customer ROI review.",
    path: `/benchmarks/${reportId}`,
  });
}

export default async function AdminBenchmarkReportPage({ params }) {
  const resolvedParams = await params;
  const reportId = resolvedParams?.reportId ?? "unknown";

  return (
    <AdminShell
      title={`Benchmark report ${reportId}`}
      description="Internal benchmark detail for rollout analysis, sales support, and customer ROI review."
    >
      <AdminBenchmarkReportClient reportId={reportId} />
    </AdminShell>
  );
}
