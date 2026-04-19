import { Suspense } from "react";

import { PortalShell, PortalSection } from "../../../components/PortalShell.jsx";
import { PortalAuthCompletionClient } from "../../../components/PortalAuthCompletionClient.jsx";
import { createPortalMetadata } from "../../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Completing sign in",
  description: "Portal auth completion bridge that converts provider auth into a scoped workspace session.",
  path: "/auth/complete",
});

export default function PortalAuthCompletePage() {
  return (
    <PortalShell
      title="Finishing sign-in"
      description="The API host has completed provider authentication and is handing the session back to the portal."
    >
      <PortalSection title="Authentication bridge" subtitle="Cross-origin session handoff">
        <Suspense fallback={<p className="portal-empty">Finishing sign-in...</p>}>
          <PortalAuthCompletionClient />
        </Suspense>
      </PortalSection>
    </PortalShell>
  );
}
