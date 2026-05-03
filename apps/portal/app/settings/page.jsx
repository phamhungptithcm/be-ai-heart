import { PortalSettingsClient } from "../../components/PortalSettingsClient.jsx";
import { PortalSection, PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Settings",
  description: "Org profile, repo policy defaults, retention controls, and integration state for the customer portal.",
  path: "/settings",
});

export default function PortalSettingsPage() {
  return (
    <PortalShell
      title="Settings"
      description="Org profile, policy defaults, and integration state."
    >
      <PortalSection eyebrow="Configuration" title="Org settings">
        <PortalSettingsClient />
      </PortalSection>
    </PortalShell>
  );
}
