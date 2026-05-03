import { PortalPoliciesClient } from "../../components/PortalPoliciesClient.jsx";
import { PortalSection, PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Policies",
  description: "Legacy compatibility route for policy and guardrail visibility.",
  path: "/policies",
});

export default function PortalPoliciesPage() {
  return (
    <PortalShell title="Policies" description="Workspace guardrails and policy warnings.">
      <PortalSection eyebrow="Governance" title="Policy warnings">
        <PortalPoliciesClient />
      </PortalSection>
    </PortalShell>
  );
}
