import { AdminSessionsAuditClient } from "../../components/AdminSessionsAuditClient.jsx";
import { AdminSection, AdminShell } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Sessions & Audit",
  description: "Internal session registry and audit-event visibility for admin operators.",
  path: "/sessions-audit",
});

export default function AdminSessionsAuditPage() {
  return (
    <AdminShell
      title="Sessions & audit"
      description="Inspect the internal session registry and audit-event history without leaving the control plane."
    >
      <AdminSection eyebrow="Internal governance" title="Session registry and audit trail" subtitle="Existing admin session and audit APIs surfaced in UI">
        <AdminSessionsAuditClient />
      </AdminSection>
    </AdminShell>
  );
}

