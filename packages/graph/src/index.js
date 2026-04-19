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

export function createImpactAnalysis(graph, target) {
  const resolved = resolveImpactTarget(graph, target);
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
      file: directFile.relativePath,
      symbolIds: new Set(directFile.symbols.map((symbol) => symbol.id)),
    };
  }

  const exactMatches = searchSymbols(graph, target).filter((symbol) => symbol.name === target);
  const matches = exactMatches.length > 0 ? exactMatches : searchSymbols(graph, target);

  return {
    file: matches[0]?.file ?? target,
    symbolIds: new Set(matches.map((symbol) => symbol.id)),
  };
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
