import path from "node:path";
import {
  EDGE_TYPES,
  NODE_TYPES,
  createGraphEdge,
  createGraphNode,
  createGraphSummary,
} from "../../shared-schema/src/index.js";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const TYPE_RELATION_NODE_KINDS = new Set(["class", "interface"]);
const CODE_GRAPH_INCLUDED_NODE_TYPES = new Set([
  NODE_TYPES.file,
  NODE_TYPES.class,
  NODE_TYPES.interface,
  NODE_TYPES.function,
  NODE_TYPES.method,
  NODE_TYPES.test,
]);
const CODE_GRAPH_INCLUDED_EDGE_TYPES = new Set([
  EDGE_TYPES.contains,
  EDGE_TYPES.imports,
  EDGE_TYPES.calls,
  EDGE_TYPES.extends,
  EDGE_TYPES.implements,
  EDGE_TYPES.testedBy,
]);
const CODE_GRAPH_TYPE_STYLES = Object.freeze({
  file: {
    label: "File",
    color: "#ff7a1a",
    radius: 24,
    cluster: { x: 0.18, y: 0.34 },
  },
  class: {
    label: "Class",
    color: "#ffd31a",
    radius: 19,
    cluster: { x: 0.66, y: 0.74 },
  },
  interface: {
    label: "Interface",
    color: "#39ff14",
    radius: 18,
    cluster: { x: 0.64, y: 0.3 },
  },
  function: {
    label: "Function",
    color: "#4aa3ff",
    radius: 15,
    cluster: { x: 0.38, y: 0.58 },
  },
  method: {
    label: "Method",
    color: "#4aa3ff",
    radius: 14,
    cluster: { x: 0.44, y: 0.62 },
  },
  test: {
    label: "Test",
    color: "#ff6b8b",
    radius: 16,
    cluster: { x: 0.22, y: 0.78 },
  },
});
const CODE_GRAPH_EDGE_STYLES = Object.freeze({
  defines: {
    label: "Defines",
    color: "#28f1b1",
  },
  imports: {
    label: "Imports",
    color: "#2f7cff",
  },
  calls: {
    label: "Calls",
    color: "#30d3ff",
  },
  extends: {
    label: "Extends",
    color: "#ff6b8b",
  },
  implements: {
    label: "Implements",
    color: "#ff9f3d",
  },
  tested_by: {
    label: "Tested by",
    color: "#d16dff",
  },
});
const CODE_GRAPH_VIEW_MODES = Object.freeze({
  focused: "focused",
  full: "full",
});

