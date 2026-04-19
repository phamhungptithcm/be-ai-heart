import { AdminCustomerProfileClient } from "../../../components/AdminCustomerProfileClient.jsx";
import { AdminShell } from "../../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug ?? "customer";

  return createAdminMetadata({
    title: `Support view for ${slug}`,
    description: "Internal customer repository profile view for support, benchmark context, and document memory review.",
    path: `/customers/${slug}`,
  });
}

export default async function CustomerSupportPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug ?? "unknown";

  return (
    <AdminShell title={`Support view for ${slug}`} description="Internal support page for a synced customer repository profile.">
      <AdminCustomerProfileClient slug={slug} />
    </AdminShell>
  );
}
