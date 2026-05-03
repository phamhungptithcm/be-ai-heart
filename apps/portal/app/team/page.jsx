import { PortalMembersAccessClient } from "../../components/PortalMembersAccessClient.jsx";
import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Team",
  description: "Customer team members and access posture.",
  path: "/team",
});

export default function PortalTeamPage() {
  return (
    <PortalShell
      title="Team"
      description="Members, roles, and access posture."
    >
      <PortalSection eyebrow="Team" title="Members and access">
        <PortalMembersAccessClient />
      </PortalSection>
    </PortalShell>
  );
}
