import { AdminBillingOpsClient } from "../../components/AdminBillingOpsClient.jsx";
import { AdminSection, AdminShell } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Billing Ops",
  description: "Internal billing status, entitlements, plan posture, and adapter-friendly provider readiness.",
  path: "/billing-ops",
});

export default function AdminBillingOpsPage() {
  return (
    <AdminShell
      title="Billing ops"
      description="Review billing status, entitlements, plan posture, and upgrade readiness through mock-safe provider contracts."
    >
      <AdminSection eyebrow="Commercial operations" title="Billing and entitlement posture" subtitle="Adapter-friendly mock/live billing contract">
        <AdminBillingOpsClient />
      </AdminSection>
    </AdminShell>
  );
}

