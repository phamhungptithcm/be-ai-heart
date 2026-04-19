export function PortalFlowVisual() {
  return (
    <div className="portal-flow-visual">
      <div className="portal-flow-step">
        <span>1</span>
        <div>
          <strong>Website</strong>
          <p>User starts from pricing, docs, or benchmark proof.</p>
        </div>
      </div>
      <div className="portal-flow-rail" />
      <div className="portal-flow-step">
        <span>2</span>
        <div>
          <strong>Hosted auth</strong>
          <p>Auth0 or Clerk creates a scoped session on the API host.</p>
        </div>
      </div>
      <div className="portal-flow-rail" />
      <div className="portal-flow-step">
        <span>3</span>
        <div>
          <strong>Portal</strong>
          <p>Repository profiles, diagrams, docs, and savings metrics become visible.</p>
        </div>
      </div>
    </div>
  );
}
