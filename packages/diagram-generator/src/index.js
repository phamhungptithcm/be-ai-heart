import fs from "node:fs/promises";
import path from "node:path";

import { compileContextPack } from "../../context-compiler/src/index.js";
import { syncRepositoryDocumentsToSurfaces } from "../../document-sync/src/index.js";
import { createCodeGraphView, createProjectOverview } from "../../graph/src/index.js";
import {
  publishProfilesToSurface,
  publishWorkspacesToSurface,
  resolveServiceStorageRoot,
  writeRepositoryProfileArtifactRecord,
  writeRepositoryServiceArtifactRecord,
} from "../../../services/api/src/storage.js";

export const DIAGRAM_TYPES = Object.freeze({
  symbolGraph: "symbol-graph",
  highLevel: "high-level",
  component: "component",
  class: "class",
  sequence: "sequence",
  mindmap: "mindmap",
});

const DEFAULT_DIAGRAM_TYPES = Object.freeze([
  DIAGRAM_TYPES.symbolGraph,
  DIAGRAM_TYPES.highLevel,
  DIAGRAM_TYPES.component,
  DIAGRAM_TYPES.class,
  DIAGRAM_TYPES.sequence,
  DIAGRAM_TYPES.mindmap,
]);

export function generateDiagramBundle({
  workspaceState,
  types = DEFAULT_DIAGRAM_TYPES,
  task = "",
  target = "",
} = {}) {
  const normalizedTypes = normalizeDiagramTypes(types);
  const generatedAt = new Date().toISOString();
  const diagrams = normalizedTypes.map((type) =>
    finalizeDiagram(
      generateDiagram(type, {
        workspaceState,
        task,
        target,
      }),
    ),
  );

  return {
    repo: path.basename(workspaceState.repoRoot),
    repo_root: workspaceState.repoRoot,
    generated_at: generatedAt,
    diagrams,
  };
}

export async function writeDiagramBundle(repoRoot, bundle) {
  const artifactRoot = path.join(repoRoot, ".heart", "diagrams");
  await fs.mkdir(artifactRoot, { recursive: true });

  const diagrams = [];
  for (const diagram of bundle.diagrams) {
    const fileName = `${diagram.type}.mmd`;
    const filePath = path.join(artifactRoot, fileName);
    await fs.writeFile(filePath, `${diagram.content}\n`, "utf8");
    diagrams.push({
      ...diagram,
      artifact_file: fileName,
      artifact_path: filePath,
    });
  }

  const manifest = {
    schema_version: 1,
    repo: bundle.repo,
    repo_root: bundle.repo_root,
    generated_at: bundle.generated_at,
    diagrams: diagrams.map((diagram) => ({
      type: diagram.type,
      title: diagram.title,
      format: diagram.format,
      inference_mode: diagram.inference_mode,
      confidence: diagram.confidence,
      trust: diagram.trust,
      validation: diagram.validation,
      scope: diagram.scope,
      artifact_file: diagram.artifact_file,
      summary: diagram.summary,
    })),
  };
  const manifestPath = path.join(artifactRoot, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    artifact_root: artifactRoot,
    manifest_path: manifestPath,
    diagrams,
    manifest,
  };
}

export async function syncRepositoryProfile({
  repoRoot,
  workspaceState,
  bundle,
  artifacts,
  slug,
  portalRoot,
  adminRoot,
  serviceStorageRoot,
} = {}) {
  const profileSlug = sanitizeSlug(slug || path.basename(repoRoot));
  const publishedRoot = path.join(repoRoot, ".heart", "published", "profiles", profileSlug);
  const diagramsRoot = path.join(publishedRoot, "diagrams");

  await fs.mkdir(diagramsRoot, { recursive: true });

  for (const diagram of artifacts.diagrams) {
    const targetPath = path.join(diagramsRoot, diagram.artifact_file);
    await fs.copyFile(diagram.artifact_path, targetPath);
  }

  const profile = {
    schema_version: 1,
    profile_slug: profileSlug,
    repo: path.basename(repoRoot),
    repo_root: repoRoot,
    generated_at: bundle.generated_at,
    overview: createProjectOverview(
      workspaceState.graph,
      workspaceState.policyReport,
      workspaceState.documentIndex,
      workspaceState.heartModel,
    ),
    heart: workspaceState.heartModel.summary,
    diagrams: artifacts.manifest.diagrams,
    documents: workspaceState.documentIndex.totals,
    cache: workspaceState.cache,
  };
  const profilePath = path.join(publishedRoot, "repository-profile.json");
  await fs.writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  await fs.copyFile(artifacts.manifest_path, path.join(publishedRoot, "diagram-manifest.json"));

  const webProfile = createWebRepositoryProfile(profile, artifacts);
  const storageRoot = resolveServiceStorageRoot({
    serviceStorageRoot,
    repoRoot,
    portalRoot,
    adminRoot,
  });
  const persistedProfile = await writeRepositoryProfileArtifactRecord({
    serviceStorageRoot: storageRoot,
    profile: webProfile,
    workspaceMetadata: {
      benchmark_runner: {
        repo_root: repoRoot,
        connected_at: bundle.generated_at,
        source: "local-profile-sync",
      },
    },
  });
  await Promise.all([
    writeRepositoryServiceArtifactRecord({
      serviceStorageRoot: storageRoot,
      profileSlug,
      serviceKey: "code-graph",
      variant: "focused",
      artifact: createCodeGraphView(workspaceState.graph, {
        mode: "focused",
      }),
    }),
    writeRepositoryServiceArtifactRecord({
      serviceStorageRoot: storageRoot,
      profileSlug,
      serviceKey: "code-graph",
      variant: "full",
      artifact: createCodeGraphView(workspaceState.graph, {
        mode: "full",
      }),
    }),
  ]);
  const publishedDocuments = await syncRepositoryDocumentsToSurfaces({
    repoRoot,
    profileSlug,
    repo: profile.repo,
    documentIndex: workspaceState.documentIndex,
    portalRoot,
    adminRoot,
    serviceStorageRoot: storageRoot,
  });

  const syncedDestinations = [];
  for (const destination of await resolveSyncDestinations(repoRoot, { portalRoot, adminRoot, profileSlug })) {
    await fs.mkdir(path.dirname(destination.path), { recursive: true });
    await fs.rm(destination.path, { recursive: true, force: true });
    await fs.cp(publishedRoot, destination.path, { recursive: true });
    await publishProfilesToSurface({
      serviceStorageRoot: storageRoot,
      surfaceRoot: destination.root,
    });
    await publishWorkspacesToSurface({
      serviceStorageRoot: storageRoot,
      surfaceRoot: destination.root,
    });
    syncedDestinations.push({
      ...destination,
      service_storage_root: storageRoot,
      profile_path: persistedProfile.profile_path,
    });
  }

  return {
    profile_slug: profileSlug,
    published_root: publishedRoot,
    profile_path: profilePath,
    service_storage_root: storageRoot,
    service_profile_path: persistedProfile.profile_path,
    document_repository_path: publishedDocuments.repository_path,
    synced_destinations: syncedDestinations,
  };
}

