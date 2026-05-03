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
  const rawView = normalizeCodeGraphView(service?.view);
  const [searchQuery, setSearchQuery] = useState("");
  const [nodeTypeFilters, setNodeTypeFilters] = useState({});
  const [edgeTypeFilters, setEdgeTypeFilters] = useState({});
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState({});
  const [dragState, setDragState] = useState(null);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  useEffect(() => {
    if (!rawView) {
      return;
    }

    setNodeTypeFilters(createToggleState(rawView.total_node_type_counts ?? rawView.node_type_counts));
    setEdgeTypeFilters(createToggleState(rawView.total_edge_type_counts ?? rawView.edge_type_counts));
    setSelectedNodeId(pickInitialNodeId(rawView));
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNodePositions(extractNodePositions(rawView));
  }, [
    rawView?.mode,
    rawView?.node_count,
    rawView?.edge_count,
    rawView?.total_node_count,
    rawView?.total_edge_count,
  ]);

  if (!rawView) {
    return (
      <div className="portal-service-empty">
        <strong>No graph synced yet.</strong>
        <p>Run <code>heart scan</code>, then sync the repository profile.</p>
      </div>
    );
  }

  const view = applyNodePositionOverrides(rawView, nodePositions);
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
      kind: "canvas",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    });
  }

  function handleNodePointerDown(event, node) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.ownerSVGElement?.setPointerCapture?.(event.pointerId);
    setSelectedNodeId(node.id);
    setDragState({
      kind: "node",
      pointerId: event.pointerId,
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.position.x,
      originY: node.position.y,
    });
  }

  function handleCanvasPointerMove(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (dragState.kind === "node") {
      const nextX = clamp(
        dragState.originX + (event.clientX - dragState.startX) / zoom,
        24,
        view.layout.width - 24,
      );
      const nextY = clamp(
        dragState.originY + (event.clientY - dragState.startY) / zoom,
        24,
        view.layout.height - 24,
      );
      setNodePositions((current) => ({
        ...current,
        [dragState.nodeId]: { x: round(nextX, 1), y: round(nextY, 1) },
      }));
      return;
    }

    setPan({
      x: dragState.originX + (event.clientX - dragState.startX) / zoom,
      y: dragState.originY + (event.clientY - dragState.startY) / zoom,
    });
  }

  function handleCanvasPointerUp(event) {
    if (dragState?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
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

  function resetGraphLayout() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNodePositions(extractNodePositions(rawView));
  }

  function moveNodeWithKeyboard(event, node) {
    const deltas = {
      ArrowUp: { x: 0, y: -18 },
      ArrowDown: { x: 0, y: 18 },
      ArrowLeft: { x: -18, y: 0 },
      ArrowRight: { x: 18, y: 0 },
    };
    const delta = deltas[event.key];
    if (!delta) {
      return;
    }

    event.preventDefault();
    setSelectedNodeId(node.id);
    setNodePositions((current) => {
      const currentPosition = current[node.id] ?? node.position;
      return {
        ...current,
        [node.id]: {
          x: round(clamp(currentPosition.x + delta.x, 24, view.layout.width - 24), 1),
          y: round(clamp(currentPosition.y + delta.y, 24, view.layout.height - 24), 1),
        },
      };
    });
  }

  return (
    <div className="portal-graph-workspace">
      <div className="portal-graph-toolbar">
        <div>
          <span className="portal-service-toolbar-label">Live graph</span>
          <h4>Relationship viewer</h4>
        </div>
        <div className="portal-graph-toolbar-actions">
          <label className="portal-graph-search">
            <span>Search nodes</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search file, class, function"
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
            <button type="button" onClick={resetGraphLayout}>
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
                <strong>{view.layout?.algorithm ?? "auto"}</strong>
                <p>{view.mode === "full" ? "Wider graph lane" : "Focused starter lane"}</p>
              </article>
            </div>
          </section>
        </aside>

        <div className="portal-graph-canvas-shell">
          <div className="portal-graph-canvas-meta">
            <span>{loading ? "Refreshing graph…" : `Showing ${graphData.nodes.length} nodes`}</span>
            <span>{graphData.queryMatchCount > 0 ? `${graphData.queryMatchCount} search match(es)` : "Drag nodes, pan, zoom"}</span>
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
                  const labelVisible = isActive || isMatched || graphData.nodes.length <= 40;
                  const isDragging = dragState?.kind === "node" && dragState.nodeId === node.id;
                  const nodeClassName = [
                    "portal-graph-node",
                    isActive ? "is-active" : "",
                    isDragging ? "is-dragging" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <g
                      key={node.id}
                      data-graph-node="true"
                      className={nodeClassName}
                      role="button"
                      tabIndex={0}
                      aria-label={`Move graph node ${node.label}`}
                      onPointerDown={(event) => handleNodePointerDown(event, node)}
                      onClick={() => setSelectedNodeId(node.id)}
                      onKeyDown={(event) => moveNodeWithKeyboard(event, node)}
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
                      {labelVisible ? (
                        <text
                          x={node.position.x}
                          y={node.position.y + node.radius + 16}
                          className={isActive ? "portal-graph-node-label is-active" : "portal-graph-node-label"}
                        >
                          {shortGraphLabel(node.label)}
                        </text>
                      ) : null}
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

function extractNodePositions(view) {
  return Object.fromEntries(
    (view?.nodes ?? []).map((node) => [
      node.id,
      {
        x: node.position.x,
        y: node.position.y,
      },
    ]),
  );
}

function applyNodePositionOverrides(view, nodePositions) {
  return {
    ...view,
    nodes: view.nodes.map((node) => ({
      ...node,
      position: nodePositions[node.id] ?? node.position,
    })),
  };
}

function normalizeCodeGraphView(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const rawLayout = candidate.layout;
  if (!rawLayout || typeof rawLayout !== "object") {
    return null;
  }

  const layout = {
    ...rawLayout,
    algorithm: String(rawLayout.algorithm ?? "unknown"),
    width: normalizePositiveNumber(rawLayout.width, 960),
    height: normalizePositiveNumber(rawLayout.height, 640),
  };
  const nodes = (Array.isArray(candidate.nodes) ? candidate.nodes : [])
    .filter((node) => node && typeof node === "object" && node.id)
    .map((node, index) => normalizeGraphNode(node, index));
  const edges = (Array.isArray(candidate.edges) ? candidate.edges : [])
    .filter((edge) => edge && typeof edge === "object" && edge.from && edge.to)
    .map((edge, index) => ({
      ...edge,
      id: String(edge.id ?? `${edge.from}-${edge.to}-${index}`),
      color: String(edge.color ?? "rgba(72, 242, 177, 0.72)"),
      type_key: String(edge.type_key ?? edge.type ?? "related"),
      type_label: String(edge.type_label ?? edge.type ?? "related"),
    }));

  return {
    ...candidate,
    layout,
    nodes,
    edges,
    node_count: Number(candidate.node_count ?? nodes.length),
    edge_count: Number(candidate.edge_count ?? edges.length),
    total_node_count: Number(candidate.total_node_count ?? candidate.node_count ?? nodes.length),
    total_edge_count: Number(candidate.total_edge_count ?? candidate.edge_count ?? edges.length),
    node_type_counts: candidate.node_type_counts ?? {},
    edge_type_counts: candidate.edge_type_counts ?? {},
  };
}

function normalizeGraphNode(node, index) {
  const position = node.position && typeof node.position === "object" ? node.position : {};

  return {
    ...node,
    id: String(node.id),
    label: String(node.label ?? node.id),
    type_key: String(node.type_key ?? node.type ?? "node"),
    type_label: String(node.type_label ?? node.type ?? "node"),
    secondary_label: String(node.secondary_label ?? node.path ?? ""),
    search_text: String(node.search_text ?? `${node.label ?? ""} ${node.path ?? ""}`).toLowerCase(),
    position: {
      x: normalizeFiniteNumber(position.x, 140 + (index % 6) * 120),
      y: normalizeFiniteNumber(position.y, 120 + Math.floor(index / 6) * 110),
    },
    radius: normalizePositiveNumber(node.radius, 18),
    color: String(node.color ?? "#48f2b1"),
    degree: Number(node.degree ?? 0),
    meta: node.meta && typeof node.meta === "object" ? node.meta : {},
  };
}

function normalizePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function shortGraphLabel(value) {
  const raw = String(value ?? "").trim();
  const lastSegment = raw.includes("/") ? raw.split("/").filter(Boolean).at(-1) : raw;
  if (lastSegment.length <= 22) {
    return lastSegment;
  }

  return `${lastSegment.slice(0, 9)}...${lastSegment.slice(-9)}`;
}
