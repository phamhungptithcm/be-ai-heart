export const NODE_TYPES = Object.freeze({
  repository: "Repository",
  file: "File",
  symbol: "Symbol",
  class: "Class",
  interface: "Interface",
  function: "Function",
  method: "Method",
  test: "Test",
  document: "Document",
  policy: "Policy",
});

export const EDGE_TYPES = Object.freeze({
  contains: "CONTAINS",
  imports: "IMPORTS",
  calls: "CALLS",
  extends: "EXTENDS",
  implements: "IMPLEMENTS",
  testedBy: "TESTED_BY",
  violatesPolicy: "VIOLATES_POLICY",
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

export function parseSimpleYaml(raw) {
  const lines = normalizeYamlLines(raw);

  if (lines.length === 0) {
    return {};
  }

  return parseYamlBlock(lines, 0, lines[0].indent).value;
}

function normalizeYamlLines(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, "  "))
    .map((line) => ({
      indent: line.match(/^ */)?.[0]?.length ?? 0,
      content: line.trim(),
    }))
    .filter((line) => line.content.length > 0 && !line.content.startsWith("#"));
}

function parseYamlBlock(lines, startIndex, indent) {
  if (lines[startIndex]?.content.startsWith("- ")) {
    return parseYamlArray(lines, startIndex, indent);
  }

  return parseYamlObject(lines, startIndex, indent);
}

function parseYamlObject(lines, startIndex, indent) {
  const value = {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.indent < indent) {
      break;
    }

    if (line.indent !== indent || line.content.startsWith("- ")) {
      break;
    }

    const separatorIndex = line.content.indexOf(":");

    if (separatorIndex === -1) {
      index += 1;
      continue;
    }

    const key = line.content.slice(0, separatorIndex).trim();
    const rawValue = line.content.slice(separatorIndex + 1).trim();
    const nextLine = lines[index + 1];

    if (rawValue.length > 0) {
      value[key] = parseYamlScalar(rawValue);
      index += 1;
      continue;
    }

    if (nextLine && nextLine.indent > indent) {
      const nested = parseYamlBlock(lines, index + 1, nextLine.indent);
      value[key] = nested.value;
      index = nested.nextIndex;
      continue;
    }

    value[key] = {};
    index += 1;
  }

  return { value, nextIndex: index };
}

function parseYamlArray(lines, startIndex, indent) {
  const value = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.indent < indent || line.indent !== indent || !line.content.startsWith("- ")) {
      break;
    }

    const itemContent = line.content.slice(2).trim();
    const nextIndex = findNextArrayItemIndex(lines, index + 1, indent);

    if (itemContent.length === 0) {
      if (index + 1 < nextIndex) {
        const nestedLines = reindentYamlLines(lines.slice(index + 1, nextIndex), indent + 2);
        value.push(parseYamlBlock(nestedLines, 0, nestedLines[0].indent).value);
      } else {
        value.push(null);
      }

      index = nextIndex;
      continue;
    }

    if (looksLikeYamlMapping(itemContent) || index + 1 < nextIndex) {
      const itemLines = [{ indent: 0, content: itemContent }, ...reindentYamlLines(lines.slice(index + 1, nextIndex), indent + 2)];
      value.push(parseYamlBlock(itemLines, 0, itemLines[0].indent).value);
      index = nextIndex;
      continue;
    }

    value.push(parseYamlScalar(itemContent));
    index = nextIndex;
  }

  return { value, nextIndex: index };
}

function findNextArrayItemIndex(lines, startIndex, indent) {
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.indent < indent) {
      break;
    }

    if (line.indent === indent && line.content.startsWith("- ")) {
      break;
    }

    index += 1;
  }

  return index;
}

function reindentYamlLines(lines, baseIndent) {
  return lines.map((line) => ({
    indent: Math.max(line.indent - baseIndent, 0),
    content: line.content,
  }));
}

function looksLikeYamlMapping(content) {
  const separatorIndex = content.indexOf(":");

  return separatorIndex > 0 && !content.startsWith('"') && !content.startsWith("'");
}

function parseYamlScalar(rawValue) {
  if (rawValue === "true") {
    return true;
  }

  if (rawValue === "false") {
    return false;
  }

  if (rawValue === "null" || rawValue === "~") {
    return null;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
    return Number(rawValue);
  }

  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}
