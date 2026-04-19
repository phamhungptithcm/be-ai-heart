"use client";

import { useDeferredValue, useEffect, useId, useState } from "react";

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.9;

export function PortalCodeGraphExplorer({
  service,
  requestedMode,
  onModeChange,
  loading = false,
  error = "",
} = {}) {
  const definitionId = useId().replace(/:/g, "_");
  const view = service?.view ?? null;
  const [searchQuery, setSearchQuery] = useState("");
  const [nodeTypeFilters, setNodeTypeFilters] = useState({});
  const [edgeTypeFilters, setEdgeTypeFilters] = useState({});
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState(null);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  useEffect(() => {
    if (!view) {
      return;
    }

    setNodeTypeFilters(createToggleState(view.total_node_type_counts ?? view.node_type_counts));
    setEdgeTypeFilters(createToggleState(view.total_edge_type_counts ?? view.edge_type_counts));
    setSelectedNodeId(pickInitialNodeId(view));
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [
    view?.mode,
    view?.node_count,
    view?.edge_count,
    view?.total_node_count,
    view?.total_edge_count,
  ]);

  if (!view) {
    return (
      <div className="portal-service-empty">
        <strong>Code graph snapshot is not available yet.</strong>
        <p>Run a fresh repository sync so the customer portal can load the visual graph explorer for this workspace.</p>
      </div>
    );
  }

  const graphData = buildVisibleGraphData({
    view,
    nodeTypeFilters,
    edgeTypeFilters,
    query: deferredSearchQuery,
  });
  const activeNode =
    graphData.nodes.find((node) => node.id === selectedNodeId) ?? graphData.nodes[0] ?? null;
  const inspector = activeNode
    ? buildNodeInspector({
        activeNode,
        nodes: graphData.nodes,
        edges: graphData.edges,
      })
    : null;

  function handleCanvasPointerDown(event) {
    if (event.target.closest("[data-graph-node='true']")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    });
  }

  function handleCanvasPointerMove(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setPan({
      x: dragState.originX + (event.clientX - dragState.startX) / zoom,
      y: dragState.originY + (event.clientY - dragState.startY) / zoom,
    });
  }

  function handleCanvasPointerUp(event) {
    if (dragState?.pointerId === event.pointerId) {
      setDragState(null);
    }
  }

  function handleCanvasWheel(event) {
    event.preventDefault();
    const nextZoom = clamp(
      zoom + (event.deltaY < 0 ? 0.12 : -0.12),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    setZoom(round(nextZoom, 2));
  }

  return (
    <div className="portal-graph-workspace">
      <div className="portal-graph-toolbar">
        <div>
          <span className="portal-service-toolbar-label">Graph controls</span>
          <h4>Visual dependency explorer</h4>
          <p>
            Focused mode loads the high-signal subgraph first. Full mode is available when the customer explicitly wants the wider map.
          </p>
        </div>
        <div className="portal-graph-toolbar-actions">
          <label className="portal-graph-search">
            <span>Search nodes</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Class, function, file, path"
            />
          </label>
          <div className="portal-graph-mode-group" role="tablist" aria-label="Code graph mode">
            <button
              type="button"
              className={requestedMode === "focused" ? "portal-graph-mode is-active" : "portal-graph-mode"}
              onClick={() => onModeChange?.("focused")}
              disabled={loading}
            >
              Focused
            </button>
            <button
              type="button"
              className={requestedMode === "full" ? "portal-graph-mode is-active" : "portal-graph-mode"}
              onClick={() => onModeChange?.("full")}
              disabled={loading}
            >
              Full
            </button>
          </div>
          <div className="portal-graph-zoom-group">
            <button type="button" onClick={() => setZoom((value) => round(clamp(value - 0.12, MIN_ZOOM, MAX_ZOOM), 2))}>
              −
            </button>
            <button type="button" onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}>
              Reset
            </button>
            <button type="button" onClick={() => setZoom((value) => round(clamp(value + 0.12, MIN_ZOOM, MAX_ZOOM), 2))}>
              +
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="portal-inline-banner portal-inline-banner-danger">
          <strong>Graph refresh failed</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="portal-graph-layout">
        <aside className="portal-graph-sidebar">
          <section className="portal-graph-sidebar-section">
            <span className="portal-service-toolbar-label">Node types</span>
            <div className="portal-graph-filter-list">
              {buildFilterEntries(view.total_node_type_counts ?? view.node_type_counts).map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className={nodeTypeFilters[entry.key] === false ? "portal-graph-filter is-muted" : "portal-graph-filter"}
                  onClick={() =>
                    setNodeTypeFilters((current) => ({
                      ...current,
                      [entry.key]: current[entry.key] === false,
                    }))
                  }
                >
                  <span>{entry.label}</span>
                  <strong>{entry.count}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="portal-graph-sidebar-section">
            <span className="portal-service-toolbar-label">Edge types</span>
            <div className="portal-graph-filter-list">
              {buildFilterEntries(view.total_edge_type_counts ?? view.edge_type_counts).map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className={edgeTypeFilters[entry.key] === false ? "portal-graph-filter is-muted" : "portal-graph-filter"}
                  onClick={() =>
                    setEdgeTypeFilters((current) => ({
                      ...current,
                      [entry.key]: current[entry.key] === false,
                    }))
                  }
                >
                  <span>{entry.label}</span>
                  <strong>{entry.count}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="portal-graph-sidebar-section">
            <span className="portal-service-toolbar-label">Visible scope</span>
            <div className="portal-summary-list portal-summary-list-tight">
              <article>
                <span>Nodes</span>
                <strong>{graphData.nodes.length}</strong>
                <p>{view.total_node_count} mapped in total.</p>
              </article>
              <article>
                <span>Edges</span>
                <strong>{graphData.edges.length}</strong>
                <p>{view.total_edge_count} mapped in total.</p>
              </article>
              <article>
                <span>Layout</span>
                <strong>{view.layout.algorithm}</strong>
                <p>{view.mode === "full" ? "Wider graph lane" : "Focused starter lane"}</p>
              </article>
            </div>
          </section>
        </aside>

        <div className="portal-graph-canvas-shell">
          <div className="portal-graph-canvas-meta">
            <span>{loading ? "Refreshing graph…" : `Showing ${graphData.nodes.length} nodes`}</span>
            <span>{graphData.queryMatchCount > 0 ? `${graphData.queryMatchCount} search match(es)` : "Pan, zoom, and inspect nodes"}</span>
          </div>
          <div className="portal-graph-canvas" onWheel={handleCanvasWheel}>
            <svg
              viewBox={`0 0 ${view.layout.width} ${view.layout.height}`}
              className="portal-graph-svg"
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerUp}
            >
              <defs>
                <pattern id={`portal-graph-grid-${definitionId}`} width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(148, 246, 211, 0.08)" strokeWidth="1" />
                </pattern>
                <radialGradient id={`portal-graph-glow-${definitionId}`} cx="50%" cy="50%" r="65%">
                  <stop offset="0%" stopColor="rgba(72, 242, 177, 0.12)" />
                  <stop offset="100%" stopColor="rgba(7, 17, 15, 0)" />
                </radialGradient>
              </defs>
              <rect width={view.layout.width} height={view.layout.height} fill={`url(#portal-graph-grid-${definitionId})`} />
              <rect width={view.layout.width} height={view.layout.height} fill={`url(#portal-graph-glow-${definitionId})`} />
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                {graphData.edges.map((edge) => {
                  const from = graphData.nodesById.get(edge.from);
                  const to = graphData.nodesById.get(edge.to);
                  if (!from || !to) {
                    return null;
                  }

                  const edgeIsActive =
                    activeNode &&
                    (activeNode.id === edge.from || activeNode.id === edge.to);
                  const labelVisible =
                    edgeIsActive || graphData.queryActive || graphData.edges.length <= 24;

                  return (
                    <g key={edge.id}>
                      <line
                        x1={from.position.x}
                        y1={from.position.y}
                        x2={to.position.x}
                        y2={to.position.y}
                        stroke={edge.color}
                        strokeOpacity={edgeIsActive ? "0.92" : "0.44"}
                        strokeWidth={edgeIsActive ? "2.2" : "1.3"}
                      />
                      {labelVisible ? (
                        <text
                          x={(from.position.x + to.position.x) / 2}
                          y={(from.position.y + to.position.y) / 2 - 6}
                          className="portal-graph-edge-label"
                        >
                          {edge.type_label}
                        </text>
                      ) : null}
                    </g>
                  );
                })}

                {graphData.nodes.map((node) => {
                  const isActive = activeNode?.id === node.id;
                  const isMatched = graphData.matchNodeIds.has(node.id);
                  return (
                    <g
                      key={node.id}
                      data-graph-node="true"
                      className={isActive ? "portal-graph-node is-active" : "portal-graph-node"}
                      onClick={() => setSelectedNodeId(node.id)}
                    >
                      {isActive ? (
                        <circle
                          cx={node.position.x}
                          cy={node.position.y}
                          r={node.radius + 9}
                          fill="rgba(255,255,255,0.04)"
                          stroke="rgba(255,255,255,0.35)"
                          strokeWidth="1.2"
                        />
                      ) : null}
                      <circle
                        cx={node.position.x}
                        cy={node.position.y}
                        r={node.radius}
                        fill={node.color}
                        stroke={isMatched ? "#ffffff" : "rgba(7, 17, 15, 0.88)"}
                        strokeWidth={isMatched ? "2.4" : "1.6"}
                      />
                      <text
                        x={node.position.x}
                        y={node.position.y + node.radius + 16}
                        className={isActive ? "portal-graph-node-label is-active" : "portal-graph-node-label"}
                      >
                        {node.label}
                      </text>
                      {isActive || isMatched ? (
                        <text
                          x={node.position.x}
                          y={node.position.y + node.radius + 30}
                          className="portal-graph-node-sublabel"
                        >
                          {node.secondary_label || node.type_label}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            </svg>
            <div className="portal-graph-stage-note">
              <strong>{view.is_truncated ? "Focused graph lane" : "Full graph lane"}</strong>
              <p>
                {view.is_truncated
                  ? "This view is intentionally narrowed to the highest-signal files, classes, and functions first."
                  : "This lane expands the repository map for broader inspection when the user asks for it."}
              </p>
            </div>
          </div>
        </div>

        <aside className="portal-graph-inspector">
          <section className="portal-graph-sidebar-section">
            <span className="portal-service-toolbar-label">Selected node</span>
            {inspector ? (
              <div className="portal-summary-list portal-summary-list-tight">
                <article>
                  <span>{inspector.node.type_label}</span>
                  <strong>{inspector.node.label}</strong>
                  <p>{inspector.node.secondary_label || inspector.node.path}</p>
                </article>
                <article>
                  <span>Signature</span>
                  <strong>{inspector.node.meta.signature || "No signature published"}</strong>
                  <p>{inspector.node.meta.container || "Top-level symbol or file node."}</p>
                </article>
                <article>
                  <span>Connected nodes</span>
                  <strong>{inspector.neighbors.length}</strong>
                  <p>{inspector.edges.length} visible edges from the current filtered view.</p>
                </article>
              </div>
            ) : (
              <div className="portal-service-empty">
                <strong>No node selected.</strong>
                <p>Pick a visible node to inspect its path, signature, and connected edges.</p>
              </div>
            )}
          </section>

          {inspector?.neighbors?.length ? (
            <section className="portal-graph-sidebar-section">
              <span className="portal-service-toolbar-label">Linked nodes</span>
              <div className="portal-graph-neighbor-list">
                {inspector.neighbors.slice(0, 8).map((neighbor) => (
                  <button
                    key={neighbor.id}
                    type="button"
                    className="portal-graph-neighbor"
                    onClick={() => setSelectedNodeId(neighbor.id)}
                  >
                    <span>{neighbor.type_label}</span>
                    <strong>{neighbor.label}</strong>
                    <small>{neighbor.secondary_label || neighbor.path}</small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function createToggleState(counts) {
  return Object.fromEntries(
    Object.keys(counts ?? {}).map((key) => [key, true]),
  );
}

function buildVisibleGraphData({ view, nodeTypeFilters, edgeTypeFilters, query } = {}) {
  const matchNodeIds = new Set();
  const expandedQueryNodeIds = new Set();
  const edgeList = Array.isArray(view?.edges) ? view.edges : [];
  const nodesById = new Map((view?.nodes ?? []).map((node) => [node.id, node]));

  if (query) {
    for (const node of view.nodes ?? []) {
      if (String(node.search_text ?? "").includes(query)) {
        matchNodeIds.add(node.id);
        expandedQueryNodeIds.add(node.id);
      }
    }

    for (const edge of edgeList) {
      if (matchNodeIds.has(edge.from) || matchNodeIds.has(edge.to)) {
        expandedQueryNodeIds.add(edge.from);
        expandedQueryNodeIds.add(edge.to);
      }
    }
  }

  const visibleNodeIds = new Set();
  const visibleNodes = [];

  for (const node of view.nodes ?? []) {
    if (nodeTypeFilters[node.type_key] === false) {
      continue;
    }
    if (query && !expandedQueryNodeIds.has(node.id)) {
      continue;
    }

    visibleNodeIds.add(node.id);
    visibleNodes.push(node);
  }

  const visibleEdges = edgeList.filter((edge) => {
    if (edgeTypeFilters[edge.type_key] === false) {
      return false;
    }
    return visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
  });

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
    nodesById,
    matchNodeIds,
    queryActive: Boolean(query),
    queryMatchCount: matchNodeIds.size,
  };
}

function buildNodeInspector({ activeNode, nodes, edges } = {}) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const relatedEdges = edges.filter(
    (edge) => edge.from === activeNode.id || edge.to === activeNode.id,
  );
  const neighbors = relatedEdges
    .map((edge) => nodesById.get(edge.from === activeNode.id ? edge.to : edge.from))
    .filter(Boolean)
    .sort((left, right) => {
      if (right.degree !== left.degree) {
        return right.degree - left.degree;
      }
      return left.label.localeCompare(right.label);
    });

  return {
    node: activeNode,
    edges: relatedEdges,
    neighbors,
  };
}

function buildFilterEntries(counts) {
  return Object.entries(counts ?? {})
    .map(([key, count]) => ({
      key,
      label: key.replace(/[_-]+/g, " "),
      count,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function pickInitialNodeId(view) {
  return (
    [...(view?.nodes ?? [])]
      .sort((left, right) => right.degree - left.degree || left.label.localeCompare(right.label))[0]
      ?.id ?? ""
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
