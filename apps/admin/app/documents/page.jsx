import { AdminDocumentsWorkspaceClient } from "../../components/AdminDocumentsWorkspaceClient.jsx";
import { AdminShell } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Documents",
  description: "Internal document oversight for submissions, mirrored repository memory, and support-safe requirement visibility.",
  path: "/documents",
});

export default function AdminDocumentsPage() {
  return (
    <AdminShell
      title="Documents"
      description="Internal document oversight for customer submissions, mirrored repository memory, and support-safe visibility into changing requirements."
    >
      <AdminDocumentsWorkspaceClient />
    </AdminShell>
  );
}