export function prepareRepositoryProfileArtifact({
  repoRoot,
  workspaceState,
  bundle,
  artifacts,
  slug,
} = {}) {
  const profileSlug = sanitizeSlug(slug || path.basename(repoRoot));
  const profile = {
    schema_version: 1,
    profile_slug: profileSlug,
    workspace_slug: profileSlug,
    customer_slug: profileSlug,
    repo: path.basename(repoRoot),
    repo_root: repoRoot,
    generated_at: bundle.generated_at,
    overview: createProjectOverview(
      workspaceState.graph,
      workspaceState.policyReport,
      workspaceState.documentIndex,
      workspaceState.heartModel,
    ),
    heart: workspaceState.heartModel.summary,
    diagrams: artifacts.manifest.diagrams,
    documents: workspaceState.documentIndex.totals,
    cache: workspaceState.cache,
  };

  return createWebRepositoryProfile(profile, artifacts);
}

export async function listSyncedProfiles(appRoot) {
  const profilesRoot = resolveProfilesRoot(appRoot);

  try {
    const entries = await fs.readdir(profilesRoot, { withFileTypes: true });
    const profiles = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const profile = await loadSyncedProfile(appRoot, entry.name, {
        includeDiagramContents: false,
      });
      profiles.push(profile);
    }

    return profiles.sort((left, right) => left.profile_slug.localeCompare(right.profile_slug));
  } catch {
    return [];
  }
}

export async function loadSyncedProfile(appRoot, slug, options = {}) {
  const safeSlug = sanitizeSlug(slug);
  const profileRoot = path.join(resolveProfilesRoot(appRoot), safeSlug);
  const profileRaw = await fs.readFile(path.join(profileRoot, "repository-profile.json"), "utf8");
  const profile = JSON.parse(profileRaw);

  if (!options.includeDiagramContents) {
    return profile;
  }

  const diagrams = [];
  for (const diagram of profile.diagrams ?? []) {
    const content = await fs.readFile(path.join(profileRoot, "diagrams", diagram.artifact_file), "utf8");
    diagrams.push({
      ...diagram,
      content,
    });
  }

  return {
    ...profile,
    diagrams,
  };
}

export function resolveDiagramTypes(requestedType) {
  if (!requestedType || requestedType === "all") {
    return [...DEFAULT_DIAGRAM_TYPES];
  }

  const normalized = requestedType.toLowerCase();
  if (!DEFAULT_DIAGRAM_TYPES.includes(normalized)) {
    throw new Error(`Unknown diagram type: ${requestedType}`);
  }

  return [normalized];
}

function generateDiagram(type, options) {
  switch (type) {
    case DIAGRAM_TYPES.symbolGraph:
      return generateSymbolGraphDiagram(options.workspaceState);
    case DIAGRAM_TYPES.highLevel:
      return generateHighLevelDiagram(options.workspaceState);
    case DIAGRAM_TYPES.component:
      return generateComponentDiagram(options.workspaceState);
    case DIAGRAM_TYPES.class:
      return generateClassDiagram(options.workspaceState);
    case DIAGRAM_TYPES.sequence:
      return generateSequenceDiagram(options.workspaceState, {
        task: options.task,
        target: options.target,
      });
    case DIAGRAM_TYPES.mindmap:
      return generateMindmapDiagram(options.workspaceState);
    default:
      throw new Error(`Unsupported diagram type: ${type}`);
  }
}

function generateSymbolGraphDiagram(workspaceState) {
  const lines = ["flowchart LR"];
  const repoId = "repo";
  const repoName = path.basename(workspaceState.repoRoot);
  const selectedFiles = workspaceState.scanResult.files.slice(0, 10);
  const includedSymbols = new Set();

  lines.push(`  ${repoId}[${quoteLabel(`Repo: ${repoName}`)}]`);

  for (const file of selectedFiles) {
    const fileId = toMermaidId(`file-${file.relativePath}`);
    lines.push(`  ${fileId}[${quoteLabel(`File: ${file.relativePath}`)}]`);
    lines.push(`  ${repoId} --> ${fileId}`);

    for (const symbol of file.symbols.slice(0, 8)) {
      const symbolId = toMermaidId(symbol.id);
      includedSymbols.add(symbol.id);
      lines.push(`  ${symbolId}[${quoteLabel(`${symbol.kind}: ${symbol.name}`)}]`);
      lines.push(`  ${fileId} --> ${symbolId}`);
    }
  }

  for (const edge of workspaceState.graph.edges.filter((edge) => edge.type === "IMPORTS").slice(0, 12)) {
    const fromId = toMermaidId(edge.from);
    const toId = toMermaidId(edge.to);
    lines.push(`  ${fromId} -. imports .-> ${toId}`);
  }

  for (const edge of workspaceState.graph.edges
    .filter((entry) => ["CALLS", "EXTENDS", "IMPLEMENTS"].includes(entry.type))
    .slice(0, 16)) {
    if (!includedSymbols.has(edge.from) || !includedSymbols.has(edge.to)) {
      continue;
    }

    const relation = edge.type.toLowerCase();
    lines.push(`  ${toMermaidId(edge.from)} == ${quoteLabel(relation)} ==> ${toMermaidId(edge.to)}`);
  }

  return {
    type: DIAGRAM_TYPES.symbolGraph,
    title: "Symbol Graph",
    format: "mermaid",
    inference_mode: "static-ast-graph",
    confidence: workspaceState.graph.edges.some((edge) => ["CALLS", "EXTENDS", "IMPLEMENTS"].includes(edge.type))
      ? "high"
      : "medium",
    scope: {
      focus: "symbol-discovery",
      file_count: selectedFiles.length,
      symbol_count: [...includedSymbols].length,
    },
    summary: `Shows repository files and symbol nodes for classes, functions, constants, and other extracted symbols.`,
    content: lines.join("\n"),
  };
}

