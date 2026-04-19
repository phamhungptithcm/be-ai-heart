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
      description="Review org profile, repo policy defaults, local-first sync controls, and hosted integration state."
    >
      <PortalSection
        eyebrow="Configuration"
        title="Organization and integration settings"
        subtitle="Tenant-safe profile and policy defaults"
      >
        <PortalSettingsClient />
      </PortalSection>
    </PortalShell>
  );
}