export function buildProjectGraph(scanResult, options = {}) {
  const repoName = options.repoName ?? path.basename(scanResult.rootDir);
  const documentIndex = options.documentIndex ?? { documents: [] };
  const policyReport = options.policyReport ?? { rules: [], violations: [] };
  const nodes = [];
  const edges = [];
  const edgeIds = new Set();
  const repositoryNode = createGraphNode({
    id: `repo:${repoName}`,
    type: NODE_TYPES.repository,
    name: repoName,
    path: scanResult.rootDir,
  });

  nodes.push(repositoryNode);

  const fileIndex = new Set(scanResult.files.map((file) => file.relativePath));
  const symbolEntriesById = new Map();
  const fileSymbolsByName = new Map();
  const exportedSymbolsByFile = new Map();
  const globalSymbolsByName = new Map();
  const importedFilesByFile = new Map();
  const importedSymbolsByFile = new Map();

  for (const file of scanResult.files) {
    const fileNode = createGraphNode({
      id: `file:${file.relativePath}`,
      type: NODE_TYPES.file,
      name: path.posix.basename(file.relativePath),
      path: file.relativePath,
      metadata: {
        import_count: file.imports.length,
        symbol_count: file.symbols.length,
        is_test: isTestFile(file.relativePath),
      },
    });

    nodes.push(fileNode);
    pushEdge(
      edges,
      edgeIds,
      createGraphEdge({
        id: `edge:contains:repo:${file.relativePath}`,
        from: repositoryNode.id,
        to: fileNode.id,
        type: EDGE_TYPES.contains,
      }),
    );

    if (isTestFile(file.relativePath)) {
      const testNode = createGraphNode({
        id: `test:${file.relativePath}`,
        type: NODE_TYPES.test,
        name: path.posix.basename(file.relativePath),
        path: file.relativePath,
      });
      nodes.push(testNode);
      pushEdge(
        edges,
        edgeIds,
        createGraphEdge({
          id: `edge:contains:${file.relativePath}:test`,
          from: fileNode.id,
          to: testNode.id,
          type: EDGE_TYPES.contains,
        }),
      );
    }

    const fileSymbols = [];
    const exportedSymbols = new Map();

    for (const symbol of file.symbols) {
      const symbolEntry = {
        ...symbol,
        file: file.relativePath,
      };
      const symbolNode = createGraphNode({
        id: symbol.id,
        type: mapSymbolKindToNodeType(symbol.kind),
        name: symbol.name,
        path: file.relativePath,
        metadata: {
          kind: symbol.kind,
          exported: symbol.exported,
          signature: symbol.signature,
          container: symbol.container,
          relations: symbol.relations ?? { extends: [], implements: [] },
        },
      });

      nodes.push(symbolNode);
      pushEdge(
        edges,
        edgeIds,
        createGraphEdge({
          id: `edge:contains:${file.relativePath}:${symbol.id}`,
          from: fileNode.id,
          to: symbol.id,
          type: EDGE_TYPES.contains,
        }),
      );

      fileSymbols.push(symbolEntry);
      symbolEntriesById.set(symbol.id, symbolEntry);
      appendToMapList(globalSymbolsByName, symbol.name, symbolEntry);

      if (symbol.exported) {
        appendToMapList(exportedSymbols, symbol.name, symbolEntry);
      }
    }

    fileSymbolsByName.set(file.relativePath, groupSymbolsByName(fileSymbols));
    exportedSymbolsByFile.set(file.relativePath, exportedSymbols);
  }

  for (const file of scanResult.files) {
    const importDetails =
      file.import_details?.length > 0
        ? file.import_details
        : file.imports.map((specifier) => ({
            specifier,
            imported_names: [],
            default_import: null,
            namespace_import: null,
            source_kind: "legacy-import",
          }));
    const resolvedImports = [];

    for (const detail of importDetails) {
      const resolved = resolveInternalImport(file.relativePath, detail.specifier, fileIndex);
      if (!resolved) {
        continue;
      }

      resolvedImports.push({
        specifier: detail.specifier,
        resolved,
        imported_names: detail.imported_names ?? [],
      });

      pushEdge(
        edges,
        edgeIds,
        createGraphEdge({
          id: `edge:imports:${file.relativePath}:${resolved}`,
          from: `file:${file.relativePath}`,
          to: `file:${resolved}`,
          type: EDGE_TYPES.imports,
          metadata: { specifier: detail.specifier },
        }),
      );
    }

    importedFilesByFile.set(file.relativePath, resolvedImports);
    importedSymbolsByFile.set(
      file.relativePath,
      createImportedSymbolIndex(resolvedImports, exportedSymbolsByFile),
    );
  }

  for (const file of scanResult.files) {
    const importedSymbolsByName = importedSymbolsByFile.get(file.relativePath) ?? new Map();

    for (const symbol of file.symbols) {
      for (const relationName of symbol.relations?.extends ?? []) {
        const targetSymbol = resolveSymbolTarget({
          currentFile: file.relativePath,
          targetName: relationName,
          fileSymbolsByName,
          importedSymbolsByName,
          globalSymbolsByName,
          preferredKinds: TYPE_RELATION_NODE_KINDS,
        });

        if (!targetSymbol) {
          continue;
        }

        pushEdge(
          edges,
          edgeIds,
          createGraphEdge({
            id: `edge:extends:${symbol.id}:${targetSymbol.id}`,
            from: symbol.id,
            to: targetSymbol.id,
            type: EDGE_TYPES.extends,
          }),
        );
      }

      for (const relationName of symbol.relations?.implements ?? []) {
        const targetSymbol = resolveSymbolTarget({
          currentFile: file.relativePath,
          targetName: relationName,
          fileSymbolsByName,
          importedSymbolsByName,
          globalSymbolsByName,
          preferredKinds: TYPE_RELATION_NODE_KINDS,
        });

        if (!targetSymbol) {
          continue;
        }

        pushEdge(
          edges,
          edgeIds,
          createGraphEdge({
            id: `edge:implements:${symbol.id}:${targetSymbol.id}`,
            from: symbol.id,
            to: targetSymbol.id,
            type: EDGE_TYPES.implements,
          }),
        );
      }
    }

    for (const call of file.calls ?? []) {
      if (!symbolEntriesById.has(call.from_symbol_id)) {
        continue;
      }

      const targetSymbol = resolveSymbolTarget({
        currentFile: file.relativePath,
        targetName: call.to_name,
        fileSymbolsByName,
        importedSymbolsByName,
        globalSymbolsByName,
      });

      if (!targetSymbol) {
        continue;
      }

      pushEdge(
        edges,
        edgeIds,
        createGraphEdge({
          id: `edge:calls:${call.from_symbol_id}:${targetSymbol.id}`,
          from: call.from_symbol_id,
          to: targetSymbol.id,
          type: EDGE_TYPES.calls,
          metadata: {
            expression: call.expression,
            line: call.line,
          },
        }),
      );
    }
  }

  for (const file of scanResult.files.filter((entry) => isTestFile(entry.relativePath))) {
    const testNodeId = `test:${file.relativePath}`;
    const importedSymbolsByName = importedSymbolsByFile.get(file.relativePath) ?? new Map();
    const testedFiles = deriveTestedFiles(file.relativePath, importedFilesByFile, fileIndex);

    for (const testedFile of testedFiles) {
      pushEdge(
        edges,
        edgeIds,
        createGraphEdge({
          id: `edge:tested_by:file:${testedFile}:${testNodeId}`,
          from: `file:${testedFile}`,
          to: testNodeId,
          type: EDGE_TYPES.testedBy,
        }),
      );
    }

    for (const symbols of importedSymbolsByName.values()) {
      for (const symbol of symbols) {
        pushEdge(
          edges,
          edgeIds,
          createGraphEdge({
            id: `edge:tested_by:${symbol.id}:${testNodeId}`,
            from: symbol.id,
            to: testNodeId,
            type: EDGE_TYPES.testedBy,
          }),
        );
      }
    }
  }

  for (const document of [...(documentIndex.documents ?? [])].sort((left, right) => left.path.localeCompare(right.path))) {
    const documentNode = createGraphNode({
      id: `document:${document.path}`,
      type: NODE_TYPES.document,
      name: document.title || path.posix.basename(document.path),
      path: document.path,
      metadata: {
        category: document.category,
      },
    });

    nodes.push(documentNode);
    pushEdge(
      edges,
      edgeIds,
      createGraphEdge({
        id: `edge:contains:repo:document:${document.path}`,
        from: repositoryNode.id,
        to: documentNode.id,
        type: EDGE_TYPES.contains,
      }),
    );
  }

  const policyRules = [...(policyReport.rules ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  for (const rule of policyRules) {
    const policyNode = createGraphNode({
      id: `policy:${rule.id}`,
      type: NODE_TYPES.policy,
      name: rule.id,
      path: null,
      metadata: {
        description: rule.description ?? "",
      },
    });

    nodes.push(policyNode);
    pushEdge(
      edges,
      edgeIds,
      createGraphEdge({
        id: `edge:contains:repo:policy:${rule.id}`,
        from: repositoryNode.id,
        to: policyNode.id,
        type: EDGE_TYPES.contains,
      }),
    );
  }

  for (const violation of policyReport.violations ?? []) {
    if (!violation.rule_id || !violation.file) {
      continue;
    }

    pushEdge(
      edges,
      edgeIds,
      createGraphEdge({
        id: `edge:violates:${violation.file}:${violation.rule_id}`,
        from: `file:${violation.file}`,
        to: `policy:${violation.rule_id}`,
        type: EDGE_TYPES.violatesPolicy,
        metadata: {
          specifier: violation.specifier ?? null,
          resolved_path: violation.resolved_path ?? null,
        },
      }),
    );
  }

  const sortedNodes = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  const sortedEdges = [...edges].sort((left, right) => left.id.localeCompare(right.id));

  return {
    repoName,
    rootDir: scanResult.rootDir,
    scanResult,
    nodes: sortedNodes,
    edges: sortedEdges,
    summary: createGraphSummary({ nodes: sortedNodes, edges: sortedEdges }),
  };
}

export function snapshotProjectGraph(graph) {
  return {
    repoName: graph.repoName,
    rootDir: graph.rootDir,
    nodes: graph.nodes,
    edges: graph.edges,
    summary: graph.summary,
  };
}

export function hydrateProjectGraph(snapshot, scanResult) {
  return {
    ...snapshot,
    scanResult,
  };
}

export function diffProjectGraphSnapshots(previousSnapshot, nextSnapshot) {
  const previousNodesById = new Map((previousSnapshot.nodes ?? []).map((node) => [node.id, node]));
  const nextNodesById = new Map((nextSnapshot.nodes ?? []).map((node) => [node.id, node]));
  const previousEdgesById = new Map((previousSnapshot.edges ?? []).map((edge) => [edge.id, edge]));
  const nextEdgesById = new Map((nextSnapshot.edges ?? []).map((edge) => [edge.id, edge]));
  const addedNodes = [...nextNodesById.values()]
    .filter((node) => !previousNodesById.has(node.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const removedNodes = [...previousNodesById.values()]
    .filter((node) => !nextNodesById.has(node.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const addedEdges = [...nextEdgesById.values()]
    .filter((edge) => !previousEdgesById.has(edge.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const removedEdges = [...previousEdgesById.values()]
    .filter((edge) => !nextEdgesById.has(edge.id))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    added_nodes: addedNodes,
    removed_nodes: removedNodes,
    added_edges: addedEdges,
    removed_edges: removedEdges,
    summary: {
      added_node_count: addedNodes.length,
      removed_node_count: removedNodes.length,
      added_edge_count: addedEdges.length,
      removed_edge_count: removedEdges.length,
    },
  };
}

export function searchSymbols(graph, query) {
  const needle = query.toLowerCase();

  return graph.scanResult.files
    .flatMap((file) =>
      file.symbols
        .filter((symbol) => symbol.name.toLowerCase().includes(needle))
        .map((symbol) => ({
          ...symbol,
          file: file.relativePath,
          match_score: scoreSymbolMatch(symbol.name, needle),
        })),
    )
    .sort((left, right) => {
      if (right.match_score !== left.match_score) {
        return right.match_score - left.match_score;
      }

      if (left.name !== right.name) {
        return left.name.localeCompare(right.name);
      }

      if (left.file !== right.file) {
        return left.file.localeCompare(right.file);
      }

      return left.id.localeCompare(right.id);
    })
    .map(({ match_score, ...symbol }) => symbol);
}

export function createProjectOverview(
  graph,
  policyReport = { violations: [] },
  documentIndex = { totals: { document_count: 0, category_counts: {} } },
  heartModel = { summary: { domain_count: 0, relationship_count: 0 } },
) {
  const topDirectories = summarizeTopDirectories(graph.scanResult.files);

  return {
    repo: graph.repoName,
    parser_engine: graph.scanResult.parser_engine,
    file_count: graph.scanResult.totals.file_count,
    symbol_count: graph.scanResult.totals.symbol_count,
    import_count: graph.scanResult.totals.import_count,
    parse_warnings: graph.scanResult.totals.warning_count,
    document_count: documentIndex.totals.document_count,
    document_categories: documentIndex.totals.category_counts,
    domain_count: heartModel.summary.domain_count ?? 0,
    relationship_count: heartModel.summary.relationship_count ?? 0,
    top_directories: topDirectories,
    policy_warnings: policyReport.violations.length,
    summary: `Indexed ${graph.scanResult.totals.file_count} source files, ${graph.scanResult.totals.symbol_count} symbols, ${documentIndex.totals.document_count} project documents, and ${heartModel.summary.relationship_count ?? 0} heart links for ${graph.repoName} using ${graph.scanResult.parser_engine}.`,
  };
}

export function createCodeGraphView(graph, options = {}) {
  const mode = normalizeCodeGraphMode(options.mode);
  const totalNodes = graph.nodes
    .map((node) => createCodeGraphNodeCandidate(node))
    .filter(Boolean);
  const totalNodesById = new Map(totalNodes.map((node) => [node.id, node]));
  const totalEdges = graph.edges
    .map((edge) => createCodeGraphEdgeCandidate(edge, totalNodesById))
    .filter(Boolean);
  const totalAdjacency = buildAdjacency(totalEdges);
  const totalDegrees = buildDegreeMap(totalEdges);
  const selectedNodeIds =
    mode === CODE_GRAPH_VIEW_MODES.full
      ? new Set(totalNodes.map((node) => node.id))
      : selectFocusedCodeGraphNodeIds(totalNodes, totalEdges, totalAdjacency, totalDegrees, {
          maxNodes: Number(options.maxNodes ?? 54),
        });
  const selectedNodes = totalNodes.filter((node) => selectedNodeIds.has(node.id));
  const selectedEdges = totalEdges.filter(
    (edge) => selectedNodeIds.has(edge.from) && selectedNodeIds.has(edge.to),
  );
  const layout = createCodeGraphLayout(selectedNodes, selectedEdges, {
    mode,
    width: Number(options.width ?? 1360),
    height: Number(options.height ?? 840),
  });
  const selectedDegrees = buildDegreeMap(selectedEdges);

  return {
    mode,
    source_type: "repo_artifact",
    node_count: selectedNodes.length,
    edge_count: selectedEdges.length,
    total_node_count: totalNodes.length,
    total_edge_count: totalEdges.length,
    is_truncated:
      mode === CODE_GRAPH_VIEW_MODES.focused &&
      (selectedNodes.length < totalNodes.length || selectedEdges.length < totalEdges.length),
    layout: {
      width: layout.width,
      height: layout.height,
      algorithm: layout.algorithm,
    },
    node_type_counts: summarizeCodeGraphTypes(selectedNodes, "type_key"),
    edge_type_counts: summarizeCodeGraphTypes(selectedEdges, "type_key"),
    total_node_type_counts: summarizeCodeGraphTypes(totalNodes, "type_key"),
    total_edge_type_counts: summarizeCodeGraphTypes(totalEdges, "type_key"),
    nodes: selectedNodes.map((node) => {
      const position = layout.positions.get(node.id) ?? { x: layout.width / 2, y: layout.height / 2 };
      const degree = selectedDegrees.get(node.id) ?? 0;
      const style = CODE_GRAPH_TYPE_STYLES[node.type_key];

      return {
        id: node.id,
        label: node.label,
        secondary_label: node.secondary_label,
        type_key: node.type_key,
        type_label: style.label,
        path: node.path,
        search_text: node.search_text,
        degree,
        radius: style.radius + Math.min(7, Math.round(degree / 3)),
        color: style.color,
        position,
        meta: node.meta,
      };
    }),
    edges: selectedEdges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      type_key: edge.type_key,
      type_label: CODE_GRAPH_EDGE_STYLES[edge.type_key]?.label ?? edge.type_key,
      color: CODE_GRAPH_EDGE_STYLES[edge.type_key]?.color ?? "#9cb2ab",
      label: edge.label,
    })),
  };
}

export function createImpactAnalysis(graph, target) {
  const resolved = resolveImpactTarget(graph, target);
  if (!resolved.found) {
    return createNotFoundResult(target);
  }

  const dependentFiles = new Set();
  const dependentSymbols = new Set();
  const relatedTests = new Set();

  if (resolved.file) {
    for (const edge of graph.edges) {
      if (edge.type === EDGE_TYPES.imports && edge.to === `file:${resolved.file}`) {
        dependentFiles.add(edge.from.replace(/^file:/, ""));
      }
    }
  }

  for (const symbolId of resolved.symbolIds) {
    for (const edge of graph.edges) {
      if (edge.type === EDGE_TYPES.calls && edge.to === symbolId) {
        const caller = findNode(graph, edge.from);
        if (caller) {
          dependentSymbols.add(caller.name);
          if (caller.path) {
            dependentFiles.add(caller.path);
          }
        }
      }

      if (edge.type === EDGE_TYPES.testedBy && edge.from === symbolId) {
        const testNode = findNode(graph, edge.to);
        if (testNode?.path) {
          relatedTests.add(testNode.path);
        }
      }
    }
  }

  if (resolved.file) {
    for (const edge of graph.edges) {
      if (edge.type === EDGE_TYPES.testedBy && edge.from === `file:${resolved.file}`) {
        const testNode = findNode(graph, edge.to);
        if (testNode?.path) {
          relatedTests.add(testNode.path);
        }
      }
    }
  }

  const riskScore = dependentFiles.size + dependentSymbols.size + relatedTests.size;

  return {
    target,
    status: "ok",
    found: true,
    resolved_file: resolved.file ?? target,
    resolved_symbol_ids: [...resolved.symbolIds].sort(),
    dependent_files: [...dependentFiles].sort(),
    dependent_symbols: [...dependentSymbols].sort(),
    related_tests: [...relatedTests].sort(),
    risk_level: riskScore > 3 ? "medium" : riskScore > 0 ? "low" : "minimal",
  };
}

export function createDependencyExplanation(graph, target) {
  const resolved = resolveImpactTarget(graph, target);
  if (!resolved.found) {
    return createNotFoundResult(target);
  }

  const expandedSymbolIds = expandRelatedSymbolIds(graph, resolved);
  const outgoingImports = new Set();
  const incomingImports = new Set();
  const outgoingCalls = new Set();
  const incomingCalls = new Set();
  const extendsRelations = new Set();
  const implementsRelations = new Set();
  const relatedTests = new Set();

  if (resolved.file) {
    for (const edge of graph.edges) {
      if (edge.type === EDGE_TYPES.imports && edge.from === `file:${resolved.file}`) {
        outgoingImports.add(edge.to.replace(/^file:/, ""));
      }

      if (edge.type === EDGE_TYPES.imports && edge.to === `file:${resolved.file}`) {
        incomingImports.add(edge.from.replace(/^file:/, ""));
      }
    }
  }

  for (const symbolId of expandedSymbolIds) {
    for (const edge of graph.edges) {
      if (edge.type === EDGE_TYPES.calls && edge.from === symbolId) {
        const callee = findNode(graph, edge.to);
        if (callee) {
          outgoingCalls.add(callee.name);
        }
      }

      if (edge.type === EDGE_TYPES.calls && edge.to === symbolId) {
        const caller = findNode(graph, edge.from);
        if (caller) {
          incomingCalls.add(caller.name);
        }
      }
    }
  }

  for (const symbolId of resolved.symbolIds) {
    for (const edge of graph.edges) {

      if (edge.type === EDGE_TYPES.extends && edge.from === symbolId) {
        const parent = findNode(graph, edge.to);
        if (parent) {
          extendsRelations.add(parent.name);
        }
      }

      if (edge.type === EDGE_TYPES.implements && edge.from === symbolId) {
        const contract = findNode(graph, edge.to);
        if (contract) {
          implementsRelations.add(contract.name);
        }
      }

      if (edge.type === EDGE_TYPES.testedBy && edge.from === symbolId) {
        const testNode = findNode(graph, edge.to);
        if (testNode?.path) {
          relatedTests.add(testNode.path);
        }
      }
    }
  }

  if (resolved.file) {
    for (const edge of graph.edges) {
      if (edge.type === EDGE_TYPES.testedBy && edge.from === `file:${resolved.file}`) {
        const testNode = findNode(graph, edge.to);
        if (testNode?.path) {
          relatedTests.add(testNode.path);
        }
      }
    }
  }

  return {
    target,
    status: "ok",
    found: true,
    resolved_file: resolved.file ?? target,
    resolved_symbol_ids: [...resolved.symbolIds].sort(),
    incoming_imports: [...incomingImports].sort(),
    outgoing_imports: [...outgoingImports].sort(),
    incoming_calls: [...incomingCalls].sort(),
    outgoing_calls: [...outgoingCalls].sort(),
    extends: [...extendsRelations].sort(),
    implements: [...implementsRelations].sort(),
    related_tests: [...relatedTests].sort(),
  };
}

function summarizeTopDirectories(files) {
  const counts = new Map();

  for (const file of files) {
    const topLevel = file.relativePath.split("/")[0] ?? "root";
    counts.set(topLevel, (counts.get(topLevel) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([name, count]) => ({ name, count }))
    .slice(0, 5);
}

function resolveImpactTarget(graph, target) {
  const directFile = graph.scanResult.files.find((file) => file.relativePath === target);
  if (directFile) {
    return {
      found: true,
      file: directFile.relativePath,
      symbolIds: new Set(directFile.symbols.map((symbol) => symbol.id)),
    };
  }

  const exactMatches = searchSymbols(graph, target).filter((symbol) => symbol.name === target);
  const matches = exactMatches.length > 0 ? exactMatches : searchSymbols(graph, target);
  const resolvedFile = matches[0]?.file ?? null;
  const symbolIds = expandResolvedSymbolIds(graph, matches);

  return {
    found: matches.length > 0,
    file: resolvedFile,
    symbolIds,
  };
}

function createCodeGraphNodeCandidate(node) {
  if (!CODE_GRAPH_INCLUDED_NODE_TYPES.has(node.type)) {
    return null;
  }

  const type_key = mapCodeGraphNodeType(node.type);
  if (!type_key) {
    return null;
  }

  const isFile = type_key === "file";
  const label = isFile ? shortFileLabel(node.path ?? node.name) : node.name;
  const secondaryLabel = isFile ? node.path : node.metadata?.container ?? node.path ?? "";

  return {
    id: node.id,
    type_key,
    label,
    secondary_label: secondaryLabel || "",
    path: node.path ?? "",
    search_text: [label, node.path, node.name, node.metadata?.container, node.metadata?.signature]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    meta: {
      container: node.metadata?.container ?? "",
      signature: node.metadata?.signature ?? "",
      exported: Boolean(node.metadata?.exported),
      kind: node.metadata?.kind ?? "",
    },
  };
}

function shortFileLabel(filePath) {
  const normalizedPath = String(filePath ?? "").replace(/\\/g, "/");
  if (!normalizedPath) {
    return "unknown-file";
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length <= 2) {
    return normalizedPath;
  }

  return segments.slice(-2).join("/");
}

function createCodeGraphEdgeCandidate(edge, nodesById) {
  if (!CODE_GRAPH_INCLUDED_EDGE_TYPES.has(edge.type)) {
    return null;
  }

  const fromNode = nodesById.get(edge.from);
  const toNode = nodesById.get(edge.to);
  if (!fromNode || !toNode) {
    return null;
  }

  let type_key = null;
  if (edge.type === EDGE_TYPES.contains) {
    if (fromNode.type_key !== "file") {
      return null;
    }
    type_key = "defines";
  } else if (edge.type === EDGE_TYPES.imports) {
    type_key = "imports";
  } else if (edge.type === EDGE_TYPES.calls) {
    type_key = "calls";
  } else if (edge.type === EDGE_TYPES.extends) {
    type_key = "extends";
  } else if (edge.type === EDGE_TYPES.implements) {
    type_key = "implements";
  } else if (edge.type === EDGE_TYPES.testedBy) {
    type_key = "tested_by";
  }

  if (!type_key) {
    return null;
  }

  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    type_key,
    label: CODE_GRAPH_EDGE_STYLES[type_key]?.label ?? type_key,
  };
}

function mapCodeGraphNodeType(nodeType) {
  switch (nodeType) {
    case NODE_TYPES.file:
      return "file";
    case NODE_TYPES.class:
      return "class";
    case NODE_TYPES.interface:
      return "interface";
    case NODE_TYPES.function:
      return "function";
    case NODE_TYPES.method:
      return "method";
    case NODE_TYPES.test:
      return "test";
    default:
      return null;
  }
}

function normalizeCodeGraphMode(mode) {
  return String(mode ?? CODE_GRAPH_VIEW_MODES.focused).trim() === CODE_GRAPH_VIEW_MODES.full
    ? CODE_GRAPH_VIEW_MODES.full
    : CODE_GRAPH_VIEW_MODES.focused;
}

function buildAdjacency(edges) {
  const adjacency = new Map();

  for (const edge of edges) {
    appendToMapList(adjacency, edge.from, edge.to);
    appendToMapList(adjacency, edge.to, edge.from);
  }

  return adjacency;
}

function buildDegreeMap(edges) {
  const degrees = new Map();

  for (const edge of edges) {
    degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
    degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
  }

  return degrees;
}

function summarizeCodeGraphTypes(entries, key) {
  const counts = {};

  for (const entry of entries) {
    const typeKey = entry[key];
    counts[typeKey] = (counts[typeKey] ?? 0) + 1;
  }

  return counts;
}

function selectFocusedCodeGraphNodeIds(nodes, edges, adjacency, degrees, options = {}) {
  const maxNodes = Math.max(24, Number(options.maxNodes ?? 54));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const rankedNodes = [...nodes].sort((left, right) => {
    const scoreDiff = scoreFocusedGraphNode(right, degrees) - scoreFocusedGraphNode(left, degrees);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return left.id.localeCompare(right.id);
  });
  const selected = new Set();
  const queue = [];

  for (const candidate of rankedNodes) {
    if (selected.size >= Math.min(14, maxNodes)) {
      break;
    }

    if (selected.has(candidate.id)) {
      continue;
    }

    selected.add(candidate.id);
    queue.push(candidate.id);
  }

  while (queue.length > 0 && selected.size < maxNodes) {
    const nodeId = queue.shift();
    const neighbours = [...(adjacency.get(nodeId) ?? [])].sort((left, right) => {
      const leftNode = nodesById.get(left);
      const rightNode = nodesById.get(right);
      const scoreDiff = scoreFocusedGraphNode(rightNode, degrees) - scoreFocusedGraphNode(leftNode, degrees);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return left.localeCompare(right);
    });

    for (const neighbourId of neighbours) {
      if (selected.size >= maxNodes) {
        break;
      }
      if (selected.has(neighbourId)) {
        continue;
      }
      selected.add(neighbourId);
      queue.push(neighbourId);
    }
  }

  for (const edge of edges) {
    if (edge.type_key !== "defines") {
      continue;
    }
    if (selected.has(edge.to) && selected.size < maxNodes) {
      selected.add(edge.from);
    }
  }

  if (selected.size === 0) {
    for (const candidate of rankedNodes.slice(0, maxNodes)) {
      selected.add(candidate.id);
    }
  }

  return selected;
}

function scoreFocusedGraphNode(node, degrees) {
  if (!node) {
    return -1;
  }

  const degree = degrees.get(node.id) ?? 0;
  const typeBoost = {
    file: 10,
    class: 9,
    interface: 8,
    function: 7,
    method: 6,
    test: 4,
  }[node.type_key] ?? 0;

  return typeBoost + degree * 2 + (node.meta?.exported ? 2 : 0);
}

function createCodeGraphLayout(nodes, edges, options = {}) {
  const width = Math.max(960, Number(options.width ?? 1360));
  const height = Math.max(640, Number(options.height ?? 840));
  const mode = normalizeCodeGraphMode(options.mode);
  const positions = new Map();
  const centers = new Map(
    Object.entries(CODE_GRAPH_TYPE_STYLES).map(([key, style]) => [
      key,
      { x: style.cluster.x * width, y: style.cluster.y * height },
    ]),
  );

  if (nodes.length === 0) {
    return {
      width,
      height,
      algorithm: "empty",
      positions,
    };
  }

  const layoutNodes = nodes.map((node, index) => {
    const center = centers.get(node.type_key) ?? { x: width / 2, y: height / 2 };
    const seed = hashGraphId(node.id);
    const angle = ((seed % 360) * Math.PI) / 180;
    const ring = 70 + (index % 11) * 18 + (seed % 31);
    const point = {
      id: node.id,
      type_key: node.type_key,
      x: center.x + Math.cos(angle) * ring,
      y: center.y + Math.sin(angle) * ring,
    };
    positions.set(node.id, point);
    return point;
  });

  const iterations =
    mode === CODE_GRAPH_VIEW_MODES.full
      ? Math.max(10, Math.min(24, Math.round(320 / Math.max(nodes.length, 12))))
      : 72;
  const repulsion = mode === CODE_GRAPH_VIEW_MODES.full ? 10_000 : 18_000;
  const attraction = mode === CODE_GRAPH_VIEW_MODES.full ? 0.018 : 0.032;
  const clusterPull = mode === CODE_GRAPH_VIEW_MODES.full ? 0.028 : 0.044;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const forces = new Map(layoutNodes.map((node) => [node.id, { x: 0, y: 0 }]));

    for (let index = 0; index < layoutNodes.length; index += 1) {
      const left = layoutNodes[index];
      for (let offset = index + 1; offset < layoutNodes.length; offset += 1) {
        const right = layoutNodes[offset];
        const dx = left.x - right.x;
        const dy = left.y - right.y;
        const distanceSquared = Math.max(dx * dx + dy * dy, 64);
        const distance = Math.sqrt(distanceSquared);
        const force = repulsion / distanceSquared;
        const forceX = (dx / distance) * force;
        const forceY = (dy / distance) * force;
        forces.get(left.id).x += forceX;
        forces.get(left.id).y += forceY;
        forces.get(right.id).x -= forceX;
        forces.get(right.id).y -= forceY;
      }
    }

    for (const edge of edges) {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      const fromForce = forces.get(edge.from);
      const toForce = forces.get(edge.to);
      if (!from || !to || !fromForce || !toForce) {
        continue;
      }
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const idealLength = edge.type_key === "defines" ? 96 : 168;
      const stretch = distance - idealLength;
      const force = stretch * attraction;
      const forceX = (dx / distance) * force;
      const forceY = (dy / distance) * force;
      fromForce.x += forceX;
      fromForce.y += forceY;
      toForce.x -= forceX;
      toForce.y -= forceY;
    }

    for (const node of layoutNodes) {
      const center = centers.get(node.type_key) ?? { x: width / 2, y: height / 2 };
      const force = forces.get(node.id);
      if (!force) {
        continue;
      }
      force.x += (center.x - node.x) * clusterPull;
      force.y += (center.y - node.y) * clusterPull;
      node.x = clamp(node.x + force.x, 42, width - 42);
      node.y = clamp(node.y + force.y, 42, height - 42);
      positions.set(node.id, { x: node.x, y: node.y });
    }
  }

  return {
    width,
    height,
    algorithm: mode === CODE_GRAPH_VIEW_MODES.full ? "clustered-force-lite" : "clustered-force",
    positions: new Map(layoutNodes.map((node) => [node.id, { x: round(node.x, 2), y: round(node.y, 2) }])),
  };
}

function hashGraphId(value) {
  let hash = 0;

  for (const character of String(value)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function createNotFoundResult(target) {
  return {
    target,
    status: "not_found",
    found: false,
    resolved_file: null,
    resolved_symbol_ids: [],
    incoming_imports: [],
    outgoing_imports: [],
    incoming_calls: [],
    outgoing_calls: [],
    extends: [],
    implements: [],
    related_tests: [],
    dependent_files: [],
    dependent_symbols: [],
    risk_level: "unknown",
  };
}

function expandResolvedSymbolIds(graph, matches) {
  const symbolIds = new Set(matches.map((symbol) => symbol.id));

  for (const symbol of matches) {
    const file = graph.scanResult.files.find((entry) => entry.relativePath === symbol.file);
    if (!file) {
      continue;
    }

    const queue = [symbol.name];
    const seenContainers = new Set(queue);

    while (queue.length > 0) {
      const containerName = queue.shift();

      for (const candidate of file.symbols) {
        if (candidate.container !== containerName) {
          continue;
        }

        if (!symbolIds.has(candidate.id)) {
          symbolIds.add(candidate.id);
        }

        if (!seenContainers.has(candidate.name)) {
          seenContainers.add(candidate.name);
          queue.push(candidate.name);
        }
      }
    }
  }

  return symbolIds;
}

function expandRelatedSymbolIds(graph, resolved) {
  const expanded = new Set(resolved.symbolIds);
  const resolvedSymbols = graph.scanResult.files
    .flatMap((file) => file.symbols.map((symbol) => ({ ...symbol, file: file.relativePath })))
    .filter((symbol) => resolved.symbolIds.has(symbol.id));

  for (const symbol of resolvedSymbols) {
    if ((symbol.kind !== "class" && symbol.kind !== "interface") || !resolved.file) {
      continue;
    }

    const fileEntry = graph.scanResult.files.find((file) => file.relativePath === resolved.file);
    for (const childSymbol of fileEntry?.symbols ?? []) {
      if (childSymbol.container === symbol.name) {
        expanded.add(childSymbol.id);
      }
    }
  }

  return expanded;
}

function findNode(graph, nodeId) {
  return graph.nodes.find((node) => node.id === nodeId) ?? null;
}

function resolveSymbolTarget({
  currentFile,
  targetName,
  fileSymbolsByName,
  importedSymbolsByName,
  globalSymbolsByName,
  preferredKinds = null,
}) {
  const localMatch = pickPreferredSymbol(fileSymbolsByName.get(currentFile)?.get(targetName) ?? [], preferredKinds);
  if (localMatch) {
    return localMatch;
  }

  const importedMatch = pickPreferredSymbol(importedSymbolsByName.get(targetName) ?? [], preferredKinds);
  if (importedMatch) {
    return importedMatch;
  }

  return pickPreferredSymbol(globalSymbolsByName.get(targetName) ?? [], preferredKinds);
}

function pickPreferredSymbol(symbols, preferredKinds) {
  const orderedSymbols = [...symbols].sort((left, right) => left.id.localeCompare(right.id));

  if (!preferredKinds || preferredKinds.size === 0) {
    return orderedSymbols[0] ?? null;
  }

  return orderedSymbols.find((symbol) => preferredKinds.has(symbol.kind)) ?? orderedSymbols[0] ?? null;
}

function createImportedSymbolIndex(resolvedImports, exportedSymbolsByFile) {
  const importedSymbols = new Map();

  for (const detail of resolvedImports) {
    const exportedSymbols = exportedSymbolsByFile.get(detail.resolved) ?? new Map();

    if (detail.imported_names?.length) {
      for (const importedName of detail.imported_names) {
        for (const symbol of exportedSymbols.get(importedName) ?? []) {
          appendToMapList(importedSymbols, importedName, symbol);
        }
      }
      continue;
    }

    for (const [name, symbols] of exportedSymbols.entries()) {
      for (const symbol of symbols) {
        appendToMapList(importedSymbols, name, symbol);
      }
    }
  }

  return importedSymbols;
}

function deriveTestedFiles(testFile, importedFilesByFile, fileIndex) {
  const testedFiles = new Set((importedFilesByFile.get(testFile) ?? []).map((entry) => entry.resolved));
  const directCandidate = testFile.replace(/\.test(\.[^.]+)$/u, "$1").replace(/\.spec(\.[^.]+)$/u, "$1");

  if (fileIndex.has(directCandidate)) {
    testedFiles.add(directCandidate);
  }

  if (testFile.includes("/__tests__/")) {
    const withoutSegment = testFile.replace("/__tests__/", "/").replace(/\.test(\.[^.]+)$/u, "$1");
    if (fileIndex.has(withoutSegment)) {
      testedFiles.add(withoutSegment);
    }
  }

  return [...testedFiles].sort();
}

function groupSymbolsByName(symbols) {
  const grouped = new Map();

  for (const symbol of symbols) {
    appendToMapList(grouped, symbol.name, symbol);
  }

  return grouped;
}

function appendToMapList(map, key, value) {
  if (!map.has(key)) {
    map.set(key, []);
  }

  map.get(key).push(value);
}

function mapSymbolKindToNodeType(kind) {
  switch (kind) {
    case "class":
      return NODE_TYPES.class;
    case "interface":
      return NODE_TYPES.interface;
    case "function":
      return NODE_TYPES.function;
    case "method":
      return NODE_TYPES.method;
    default:
      return NODE_TYPES.symbol;
  }
}

function pushEdge(edges, edgeIds, edge) {
  if (edgeIds.has(edge.id)) {
    return;
  }

  edgeIds.add(edge.id);
  edges.push(edge);
}

function isTestFile(relativePath) {
  return (
    /\.test\.[cm]?[jt]sx?$/u.test(relativePath) ||
    /\.spec\.[cm]?[jt]sx?$/u.test(relativePath) ||
    relativePath.includes("/__tests__/") ||
    relativePath.includes("/test/")
  );
}

function scoreSymbolMatch(symbolName, needle) {
  const normalizedName = symbolName.toLowerCase();

  if (normalizedName === needle) {
    return 3;
  }

  if (normalizedName.startsWith(needle)) {
    return 2;
  }

  return 1;
}

function resolveInternalImport(fromFile, specifier, fileIndex) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ];

  return candidates.find((candidate) => fileIndex.has(candidate)) ?? null;
}
