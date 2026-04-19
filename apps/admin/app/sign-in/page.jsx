import { AuthProviderCards } from "../../../website/components/AuthProviderCards.jsx";
import { AdminSection, AdminShell } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Sign in",
  description: "Internal admin sign-in for the BeHeart control plane.",
  path: "/sign-in",
});

export default function AdminSignInPage() {
  return (
    <AdminShell
      title="Admin sign-in"
      description="Use the hosted provider flow to open an internal control-plane session backed by the standalone BeHeart API host."
    >
      <AdminSection eyebrow="Internal access" title="Available providers" subtitle="Configured on the standalone API host">
        <AuthProviderCards surface="admin" />
      </AdminSection>
      <AdminSection eyebrow="Trust boundary" title="Internal admin stays separate from the customer portal." subtitle="Identity, RBAC, and control-plane scope">
        <div className="admin-control-grid">
          <article>
            <span>Identity</span>
            <h3>Provider verifies the internal operator</h3>
            <p>The hosted auth layer handles OIDC exchange and returns an internal-only admin session.</p>
          </article>
          <article>
            <span>Scope</span>
            <h3>RBAC gates admin pages and controls</h3>
            <p>Internal roles decide which control-plane pages and actions are visible after login.</p>
          </article>
          <article>
            <span>Separation</span>
            <h3>Customer data stays separate from admin tooling</h3>
            <p>The website, portal, and admin surfaces stay distinct even when they share the same API host.</p>
          </article>
        </div>
      </AdminSection>
    </AdminShell>
  );
}

