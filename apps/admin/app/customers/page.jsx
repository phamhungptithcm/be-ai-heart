import { AdminProfilesClient } from "../../components/AdminProfilesClient.jsx";
import { AdminShell, AdminSection } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Customers",
  description: "Internal customer and repository profile inventory for support, qualification, and follow-up.",
  path: "/customers",
});

export default function AdminCustomersPage() {
  return (
    <AdminShell title="Customers" description="Internal customer records and synced repository profiles live here for support and operational follow-up.">
      <AdminSection eyebrow="Accounts" title="Customer-linked repository profiles" subtitle="Mirrored support inventory">
        <AdminProfilesClient />
      </AdminSection>
    </AdminShell>
  );
}
