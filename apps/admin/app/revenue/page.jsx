import { AdminIntakeRequestsClient } from "../../components/AdminIntakeRequestsClient.jsx";
import { AdminBenchmarkSummaryClient } from "../../components/AdminBenchmarkSummaryClient.jsx";
import { AdminRevenueCommandCenterClient } from "../../components/AdminRevenueCommandCenterClient.jsx";
import { AdminShell, AdminSection } from "../../components/AdminShell.jsx";
import { createAdminMetadata } from "../../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Revenue",
  description: "Internal revenue view for demo and trial intake, benchmark proof, and expansion-readiness signals.",
  path: "/revenue",
});

export default function AdminRevenuePage() {
  return (
    <AdminShell title="Revenue and retention" description="Revenue belongs in internal admin because it is part of owner operations, not the customer portal.">
      <AdminSection eyebrow="Owner cockpit" title="Commercial and retention command center" subtitle="Pipeline, benchmark proof, and expansion signals in one internal view">
        <AdminRevenueCommandCenterClient />
      </AdminSection>
      <AdminSection eyebrow="Revenue operations" title="Revenue should stay tied to proof and support load" subtitle="Owner operations">
        <div className="admin-control-grid">
          <article>
            <span>Pipeline</span>
            <h3>Track design-partner conversion</h3>
            <p>Move from local proof to portal adoption to paid expansion with benchmark evidence at each step.</p>
          </article>
          <article>
            <span>Pricing</span>
            <h3>Connect seats to actual usage</h3>
            <p>Commercial plans should track who is using the product and how much operational support each account requires.</p>
          </article>
          <article>
            <span>Retention</span>
            <h3>Watch customer health before churn</h3>
            <p>Benchmark value, sync activity, and support issues should all feed retention judgment before revenue drops.</p>
          </article>
        </div>
      </AdminSection>

      <AdminSection eyebrow="Commercial reading" title="How the owner should interpret this page" subtitle="What matters more than headline MRR">
        <div className="admin-checklist-grid">
          <article>
            <span>Proof</span>
            <h3>ROI supports the story</h3>
            <ul>
              <li>Reports show cost or cleanup improvement</li>
              <li>Managers can explain the delta internally</li>
              <li>The product is not being sold on aesthetics alone</li>
            </ul>
          </article>
          <article>
            <span>Delivery</span>
            <h3>Support burden is acceptable</h3>
            <ul>
              <li>Customers are not blocked by basic sync issues</li>
              <li>Portal language is clear enough to self-serve</li>
              <li>Admin can see account health quickly</li>
            </ul>
          </article>
          <article>
            <span>Expansion</span>
            <h3>The next upgrade is earned</h3>
            <ul>
              <li>Another repo or seat adds real value</li>
              <li>The team is already using the heart consistently</li>
              <li>Security and trust concerns are addressed early</li>
            </ul>
          </article>
        </div>
      </AdminSection>

      <AdminSection eyebrow="Source tables" title="Underlying intake and ROI tables" subtitle="Detailed raw views still available below the command center">
        <div className="admin-stack-block">
          <AdminIntakeRequestsClient />
          <AdminBenchmarkSummaryClient />
        </div>
      </AdminSection>
    </AdminShell>
  );
}
