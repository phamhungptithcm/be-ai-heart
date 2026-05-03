const VISUAL_COPY = {
  product: {
    eyebrow: "Product loop",
    title: "Memory to agent to proof",
    lanes: ["Repo memory", "CLI AI agent", "Portal chat", "Benchmark evidence"],
    command: 'heart chat --context repo "plan rollout"',
  },
  workflow: {
    eyebrow: "Local-first loop",
    title: "Repo to MCP to portal",
    lanes: ["CLI scan", "Context pack", "MCP runtime", "Portal sync"],
    command: "heart mcp tools",
  },
  benchmark: {
    eyebrow: "Evidence loop",
    title: "Baseline vs assisted",
    lanes: ["Same task", "Same repo", "Evidence mode", "Buyer report"],
    command: "heart benchmark run --scenario billing-doc-required",
  },
};

export function WebsiteProductMotionVisual({ variant = "product" }) {
  const copy = VISUAL_COPY[variant] ?? VISUAL_COPY.product;

  return (
    <div className="website-product-motion" aria-label={`${copy.title} visual`}>
      <div className="website-product-motion-head">
        <span>{copy.eyebrow}</span>
        <strong>{copy.title}</strong>
      </div>
      <div className="website-product-orbit" aria-hidden="true">
        <i data-node="repo">Repo</i>
        <i data-node="heart">Heart</i>
        <i data-node="agent">Agent</i>
        <i data-node="proof">Proof</i>
      </div>
      <div className="website-product-motion-lanes">
        {copy.lanes.map((lane, index) => (
          <div key={lane}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{lane}</strong>
            <i />
          </div>
        ))}
      </div>
      <div className="website-product-terminal">
        <span>local command</span>
        <code>{copy.command}</code>
      </div>
    </div>
  );
}