function generateHighLevelDiagram(workspaceState) {
  const lines = ["flowchart LR"];
  const repoId = "repo";
  const repoName = path.basename(workspaceState.repoRoot);
  const domains = [...workspaceState.heartModel.domains]
    .sort((left, right) => right.file_paths.length - left.file_paths.length || left.name.localeCompare(right.name))
    .slice(0, 6);
  const componentGraph = buildComponentGraph(workspaceState);
  const componentsByDomain = new Map();

  for (const component of componentGraph.components) {
    const domainName = component.key.split("/")[0];
    const existing = componentsByDomain.get(domainName) ?? [];
    existing.push(component);
    componentsByDomain.set(domainName, existing);
  }

  lines.push(`  ${repoId}[${quoteLabel(`Repo: ${repoName}`)}]`);
  lines.push(`  docs[${quoteLabel(`Docs: ${workspaceState.documentIndex.totals.document_count}`)}]`);
  lines.push(`  ${repoId} --> docs`);

  for (const domain of domains) {
    const domainId = toMermaidId(domain.id);
    lines.push(`  ${domainId}[${quoteLabel(`Domain: ${domain.name}`)}]`);
    lines.push(`  ${repoId} --> ${domainId}`);

    const domainComponents = (componentsByDomain.get(domain.name) ?? []).slice(0, 3);
    if (domainComponents.length > 0) {
      for (const component of domainComponents) {
        const componentId = toMermaidId(`high-level-${component.key}`);
        lines.push(`  ${componentId}[${quoteLabel(`Component: ${component.label}`)}]`);
        lines.push(`  ${domainId} --> ${componentId}`);
      }
      continue;
    }

    for (const filePath of domain.file_paths.slice(0, 2)) {
      const fallbackId = toMermaidId(`hl-${filePath}`);
      lines.push(`  ${fallbackId}[${quoteLabel(shortFileLabel(filePath))}]`);
      lines.push(`  ${domainId} --> ${fallbackId}`);
    }
  }

  return {
    type: DIAGRAM_TYPES.highLevel,
    title: "High-Level Architecture",
    format: "mermaid",
    inference_mode: "static-heart-model",
    confidence: domains.length > 0 && componentGraph.components.length > 0 ? "medium" : "low",
    scope: {
      focus: "domain-overview",
      domain_count: domains.length,
      component_count: componentGraph.components.length,
    },
    summary: `Shows top domains, component anchors, and project document count from the persisted heart model.`,
    content: lines.join("\n"),
  };
}

function generateComponentDiagram(workspaceState) {
  const componentGraph = buildComponentGraph(workspaceState);
  const lines = ["flowchart LR"];

  if (componentGraph.components.length === 0) {
    lines.push("  repo[\"Repo Components\"]");
    lines.push("  repo --> none[\"No component-level source modules discovered\"]");
  } else {
    for (const component of componentGraph.components) {
      const componentId = toMermaidId(`component-${component.key}`);
      lines.push(
        `  ${componentId}[${quoteLabel(`Component: ${component.label}\n${component.file_count} file(s), ${component.symbol_count} symbol(s)`)}]`,
      );
    }

    if (componentGraph.relations.length > 0) {
      for (const relation of componentGraph.relations) {
        lines.push(
          `  ${toMermaidId(`component-${relation.from}`)} -- ${quoteLabel(relation.label)} --> ${toMermaidId(`component-${relation.to}`)}`,
        );
      }
    }
  }

  return {
    type: DIAGRAM_TYPES.component,
    title: "Component Diagram",
    format: "mermaid",
    inference_mode: "static-component-graph",
    confidence: componentGraph.relations.length > 0 ? "medium" : "low",
    scope: {
      focus: "component-boundaries",
      component_count: componentGraph.components.length,
      relation_count: componentGraph.relations.length,
    },
    summary: `Shows static component boundaries and aggregated dependency signals between the most connected implementation modules.`,
    content: lines.join("\n"),
  };
}

