export function MemorySignalVisual() {
  return (
    <div className="memory-visual">
      <div className="memory-visual-head">
        <span>local-first</span>
        <span>CLI + MCP + portal</span>
      </div>

      <div className="memory-stage">
        <div className="memory-ring memory-ring-one" />
        <div className="memory-ring memory-ring-two" />
        <div className="memory-ring memory-ring-three" />

        <div className="memory-core">
          <p>project heart</p>
          <strong>context that keeps AI aligned</strong>
        </div>

        <div className="memory-node memory-node-code">
          <span>Code Graph</span>
          <strong>6.5k symbols</strong>
        </div>
        <div className="memory-node memory-node-docs">
          <span>Document Memory</span>
          <strong>Requirements + ADRs</strong>
        </div>
        <div className="memory-node memory-node-policy">
          <span>Policy Rails</span>
          <strong>Reuse and boundaries</strong>
        </div>
        <div className="memory-node memory-node-roi">
          <span>Benchmark ROI</span>
          <strong>token, time, cleanup</strong>
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
            <span>$</span> heart scan --incremental
          </p>
          <p>
            <span>$</span> heart pack "add billing audit trail"
          </p>
          <p>
            <span>$</span> heart benchmark run scenarios/login-audit-flow.json
          </p>
        </div>
      </div>
    </div>
  );
}
