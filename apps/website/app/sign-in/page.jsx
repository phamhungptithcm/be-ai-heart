import { AuthProviderCards } from "../../components/AuthProviderCards.jsx";
import { PortalFlowVisual } from "../../components/PortalFlowVisual.jsx";
import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Sign In",
  description: "Route from the public website into a tenant-scoped portal session handled by the hosted API layer.",
  path: "/sign-in",
  keywords: ["sign in", "OIDC", "portal", "hosted auth"],
});

export default function SignInPage() {
  const portalBaseUrl =
    process.env.NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL ?? "http://127.0.0.1:3001";

  return (
    <WebsiteShell
      eyebrow="Hosted Authentication"
      title={
        <>
          Open the portal with{" "}
          <span className="website-highlight">a scoped BeHeart session.</span>
        </>
      }
      description="Auth belongs to the hosted API layer. The website explains the value, then routes the user into the BeHeart portal where repository memory, diagrams, docs, and benchmark reports are available."
      actions={[
        { label: "Open Portal", href: `${portalBaseUrl}/sign-in`, primary: true },
        { label: "Start Trial", href: "/start-trial" },
      ]}
      nav={["home", "product", "benchmark", "pricing", "docs", "security", "sign-in"]}
      accent="teal"
      aside={<PortalFlowVisual />}
    >
      <WebsiteSection
        eyebrow="Sign-in architecture"
        title="Public website, auth host, and portal have different jobs."
        description="This split keeps acquisition clean while customer state, sessions, and tenant access stay on the service side."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Website</h3>
            <p>Explains value, benchmark proof, docs, pricing, and routes users toward trial or sign-in.</p>
          </div>
          <div>
            <h3>API host</h3>
            <p>Handles Auth0 or Clerk OIDC exchange, session issuance, and tenant-scoped service APIs.</p>
          </div>
          <div>
            <h3>Portal</h3>
            <p>Shows synced repositories, diagrams, documents, benchmark history, and workspace settings.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Providers"
        title="Choose the hosted provider configured for your workspace."
        description="The cards below come directly from the standalone API host, not from hardcoded website state."
      >
        <AuthProviderCards surface="portal" />
      </WebsiteSection>

    </WebsiteShell>
  );
}
