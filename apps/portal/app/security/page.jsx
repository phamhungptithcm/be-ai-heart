import { PortalSecurityAuditClient } from "../../components/PortalSecurityAuditClient.jsx";
import { PortalSection, PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Security",
  description: "Legacy compatibility route for tenant-scoped security and audit visibility.",
  path: "/security",
});

export default function PortalSecurityPage() {
  return (
    <PortalShell title="Security" description="Legacy route for security, audit, and session visibility.">
      <PortalSection eyebrow="Compatibility" title="Security & audit" subtitle="Legacy route alias">
        <PortalSecurityAuditClient />
      </PortalSection>
    </PortalShell>
  );
}