function generateClassDiagram(workspaceState) {
  const lines = ["classDiagram"];
  const allSymbols = workspaceState.scanResult.files.flatMap((file) =>
    file.symbols.map((symbol) => ({
      ...symbol,
      file: file.relativePath,
    })),
  );
  const typeSymbols = allSymbols.filter((symbol) =>
    ["class", "interface", "enum", "type"].includes(symbol.kind),
  );
  const methodsByContainer = new Map();
  const declaredNames = new Set();

  for (const symbol of allSymbols.filter((entry) => entry.kind === "method" && entry.container)) {
    const existing = methodsByContainer.get(symbol.container) ?? [];
    existing.push(symbol.name);
    methodsByContainer.set(symbol.container, existing);
  }

  if (typeSymbols.length === 0) {
    lines.push("  class RepositoryTypes");
    lines.push("  RepositoryTypes : No class or interface symbols discovered");
  }

  for (const symbol of typeSymbols) {
    const className = sanitizeClassName(symbol.name);
    declaredNames.add(className);
    lines.push(`  class ${className}`);

    if (symbol.kind !== "class") {
      lines.push(`  <<${symbol.kind}>> ${className}`);
    }

    for (const methodName of dedupe(methodsByContainer.get(symbol.name) ?? []).slice(0, 12)) {
      lines.push(`  ${className} : +${methodName}()`);
    }

    for (const parentName of symbol.relations?.extends ?? []) {
      const parentClass = sanitizeClassName(parentName);
      declaredNames.add(parentClass);
      lines.push(`  ${parentClass} <|-- ${className}`);
    }

    for (const contractName of symbol.relations?.implements ?? []) {
      const contractClass = sanitizeClassName(contractName);
      declaredNames.add(contractClass);
      lines.push(`  ${contractClass} <|.. ${className}`);
    }
  }

  for (const className of declaredNames) {
    if (!lines.includes(`  class ${className}`)) {
      lines.unshift(`  class ${className}`);
    }
  }

  return {
    type: DIAGRAM_TYPES.class,
    title: "Class Diagram",
    format: "mermaid",
    inference_mode: "static-type-shape",
    confidence: typeSymbols.length > 0 ? "medium" : "low",
    scope: {
      focus: "type-structure",
      type_count: typeSymbols.length,
      declared_symbol_count: declaredNames.size,
    },
    summary: `Shows extracted classes, interfaces, enums, and basic inheritance or implementation relationships when available.`,
    content: lines.join("\n"),
  };
}

function generateSequenceDiagram(workspaceState, options = {}) {
  const task = options.task?.trim() || (options.target ? `inspect ${options.target}` : "review repository flow");
  const pack = compileContextPack({
    task,
    graph: workspaceState.graph,
    documentIndex: workspaceState.documentIndex,
    heartModel: workspaceState.heartModel,
    policyReport: workspaceState.policyReport,
  });
  const relevantRoutes = collectRelevantRoutes(workspaceState.scanResult, task, pack);
  const actorLabel = relevantRoutes.length > 0 ? "Client" : "User";
  const lines = ["sequenceDiagram", "  autonumber", `  actor ${actorLabel}`];
  const fileParticipants = [];
  const testParticipants = [];
  const aliasByFile = new Map();
  const participantLabels = new Set();
  let fallbackParticipant = actorLabel;

  if (pack.relevant_documents.length > 0) {
    lines.push("  participant Docs as Project Docs");
    fallbackParticipant = "Docs";
  }

  for (const route of relevantRoutes) {
    if (aliasByFile.has(route.file_path)) {
      continue;
    }

    const alias = toParticipantAlias(route.file_path, aliasByFile.size);
    aliasByFile.set(route.file_path, alias);
    fileParticipants.push(route.file_path);
    lines.push(
      `  participant ${alias} as ${escapeSequenceText(buildUniqueParticipantLabel(route.file_path, participantLabels))}`,
    );
    fallbackParticipant = alias;
  }

  for (const file of pack.relevant_files.slice(0, 4)) {
    if (aliasByFile.has(file.path)) {
      continue;
    }

    const alias = toParticipantAlias(file.path, aliasByFile.size);
    aliasByFile.set(file.path, alias);
    fileParticipants.push(file.path);
    lines.push(`  participant ${alias} as ${escapeSequenceText(buildUniqueParticipantLabel(file.path, participantLabels))}`);
    fallbackParticipant = alias;
  }

  for (const supportPath of dedupe([
    ...pack.call_paths.flatMap((callPath) => [callPath.from_file, callPath.to_file]),
    ...pack.graph_context.related_files.map((file) => file.path),
  ]).slice(0, 3)) {
    if (!supportPath || aliasByFile.has(supportPath)) {
      continue;
    }

    const alias = toParticipantAlias(supportPath, aliasByFile.size);
    aliasByFile.set(supportPath, alias);
    fileParticipants.push(supportPath);
    lines.push(`  participant ${alias} as ${escapeSequenceText(buildUniqueParticipantLabel(supportPath, participantLabels))}`);
  }

  for (const testPath of pack.tests_to_run.slice(0, 2)) {
    if (aliasByFile.has(testPath)) {
      continue;
    }

    const alias = toParticipantAlias(testPath, aliasByFile.size);
    aliasByFile.set(testPath, alias);
    testParticipants.push(testPath);
    lines.push(`  participant ${alias} as ${escapeSequenceText(buildUniqueParticipantLabel(testPath, participantLabels))}`);
  }

  const orderedParticipants = [...fileParticipants, ...testParticipants];
  const noteTarget =
    orderedParticipants.length > 0
      ? aliasByFile.get(orderedParticipants[orderedParticipants.length - 1])
      : fallbackParticipant;
  const noteText =
    relevantRoutes.length > 0
      ? "Best-effort route trace inferred from parsed HTTP routes, typed call graph, tests, and import fallback edges."
      : pack.call_paths.length > 0
      ? "Heuristic static sequence inferred from typed call paths, tests, and import edges."
      : "Heuristic static sequence inferred from context pack and import edges.";
  lines.push(
    `  Note over ${actorLabel},${noteTarget}: ${noteText}`,
  );

  if (fileParticipants.length === 0) {
    lines.push(`  ${actorLabel}->>${fallbackParticipant}: ${escapeSequenceText(task)}`);
  } else {
    const firstAlias = aliasByFile.get(fileParticipants[0]);
    if (relevantRoutes.length > 0) {
      for (const route of relevantRoutes) {
        const routeAlias = aliasByFile.get(route.file_path);
        if (!routeAlias) {
          continue;
        }

        lines.push(`  ${actorLabel}->>${routeAlias}: ${escapeSequenceText(`${route.method} ${route.path}`)}`);
      }
    } else {
      lines.push(`  ${actorLabel}->>${firstAlias}: ${escapeSequenceText(task)}`);
    }

    if (pack.relevant_documents.length > 0) {
      lines.push(`  ${firstAlias}->>Docs: verify requirements and design`);
    }

    const interactions = buildSequenceInteractions(
      workspaceState.graph,
      orderedParticipants,
      aliasByFile,
      {
        callPaths: pack.call_paths,
        routes: relevantRoutes,
      },
    );
    for (const interaction of interactions) {
      lines.push(`  ${interaction.from}->>${interaction.to}: ${escapeSequenceText(interaction.label)}`);
    }

    const implementationTarget = pack.linked_context.implementation_targets[0];
    if (implementationTarget?.file_path && aliasByFile.has(implementationTarget.file_path)) {
      lines.push(
        `  ${firstAlias}-->>${aliasByFile.get(implementationTarget.file_path)}: reuse existing implementation`,
      );
    } else if (fileParticipants.length === 1) {
      lines.push(`  ${firstAlias}-->>${firstAlias}: verify local implementation path`);
    }
  }

  return {
    type: DIAGRAM_TYPES.sequence,
    title: "Sequence Diagram",
    format: "mermaid",
    inference_mode: relevantRoutes.length > 0 ? "route-trace-heuristic" : "static-context-heuristic",
    confidence: relevantRoutes.length > 0 || pack.call_paths.length > 0 || pack.tests_to_run.length > 0 ? "medium" : "low",
    scope: {
      focus: "interaction-flow",
      task,
      participant_count: orderedParticipants.length + (pack.relevant_documents.length > 0 ? 1 : 0),
      call_path_count: pack.call_paths.length,
      route_count: relevantRoutes.length,
    },
    summary: relevantRoutes.length > 0
      ? `Shows a best-effort route trace derived from parsed HTTP routes, typed call paths, tests, linked documents, and import fallback edges.`
      : `Shows a best-effort interaction flow derived from typed call paths, tests, linked documents, and import fallback edges.`,
    content: lines.join("\n"),
  };
}

