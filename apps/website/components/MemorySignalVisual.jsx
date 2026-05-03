export function MemorySignalVisual() {
  return (
    <div className="memory-visual">
      <div className="memory-visual-head">
        <span>Repo memory loop</span>
        <span>CLI + portal + MCP</span>
      </div>

      <div className="memory-stage">
        <div className="memory-ring memory-ring-one" />
        <div className="memory-ring memory-ring-two" />
        <div className="memory-ring memory-ring-three" />

        <div className="memory-core">
          <p>project heart</p>
          <strong>durable memory for AI work</strong>
        </div>

        <div className="memory-node memory-node-code">
          <span>Repo Graph</span>
          <strong>symbols and impact paths</strong>
        </div>
        <div className="memory-node memory-node-docs">
          <span>Docs and Specs</span>
          <strong>requirements and decisions</strong>
        </div>
        <div className="memory-node memory-node-policy">
          <span>Context Packs</span>
          <strong>reuse, risks, citations</strong>
        </div>
        <div className="memory-node memory-node-roi">
          <span>Benchmark ROI</span>
          <strong>evidence-labeled reports</strong>
        </div>
      </div>

      <div className="memory-terminal">
        <div className="memory-terminal-bar">
          <span />
          <span />
          <span />
        </div>
        <div className="memory-terminal-lines">
          <p>
            <span>$</span> heart scan
          </p>
          <p>
            <span>$</span> heart chat --context repo "plan safe rollout"
          </p>
          <p>
            <span>$</span> heart packs build tolling-management --output sales-demo-kit
          </p>
        </div>
      </div>
    </div>
  );
}
