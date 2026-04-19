import { PortalOperationsDashboardClient } from "../../components/PortalOperationsDashboardClient.jsx";
import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Usage",
  description: "Customer usage view for savings, sync freshness, and project-memory depth across workspace repositories.",
  path: "/usage",
});

export default function PortalUsagePage() {
  return (
    <PortalShell title="Usage and savings" description="This customer-facing usage surface is where token savings, money saved, sync freshness, and project-memory depth should become visible over time.">
      <PortalSection eyebrow="Customer cockpit" title="Operational savings board" subtitle="Token, money, memory, and readiness in one tenant-scoped view">
        <PortalOperationsDashboardClient />
      </PortalSection>
      <PortalSection eyebrow="Operational view" title="What customers should monitor" subtitle="Operational visibility goals">
        <div className="portal-rail-list">
          <article>
            <span>Sync</span>
            <div>
              <h3>Profile freshness</h3>
              <p>Know which repositories are stale and need a new sync before using AI on them heavily.</p>
            </div>
          </article>
          <article>
            <span>Memory</span>
            <div>
              <h3>Context depth</h3>
              <p>Track whether code, documents, and linked decisions are actually loaded for the important repos.</p>
            </div>
          </article>
          <article>
            <span>ROI</span>
            <div>
              <h3>Cost and volume</h3>
              <p>This page should eventually show token and request patterns without mixing them into the public website narrative.</p>
            </div>
          </article>
        </div>
      </PortalSection>
    </PortalShell>
  );
}