function generateMindmapDiagram(workspaceState) {
  const repoName = path.basename(workspaceState.repoRoot);
  const lines = ["mindmap", `  root((Repo: ${escapeMindmapText(repoName)}))`];
  const documentsByCategory = groupDocumentsByCategory(workspaceState.documentIndex.documents ?? []);
  const domains = [...(workspaceState.heartModel.domains ?? [])]
    .sort((left, right) => right.file_paths.length - left.file_paths.length || left.name.localeCompare(right.name))
    .slice(0, 6);
  const relationships = (workspaceState.heartModel.links ?? [])
    .filter((link) => link.type === "DOMAIN_TO_DOMAIN")
    .sort((left, right) => right.score - left.score || left.from.localeCompare(right.from) || left.to.localeCompare(right.to))
    .slice(0, 10);

  lines.push("    Documents");
  appendMindmapCategory(lines, "Business", documentsByCategory.business);
  appendMindmapCategory(lines, "Requirements", documentsByCategory.requirements);
  appendMindmapCategory(lines, "Technical", documentsByCategory.technical);
  appendMindmapCategory(lines, "Execution", documentsByCategory.execution);
  appendMindmapCategory(lines, "General", documentsByCategory.general);

  lines.push("    Code Domains");
  if (domains.length === 0) {
    lines.push("      No domains indexed");
  } else {
    for (const domain of domains) {
      lines.push(`      ${escapeMindmapText(domain.name)}`);
      lines.push(`        Files: ${domain.file_paths.length}`);
      lines.push(`        Symbols: ${domain.symbol_ids.length}`);
      if ((domain.document_paths ?? []).length > 0) {
        lines.push(`        Docs: ${domain.document_paths.length}`);
      }
      const related = relationships
        .filter((link) => link.from === domain.id || link.to === domain.id)
        .slice(0, 2);
      if (related.length > 0) {
        lines.push("        Related");
        for (const relationship of related) {
          const targetId = relationship.from === domain.id ? relationship.to : relationship.from;
          const targetName = String(targetId).replace(/^domain:/, "");
          const kinds = (relationship.metadata?.relationship_kinds ?? []).join("+");
          lines.push(`          ${escapeMindmapText(`${targetName} (${kinds || "linked"})`)}`);
        }
      }
    }
  }

  lines.push("    Memory Signals");
  lines.push(`      Heart links: ${workspaceState.heartModel.summary.relationship_count ?? 0}`);
  lines.push(`      Documents indexed: ${workspaceState.documentIndex.totals.document_count ?? 0}`);
  lines.push(`      Source files: ${workspaceState.scanResult.totals.file_count ?? 0}`);

  return {
    type: DIAGRAM_TYPES.mindmap,
    title: "Cross-Source Mind Map",
    format: "mermaid",
    inference_mode: "static-heart-document-map",
    confidence:
      (workspaceState.documentIndex.totals.document_count ?? 0) > 0 && domains.length > 0
        ? "high"
        : domains.length > 0
        ? "medium"
        : "low",
    scope: {
      focus: "cross-source-memory",
      document_count: workspaceState.documentIndex.totals.document_count ?? 0,
      domain_count: domains.length,
      relationship_count: relationships.length,
    },
    summary:
      "Shows business, requirements, technical documents, implementation domains, and saved cross-domain memory links in one review map.",
    content: lines.join("\n"),
  };
}

