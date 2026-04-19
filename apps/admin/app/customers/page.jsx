import { AdminCustomerInventoryClient } from "../../components/AdminCustomerInventoryClient.jsx";
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
    <AdminShell title="Customers" description="Internal account inventory with health, readiness, renewal posture, and linked repository inventory.">
      <AdminSection eyebrow="Accounts" title="Customer account inventory" subtitle="Health, readiness, billing posture, and renewal context">
        <AdminCustomerInventoryClient />
      </AdminSection>
      <AdminSection eyebrow="Repository inventory" title="Mirrored repository support inventory" subtitle="Linked repository profiles for follow-through">
        <AdminProfilesClient />
      </AdminSection>
    </AdminShell>
  );
}
