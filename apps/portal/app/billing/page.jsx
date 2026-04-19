import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Billing",
  description: "Customer billing surface for plan visibility, seat model, and expansion readiness tied to benchmark proof.",
  path: "/billing",
});

export default function PortalBillingPage() {
  return (
    <PortalShell title="Billing and plan control" description="Billing belongs in the customer portal because plan, seats, synced repositories, and upgrade timing should all stay visible to the buyer.">
      <PortalSection
        eyebrow="Commercial control"
        title="Billing should answer whether the workspace is earning its cost."
        subtitle="Seat count and plan changes only make sense when usage, project memory depth, and benchmark proof all line up."
      >
        <div className="portal-stat-grid">
          <div><span>Plan status</span><strong>Pilot</strong></div>
          <div><span>Seat model</span><strong>Per active dev</strong></div>
          <div><span>Expansion gate</span><strong>ROI proof</strong></div>
          <div><span>Portal scope</span><strong>Tenant-scoped</strong></div>
        </div>
      </PortalSection>

      <PortalSection
        eyebrow="What belongs here"
        title="Billing should stay connected to operational truth."
        subtitle="The customer should be able to see why an upgrade is justified without leaving the portal."
      >
        <div className="portal-control-grid">
          <article>
            <span>Seats and access</span>
            <h3>Match plan to real users</h3>
            <p>Seat count should follow the engineers actually relying on the heart in their daily AI workflow.</p>
          </article>
          <article>
            <span>Repository coverage</span>
            <h3>Know what the plan is unlocking</h3>
            <p>Billing should map cleanly to synced repository profiles, usage visibility, and document memory coverage.</p>
          </article>
          <article>
            <span>Expansion timing</span>
            <h3>Upgrade after proof, not before</h3>
            <p>Customers should expand only after benchmarks and review cleanup data show the rollout is paying for itself.</p>
          </article>
        </div>
      </PortalSection>

      <PortalSection
        eyebrow="Buyer checklist"
        title="Use the portal to decide whether the team is ready to expand."
        subtitle="Smaller teams need a lightweight, rational upgrade path."
      >
        <div className="portal-checklist-grid">
          <article>
            <span>Repository signal</span>
            <h3>Project memory is current</h3>
            <ul>
              <li>Fresh repository profiles</li>
              <li>Docs and diagrams visible to the team</li>
              <li>Missing context warnings are understandable</li>
            </ul>
          </article>
          <article>
            <span>Economic signal</span>
            <h3>Benchmarks show savings</h3>
            <ul>
              <li>Token cost is trending down</li>
              <li>Review cleanup is reduced</li>
              <li>Context refresh effort is lower</li>
            </ul>
          </article>
          <article>
            <span>Team signal</span>
            <h3>More users are justified</h3>
            <ul>
              <li>Another repo is ready to onboard</li>
              <li>At least one champion trusts the workflow</li>
              <li>The team can interpret portal metrics clearly</li>
            </ul>
          </article>
        </div>
      </PortalSection>
    </PortalShell>
  );
}
