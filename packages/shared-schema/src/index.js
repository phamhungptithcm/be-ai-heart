export const NODE_TYPES = Object.freeze({
  repository: "Repository",
  file: "File",
  symbol: "Symbol",
});

export const EDGE_TYPES = Object.freeze({
  contains: "CONTAINS",
  imports: "IMPORTS",
});

export function createGraphNode({ id, type, name, path = null, metadata = {} }) {
  if (!id || !type || !name) {
    throw new Error("Graph node requires id, type, and name.");
  }

  return {
    id,
    type,
    name,
    path,
    metadata,
  };
}

export function createGraphEdge({ id, from, to, type, metadata = {} }) {
  if (!id || !from || !to || !type) {
    throw new Error("Graph edge requires id, from, to, and type.");
  }

  return {
    id,
    from,
    to,
    type,
    metadata,
  };
}

export function createGraphSummary({ nodes, edges }) {
  const node_types = {};
  const edge_types = {};

  for (const node of nodes) {
    node_types[node.type] = (node_types[node.type] ?? 0) + 1;
  }

  for (const edge of edges) {
    edge_types[edge.type] = (edge_types[edge.type] ?? 0) + 1;
  }

  return {
    node_count: nodes.length,
    edge_count: edges.length,
    node_types,
    edge_types,
  };
}
