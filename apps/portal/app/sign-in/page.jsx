import { AuthProviderCards } from "../../../website/components/AuthProviderCards.jsx";
import { PortalSection, PortalShell } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Sign in",
  description: "Portal sign-in for tenant-scoped customer access through the hosted API auth flow.",
  path: "/sign-in",
});

export default function PortalSignInPage() {
  return (
    <PortalShell
      title="Portal sign-in"
      description="Use the hosted provider flow to open a customer workspace session backed by the standalone BeHeart API host and scoped to the right tenant."
    >
      <PortalSection eyebrow="Access" title="Available providers" subtitle="Configured on the standalone API host">
        <AuthProviderCards surface="portal" />
      </PortalSection>

      <PortalSection
        eyebrow="Trust boundary"
        title="The portal sign-in page should make the session boundary obvious."
        subtitle="Customers need to know what the provider is doing and what becomes visible after sign-in."
      >
        <div className="portal-control-grid">
          <article>
            <span>Identity</span>
            <h3>Provider verifies the user</h3>
            <p>The hosted auth layer handles OIDC exchange and returns a scoped session for the customer workspace.</p>
          </article>
          <article>
            <span>Scope</span>
            <h3>Tenant-scoped data</h3>
            <p>Repository profiles, docs, and benchmark artifacts should match the workspace the user is allowed to inspect.</p>
          </article>
          <article>
            <span>Next action</span>
            <h3>Land in the operational workspace</h3>
            <p>After sign-in, the portal should immediately surface the repositories, usage, and ROI views that justify continued adoption.</p>
          </article>
        </div>
      </PortalSection>
    </PortalShell>
  );
}
