import { PortalModelsClient } from "../../components/PortalProductWorkflowsClient.jsx";
import { PortalShell, PortalSection } from "../../components/PortalShell.jsx";
import { createPortalMetadata } from "../../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Models",
  description: "Model provider settings, presets, masked key state, and token budgets.",
  path: "/models",
});

export default function PortalModelsPage() {
  return (
    <PortalShell
      title="Models"
      description="Provider, model, and budget defaults."
    >
      <PortalSection>
        <PortalModelsClient />
      </PortalSection>
    </PortalShell>
  );
}
