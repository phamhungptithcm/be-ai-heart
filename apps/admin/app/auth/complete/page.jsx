import { Suspense } from "react";

import { AdminAuthCompletionClient } from "../../../components/AdminAuthCompletionClient.jsx";
import { AdminShell } from "../../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Finishing sign in",
  description: "Completes the hosted admin authentication flow and establishes an internal session.",
  path: "/auth/complete",
});

export default function AdminAuthCompletePage() {
  return (
    <AdminShell title="Finishing internal sign-in" description="Completing the hosted internal auth flow and establishing an admin session.">
      <Suspense fallback={<p className="admin-empty">Finishing internal sign-in...</p>}>
        <AdminAuthCompletionClient />
      </Suspense>
    </AdminShell>
  );
}
