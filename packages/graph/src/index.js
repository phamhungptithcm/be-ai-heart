import path from "node:path";
import {
  EDGE_TYPES,
  NODE_TYPES,
  createGraphEdge,
  createGraphNode,
  createGraphSummary,
} from "../../shared-schema/src/index.js";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

export function buildProjectGraph(scanResult, options = {}) {
  const repoName = options.repoName ?? path.basename(scanResult.rootDir);
  const nodes = [];
  const edges = [];
  const repositoryNode = createGraphNode({
    id: `repo:${repoName}`,
    type: NODE_TYPES.repository,
    name: repoName,
    path: scanResult.rootDir,
  });

  nodes.push(repositoryNode);

  const fileIndex = new Set(scanResult.files.map((file) => file.relativePath));

  for (const file of scanResult.files) {
    const fileNode = createGraphNode({
      id: `file:${file.relativePath}`,
      type: NODE_TYPES.file,
      name: path.posix.basename(file.relativePath),
      path: file.relativePath,
      metadata: {
        import_count: file.imports.length,
        symbol_count: file.symbols.length,
      },
    });

    nodes.push(fileNode);
    edges.push(
      createGraphEdge({
        id: `edge:contains:repo:${file.relativePath}`,
        from: repositoryNode.id,
        to: fileNode.id,
        type: EDGE_TYPES.contains,
      }),
    );

    for (const symbol of file.symbols) {
      nodes.push(
        createGraphNode({
          id: symbol.id,
          type: NODE_TYPES.symbol,
          name: symbol.name,
          path: file.relativePath,
          metadata: {
            kind: symbol.kind,
            exported: symbol.exported,
            signature: symbol.signature,
          },
        }),
      );

      edges.push(
        createGraphEdge({
          id: `edge:contains:${file.relativePath}:${symbol.name}`,
          from: fileNode.id,
          to: symbol.id,
          type: EDGE_TYPES.contains,
        }),
      );
    }

    for (const specifier of file.imports) {
      const resolved = resolveInternalImport(file.relativePath, specifier, fileIndex);
      if (!resolved) {
        continue;
      }

      edges.push(
        createGraphEdge({
          id: `edge:imports:${file.relativePath}:${resolved}`,
          from: fileNode.id,
          to: `file:${resolved}`,
          type: EDGE_TYPES.imports,
          metadata: { specifier },
        }),
      );
    }
  }

  return {
    repoName,
    rootDir: scanResult.rootDir,
    scanResult,
    nodes,
    edges,
    summary: createGraphSummary({ nodes, edges }),
  };
}

export function searchSymbols(graph, query) {
  const needle = query.toLowerCase();

  return graph.scanResult.files.flatMap((file) =>
    file.symbols
      .filter((symbol) => symbol.name.toLowerCase().includes(needle))
      .map((symbol) => ({
        ...symbol,
        file: file.relativePath,
      })),
  );
}

export function createProjectOverview(graph, policyReport = { violations: [] }, documentIndex = { totals: { document_count: 0, category_counts: {} } }) {
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
    top_directories: topDirectories,
    policy_warnings: policyReport.violations.length,
    summary: `Indexed ${graph.scanResult.totals.file_count} source files, ${graph.scanResult.totals.symbol_count} symbols, and ${documentIndex.totals.document_count} project documents for ${graph.repoName} using ${graph.scanResult.parser_engine}.`,
  };
}

export function createImpactAnalysis(graph, target) {
  const targetFile = resolveTargetFile(graph, target);
  const impactedBy = graph.edges
    .filter((edge) => edge.type === EDGE_TYPES.imports && edge.to === `file:${targetFile}`)
    .map((edge) => edge.from.replace(/^file:/, ""))
    .sort();

  return {
    target,
    resolved_file: targetFile,
    dependent_files: impactedBy,
    related_tests: impactedBy.filter((file) => file.includes(".test.") || file.includes("/test/")),
    risk_level: impactedBy.length > 3 ? "medium" : impactedBy.length > 0 ? "low" : "minimal",
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

function resolveTargetFile(graph, target) {
  const directFile = graph.scanResult.files.find((file) => file.relativePath === target);
  if (directFile) {
    return directFile.relativePath;
  }

  const symbolMatch = searchSymbols(graph, target)[0];
  return symbolMatch?.file ?? target;
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