function buildSequenceInteractions(graph, fileParticipants, aliasByFile, options = {}) {
  const participantSet = new Set(fileParticipants);
  const callPaths = options.callPaths ?? [];
  const routes = options.routes ?? [];
  const interactions = [];

  interactions.push(...buildRouteTraceInteractions(graph, routes, participantSet, aliasByFile));

  for (const callPath of callPaths) {
    if (
      !callPath?.from_file ||
      !callPath?.to_file ||
      !participantSet.has(callPath.from_file) ||
      !participantSet.has(callPath.to_file)
    ) {
      continue;
    }

    interactions.push({
      from: aliasByFile.get(callPath.from_file),
      to: aliasByFile.get(callPath.to_file),
      label: `${callPath.from} calls ${callPath.to}`,
    });
  }

  for (const edge of (graph.edges ?? []).filter((entry) => entry.type === "CALLS")) {
    const fromNode = findGraphNode(graph, edge.from);
    const toNode = findGraphNode(graph, edge.to);

    if (!fromNode?.path || !toNode?.path) {
      continue;
    }

    if (!participantSet.has(fromNode.path) || !participantSet.has(toNode.path)) {
      continue;
    }

    interactions.push({
      from: aliasByFile.get(fromNode.path),
      to: aliasByFile.get(toNode.path),
      label: `${fromNode.name} calls ${toNode.name}`,
    });
  }

  for (const edge of (graph.edges ?? []).filter((entry) => entry.type === "TESTED_BY")) {
    const targetNode = findGraphNode(graph, edge.from);
    const testNode = findGraphNode(graph, edge.to);

    if (!targetNode?.path || !testNode?.path) {
      continue;
    }

    if (!participantSet.has(targetNode.path) || !participantSet.has(testNode.path)) {
      continue;
    }

    interactions.push({
      from: aliasByFile.get(testNode.path),
      to: aliasByFile.get(targetNode.path),
      label: `exercise ${targetNode.name}`,
    });
  }

  for (const edge of (graph.edges ?? []).filter((entry) => entry.type === "IMPORTS")) {
    const fromFile = edge.from.replace(/^file:/, "");
    const toFile = edge.to.replace(/^file:/, "");

    if (!participantSet.has(fromFile) || !participantSet.has(toFile)) {
      continue;
    }

    interactions.push({
      from: aliasByFile.get(fromFile),
      to: aliasByFile.get(toFile),
      label: edge.metadata.specifier ? `use ${edge.metadata.specifier}` : "use imported module",
    });
  }

  if (interactions.length > 0) {
    return dedupeByKey(interactions, (entry) => `${entry.from}:${entry.to}:${entry.label}`).slice(0, 8);
  }

  const fallback = [];
  for (let index = 0; index < fileParticipants.length - 1; index += 1) {
    const fromFile = fileParticipants[index];
    const toFile = fileParticipants[index + 1];
    fallback.push({
      from: aliasByFile.get(fromFile),
      to: aliasByFile.get(toFile),
      label: "context handoff",
    });
  }

  return fallback;
}

function collectRelevantRoutes(scanResult, task, pack, limit = 2) {
  const taskTokens = tokenize(task);
  const relevantFiles = new Set(pack.relevant_files.map((file) => file.path));
  const relevantSymbols = new Set(pack.relevant_symbols.map((symbol) => symbol.name.toLowerCase()));

  return (scanResult.files ?? [])
    .flatMap((file) =>
      (file.routes ?? []).map((route) => ({
        ...route,
        file_path: file.relativePath,
        score: scoreRoute(route, file.relativePath, taskTokens, relevantFiles, relevantSymbols),
      })),
    )
    .filter((route) => route.score > 0)
    .sort((left, right) => right.score - left.score || left.file_path.localeCompare(right.file_path) || left.path.localeCompare(right.path))
    .slice(0, limit);
}

function scoreRoute(route, filePath, taskTokens, relevantFiles, relevantSymbols) {
  const haystack = `${filePath} ${route.method} ${route.path} ${route.handler_name} ${route.framework}`.toLowerCase();
  const lexicalScore = taskTokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
  const fileBoost = relevantFiles.has(filePath) ? 2 : 0;
  const symbolBoost = relevantSymbols.has(String(route.handler_name ?? "").toLowerCase()) ? 2 : 0;
  const routeIntentBoost = taskTokens.some((token) => ["route", "routes", "api", "endpoint", "request", "http"].includes(token))
    ? 1
    : 0;

  return lexicalScore + fileBoost + symbolBoost + routeIntentBoost;
}

function buildRouteTraceInteractions(graph, routes, participantSet, aliasByFile, limit = 6) {
  const interactions = [];
  const seenEdges = new Set();

  for (const route of routes) {
    if (interactions.length >= limit) {
      break;
    }

    const entrySymbol = resolveRouteEntrySymbol(graph, route);
    if (!entrySymbol?.path) {
      continue;
    }

    if (participantSet.has(route.file_path) && participantSet.has(entrySymbol.path) && route.file_path !== entrySymbol.path) {
      interactions.push({
        from: aliasByFile.get(route.file_path),
        to: aliasByFile.get(entrySymbol.path),
        label: `${route.method} ${route.path} -> ${entrySymbol.name}`,
      });
    }

    const queue = [entrySymbol.id];
    const visitedSymbols = new Set(queue);
    while (queue.length > 0 && interactions.length < limit) {
      const currentSymbolId = queue.shift();
      const outgoingEdges = (graph.edges ?? [])
        .filter((edge) => edge.type === "CALLS" && edge.from === currentSymbolId)
        .sort((left, right) => {
          const leftLine = Number(left.metadata?.line ?? 0);
          const rightLine = Number(right.metadata?.line ?? 0);
          return leftLine - rightLine || left.id.localeCompare(right.id);
        });

      for (const edge of outgoingEdges) {
        if (seenEdges.has(edge.id)) {
          continue;
        }

        const fromNode = findGraphNode(graph, edge.from);
        const toNode = findGraphNode(graph, edge.to);
        if (!fromNode?.path || !toNode?.path) {
          continue;
        }

        if (!participantSet.has(fromNode.path) || !participantSet.has(toNode.path)) {
          continue;
        }

        interactions.push({
          from: aliasByFile.get(fromNode.path),
          to: aliasByFile.get(toNode.path),
          label: `${fromNode.name} calls ${toNode.name}`,
        });
        seenEdges.add(edge.id);

        if (!visitedSymbols.has(toNode.id)) {
          visitedSymbols.add(toNode.id);
          queue.push(toNode.id);
        }

        if (interactions.length >= limit) {
          break;
        }
      }
    }
  }

  return interactions;
}

function finalizeDiagram(diagram) {
  const validation = diagram.validation ?? validateDiagram(diagram);

  return {
    ...diagram,
    validation,
    trust: diagram.trust ?? buildDiagramTrust(diagram, validation),
  };
}

