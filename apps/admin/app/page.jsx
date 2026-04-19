import { AdminOverviewControlClient } from "../components/AdminOverviewControlClient.jsx";
import { AdminShell, AdminSection } from "../components/AdminShell.jsx";
import { createAdminMetadata } from "../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Workspace overview",
  description: "Internal overview for customer footing, supportable repositories, and platform operating signals.",
  path: "/",
});

export default function AdminHomePage() {
  return (
    <AdminShell
      title="Internal control plane"
      description="Track org health, trials, sync risk, observability posture, and expansion readiness from one internal control plane."
      shellMode="overview"
      showToolbar={false}
    >
      <AdminSection eyebrow="Internal cockpit" title="Operational and commercial overview" subtitle="Trials, org health, failures, and alert posture">
        <AdminOverviewControlClient />
      </AdminSection>
    </AdminShell>
  );
}
