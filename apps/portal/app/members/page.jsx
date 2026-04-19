import { PortalMembersAccessClient } from "../../components/PortalMembersAccessClient.jsx";
import { PortalSection, PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Members",
  description: "Legacy compatibility route for tenant-scoped team and access visibility.",
  path: "/members",
});

export default function PortalMembersPage() {
  return (
    <PortalShell title="Members" description="Legacy route for team and access visibility.">
      <PortalSection eyebrow="Compatibility" title="Team & access" subtitle="Legacy route alias">
        <PortalMembersAccessClient />
      </PortalSection>
    </PortalShell>
  );
}