function validateDiagram(diagram) {
  if (diagram.type !== DIAGRAM_TYPES.sequence) {
    return {
      status: "passed",
      warning_count: 0,
      warnings: [],
    };
  }

  const lines = String(diagram.content ?? "").split("\n");
  const participantLines = lines.filter((line) => line.trim().startsWith("participant "));
  const aliases = new Set(
    participantLines
      .map((line) => line.trim().match(/^participant\s+([A-Za-z0-9_]+)/))
      .filter(Boolean)
      .map((match) => match[1]),
  );
  aliases.add("Client");
  aliases.add("User");
  aliases.add("Docs");

  const participantLabels = participantLines.map((line) => line.split(" as ")[1]?.trim() ?? "");
  const duplicateLabels = participantLabels.filter(
    (label, index) => label && participantLabels.indexOf(label) !== index,
  );
  const warnings = [];

  if (duplicateLabels.length > 0) {
    warnings.push(`Duplicate participant labels detected: ${dedupe(duplicateLabels).join(", ")}`);
  }

  for (const line of lines) {
    const match = line.trim().match(/^([A-Za-z0-9_]+)(?:--|->)+>([A-Za-z0-9_]+):/);
    if (!match) {
      continue;
    }

    const [, fromAlias, toAlias] = match;
    if (!aliases.has(fromAlias) || !aliases.has(toAlias)) {
      warnings.push(`Unresolved interaction alias detected: ${fromAlias} -> ${toAlias}`);
    }
  }

  return {
    status: warnings.length === 0 ? "passed" : "warning",
    warning_count: warnings.length,
    warnings,
  };
}

function buildDiagramTrust(diagram, validation) {
  const heuristic = /heuristic/i.test(String(diagram.inference_mode ?? ""));

  if (heuristic) {
    return {
      label: "beta",
      note: "Heuristic diagram. Use as directional review aid, not a canonical source of truth.",
      validation_status: validation.status,
    };
  }

  return {
    label: diagram.confidence === "high" ? "verified" : "derived",
    note:
      diagram.confidence === "high"
        ? "Derived from typed repository data with no heuristic expansion."
        : "Derived from static repository analysis and should still be spot-checked.",
    validation_status: validation.status,
  };
}

function resolveRouteEntrySymbol(graph, route) {
  const candidates = (graph.nodes ?? []).filter((node) => {
    if (!["Function", "Method"].includes(node.type)) {
      return false;
    }

    return node.name === route.handler_name;
  });

  const localCandidate = candidates.find((node) => node.path === route.file_path);
  if (localCandidate) {
    return localCandidate;
  }

  return candidates[0] ?? null;
}

function tokenize(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3);
}

function buildComponentGraph(workspaceState) {
  const componentMap = new Map();
  const componentByFile = new Map();

  for (const file of workspaceState.scanResult.files.filter((entry) => isComponentCandidateFile(entry.relativePath))) {
    const key = toComponentKey(file.relativePath);
    const existing = componentMap.get(key) ?? {
      key,
      label: key,
      file_count: 0,
      symbol_count: 0,
      relation_count: 0,
    };

    existing.file_count += 1;
    existing.symbol_count += file.symbols.length;
    componentMap.set(key, existing);
    componentByFile.set(file.relativePath, key);
  }

  const relationMap = new Map();
  for (const edge of workspaceState.graph.edges ?? []) {
    const { fromFile, toFile, relationType } = resolveComponentRelation(workspaceState.graph, edge);
    if (!fromFile || !toFile) {
      continue;
    }

    const fromComponent = componentByFile.get(fromFile);
    const toComponent = componentByFile.get(toFile);
    if (!fromComponent || !toComponent || fromComponent === toComponent) {
      continue;
    }

    const relationKey = `${fromComponent}:${toComponent}`;
    const relation = relationMap.get(relationKey) ?? {
      from: fromComponent,
      to: toComponent,
      total: 0,
      counts: new Map(),
    };

    relation.total += 1;
    relation.counts.set(relationType, (relation.counts.get(relationType) ?? 0) + 1);
    relationMap.set(relationKey, relation);
  }

  for (const relation of relationMap.values()) {
    componentMap.get(relation.from).relation_count += relation.total;
    componentMap.get(relation.to).relation_count += relation.total;
  }

  const rankedComponents = [...componentMap.values()]
    .sort(
      (left, right) =>
        right.relation_count - left.relation_count ||
        right.symbol_count - left.symbol_count ||
        left.label.localeCompare(right.label),
    )
    .slice(0, 8);
  const selectedComponentKeys = new Set(rankedComponents.map((component) => component.key));
  const relations = [...relationMap.values()]
    .filter((relation) => selectedComponentKeys.has(relation.from) && selectedComponentKeys.has(relation.to))
    .sort(
      (left, right) =>
        right.total - left.total || left.from.localeCompare(right.from) || left.to.localeCompare(right.to),
    )
    .slice(0, 12)
    .map((relation) => ({
      from: relation.from,
      to: relation.to,
      label: formatComponentRelationLabel(relation.counts),
    }));

  return {
    components: rankedComponents,
    relations,
  };
}

function groupDocumentsByCategory(documents) {
  const grouped = {
    business: [],
    requirements: [],
    technical: [],
    execution: [],
    general: [],
  };

  for (const document of documents) {
    const category = grouped[document.category] ? document.category : "general";
    grouped[category].push(document);
  }

  for (const category of Object.keys(grouped)) {
    grouped[category] = grouped[category]
      .sort((left, right) => left.path.localeCompare(right.path))
      .slice(0, 4);
  }

  return grouped;
}

function appendMindmapCategory(lines, label, documents = []) {
  lines.push(`      ${label}`);

  if (documents.length === 0) {
    lines.push("        None indexed");
    return;
  }

  for (const document of documents) {
    lines.push(`        ${escapeMindmapText(document.title || document.path)}`);
  }
}

