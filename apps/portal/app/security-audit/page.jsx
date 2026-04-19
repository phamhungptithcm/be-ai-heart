import { PortalSecurityAuditClient } from "../../components/PortalSecurityAuditClient.jsx";
import { PortalSection, PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Security & Audit",
  description: "Tenant-scoped audit events, session history, provider posture, and retention/export status.",
  path: "/security-audit",
});

export default function PortalSecurityAuditPage() {
  return (
    <PortalShell
      title="Security & audit"
      description="Inspect tenant-scoped audit activity, sanitized session history, provider posture, and retention/export status."
    >
      <PortalSection
        eyebrow="Security"
        title="Security posture"
        subtitle="Auditability, sessions, and export controls"
      >
        <PortalSecurityAuditClient />
      </PortalSection>
    </PortalShell>
  );
}

