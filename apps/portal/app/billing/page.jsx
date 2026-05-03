import { PortalBillingSnapshotClient } from "../../components/PortalBillingSnapshotClient.jsx";
import { PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Billing",
  description: "Customer billing surface for plan visibility, seat model, and expansion readiness tied to benchmark proof.",
  path: "/billing",
});

export default function PortalBillingPage() {
  return (
    <PortalShell
      title="Billing"
      description="Plan, seats, entitlements, and invoices."
    >
      <PortalBillingSnapshotClient />
    </PortalShell>
  );
}
