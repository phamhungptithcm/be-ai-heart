import { PortalMembersAccessClient } from "../../components/PortalMembersAccessClient.jsx";
import { PortalSection, PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Team & Access",
  description: "Tenant-scoped members, roles, SSO posture, invites, and active session visibility.",
  path: "/team-access",
});

export default function PortalTeamAccessPage() {
  return (
    <PortalShell
      title="Team & access"
      description="Review members, additive roles, SSO posture, invites, and active sessions without crossing the tenant boundary."
    >
      <PortalSection
        eyebrow="Governance"
        title="Org access controls"
        subtitle="Members, seat posture, and session visibility"
      >
        <PortalMembersAccessClient />
      </PortalSection>
    </PortalShell>
  );
}