function resolveComponentRelation(graph, edge) {
  switch (edge.type) {
    case "IMPORTS":
      return {
        fromFile: edge.from.replace(/^file:/, ""),
        toFile: edge.to.replace(/^file:/, ""),
        relationType: "imports",
      };
    case "CALLS":
    case "EXTENDS":
    case "IMPLEMENTS": {
      const fromNode = findGraphNode(graph, edge.from);
      const toNode = findGraphNode(graph, edge.to);
      return {
        fromFile: fromNode?.path ?? "",
        toFile: toNode?.path ?? "",
        relationType: edge.type.toLowerCase(),
      };
    }
    default:
      return {
        fromFile: "",
        toFile: "",
        relationType: "",
      };
  }
}

function formatComponentRelationLabel(counts) {
  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([relationType, count]) => `${relationType} x${count}`)
    .join(", ");
}

function isComponentCandidateFile(filePath) {
  return !/\.test\.[^.]+$/u.test(filePath) && !/\.spec\.[^.]+$/u.test(filePath) && !filePath.startsWith("docs/");
}

function toComponentKey(filePath) {
  const normalizedPath = String(filePath).replace(/\\/g, "/");
  const segments = normalizedPath.split("/");
  const stem = segments[segments.length - 1].replace(/\.[^.]+$/u, "");

  if (segments[0] === "src" && segments.length >= 3) {
    return `${segments[1]}/${stem}`;
  }

  if (["packages", "services", "apps"].includes(segments[0]) && segments.length >= 4) {
    return `${segments[0]}/${segments[1]}/${segments[2]}/${stem}`;
  }

  return normalizedPath.replace(/\.[^.]+$/u, "");
}

function normalizeDiagramTypes(types) {
  if (typeof types === "string") {
    return resolveDiagramTypes(types);
  }

  return dedupe(types.flatMap((type) => resolveDiagramTypes(type)));
}

async function resolveSyncDestinations(repoRoot, { portalRoot, adminRoot, profileSlug }) {
  const destinations = [];

  const candidates = [
    {
      kind: "portal",
      root: portalRoot ?? path.join(repoRoot, "apps", "portal"),
      explicit: Boolean(portalRoot),
    },
    {
      kind: "admin",
      root: adminRoot ?? path.join(repoRoot, "apps", "admin"),
      explicit: Boolean(adminRoot),
    },
  ];

  for (const candidate of candidates) {
    if (!candidate.root) {
      continue;
    }

    if (!candidate.explicit && !(await pathExists(candidate.root))) {
      continue;
    }

    destinations.push({
      kind: candidate.kind,
      root: candidate.root,
      path: path.join(candidate.root, "profiles", profileSlug),
    });
  }

  return destinations;
}

function resolveProfilesRoot(appRoot) {
  return path.join(appRoot, "profiles");
}

function sanitizeSlug(value) {
  return String(value ?? "profile")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "profile";
}

function createWebRepositoryProfile(profile, artifacts) {
  return {
    schema_version: 1,
    profile_slug: profile.profile_slug,
    workspace_slug: profile.workspace_slug ?? profile.profile_slug,
    customer_slug: profile.customer_slug ?? profile.profile_slug,
    repo: profile.repo,
    generated_at: profile.generated_at,
    overview: {
      summary: profile.overview.summary,
      file_count: profile.overview.file_count,
      symbol_count: profile.overview.symbol_count,
      parser_engine: profile.overview.parser_engine,
      policy_warnings: profile.overview.policy_warnings,
      domain_count: profile.overview.domain_count,
      relationship_count: profile.overview.relationship_count,
    },
    heart: {
      domain_count: profile.heart.domain_count,
      relationship_count: profile.heart.relationship_count,
    },
    documents: {
      document_count: profile.documents.document_count,
      decision_count: profile.documents.decision_count,
      requirement_count: profile.documents.requirement_count,
      technical_count: profile.documents.technical_count,
    },
    cache: {
      status: profile.cache.status,
      scan_mode: profile.cache.scan_mode,
    },
    diagrams: artifacts.diagrams.map((diagram) => ({
      type: diagram.type,
      title: diagram.title,
      format: diagram.format,
      inference_mode: diagram.inference_mode,
      confidence: diagram.confidence,
      trust: diagram.trust,
      validation: diagram.validation,
      scope: diagram.scope,
      summary: diagram.summary,
      content: diagram.content,
    })),
  };
}

function quoteLabel(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function toMermaidId(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^(\d)/, "_$1");
}

function sanitizeClassName(value) {
  return String(value).replace(/[^a-zA-Z0-9_]/g, "_");
}

function toParticipantAlias(filePath, index) {
  const base = path.posix.basename(filePath).replace(/\.[^.]+$/, "") || `participant_${index + 1}`;
  return toMermaidId(`${base}_${index + 1}`);
}

function shortFileLabel(filePath) {
  const parts = filePath.split("/");
  return parts.length <= 2 ? filePath : `${parts.slice(-2).join("/")}`;
}

function buildUniqueParticipantLabel(filePath, usedLabels = new Set()) {
  const parts = String(filePath ?? "").split("/");

  for (let width = Math.min(parts.length, 4); width >= 2; width -= 1) {
    const label = parts.slice(-width).join("/");
    if (!usedLabels.has(label)) {
      usedLabels.add(label);
      return label;
    }
  }

  const fallback = String(filePath ?? "");
  let candidate = fallback;
  let suffix = 2;
  while (usedLabels.has(candidate)) {
    candidate = `${fallback} (${suffix})`;
    suffix += 1;
  }
  usedLabels.add(candidate);
  return candidate;
}

function escapeSequenceText(value) {
  return String(value).replace(/\n+/g, " ").replace(/"/g, "'");
}

function escapeMindmapText(value) {
  return String(value ?? "")
    .replace(/\n+/g, " ")
    .replace(/["`]/g, "")
    .trim();
}

function dedupe(items) {
  return [...new Set(items)];
}

function dedupeByKey(items, getKey) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

function findGraphNode(graph, nodeId) {
  return (graph.nodes ?? []).find((node) => node.id === nodeId) ?? null;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
