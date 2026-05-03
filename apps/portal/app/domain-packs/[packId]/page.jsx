import { DomainPackDetailClient } from "../../../components/PortalDomainPacksClient.jsx";
import { PortalShell, PortalSection } from "../../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../../src/metadata.js";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const packId = resolvedParams?.packId ?? "tolling-management";
  return createPortalMetadata({
    title: "Domain Pack Detail",
    description: "Review pack layers, overlays, generated artifacts, source notes, benchmarks, and chat actions.",
    path: `/domain-packs/${packId}`,
  });
}

export default async function DomainPackDetailPage({ params }) {
  const resolvedParams = await params;
  const packId = resolvedParams?.packId ?? "tolling-management";
  return (
    <PortalShell
      title="Tolling Management Pack"
      description="Build generated domain memory, demo kit, website, proposal, benchmark, and AI context artifacts."
    >
      <PortalSection
        eyebrow="Domain Pack"
        title="Tolling Management"
        subtitle="Layer-aware pack builder with source citations and security warnings"
      >
        <DomainPackDetailClient packId={packId} />
      </PortalSection>
    </PortalShell>
  );
}
