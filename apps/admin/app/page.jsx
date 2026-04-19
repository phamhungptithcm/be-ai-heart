import { AdminRevenueCommandCenterClient } from "../components/AdminRevenueCommandCenterClient.jsx";
import { AdminProfilesClient } from "../components/AdminProfilesClient.jsx";
import { AdminWorkspaceSummaryClient } from "../components/AdminWorkspaceSummaryClient.jsx";
import { AdminShell, AdminSection } from "../components/AdminShell.jsx";
import { createAdminMetadata } from "../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Workspace overview",
  description: "Internal overview for customer footing, supportable repositories, and platform operating signals.",
  path: "/",
});

export default function AdminHomePage() {
  return (
    <AdminShell title="Owner command center" description="Operational visibility for customers, synced repositories, support activity, revenue, retention, and hosted platform health.">
      <AdminSection eyebrow="Owner cockpit" title="Commercial and platform control center" subtitle="Pipeline, expansion readiness, and benchmark-backed retention signals">
        <AdminRevenueCommandCenterClient />
      </AdminSection>
      <AdminSection eyebrow="Cross-customer footing" title="Workspace registry" subtitle="Cross-customer operational footing and retention risk context">
        <AdminWorkspaceSummaryClient />
      </AdminSection>
      <AdminSection eyebrow="Support inventory" title="Supportable repository profiles" subtitle="Profiles mirrored for support, analytics, and revenue operations">
        <AdminProfilesClient />
      </AdminSection>
    </AdminShell>
  );
}
