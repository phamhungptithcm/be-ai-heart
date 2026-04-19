import fs from "node:fs/promises";
import path from "node:path";

import { compileContextPack } from "../../context-compiler/src/index.js";
import { syncRepositoryDocumentsToSurfaces } from "../../document-sync/src/index.js";
import { createProjectOverview } from "../../graph/src/index.js";
import {
  publishProfilesToSurface,
  publishWorkspacesToSurface,
  resolveServiceStorageRoot,
  writeRepositoryProfileArtifactRecord,
} from "../../../services/api/src/storage.js";

export const DIAGRAM_TYPES = Object.freeze({
  symbolGraph: "symbol-graph",
  highLevel: "high-level",
  class: "class",
  sequence: "sequence",
});

const DEFAULT_DIAGRAM_TYPES = Object.freeze([
  DIAGRAM_TYPES.symbolGraph,
  DIAGRAM_TYPES.highLevel,
  DIAGRAM_TYPES.class,
  DIAGRAM_TYPES.sequence,
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
    generateDiagram(type, {
      workspaceState,
      task,
      target,
    }),
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
  });
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
    case DIAGRAM_TYPES.class:
      return generateClassDiagram(options.workspaceState);
    case DIAGRAM_TYPES.sequence:
      return generateSequenceDiagram(options.workspaceState, {
        task: options.task,
        target: options.target,
      });
    default:
      throw new Error(`Unsupported diagram type: ${type}`);
  }
}

function generateSymbolGraphDiagram(workspaceState) {
  const lines = ["flowchart LR"];
  const repoId = "repo";
  const repoName = path.basename(workspaceState.repoRoot);
  const selectedFiles = workspaceState.scanResult.files.slice(0, 10);

  lines.push(`  ${repoId}[${quoteLabel(`Repo: ${repoName}`)}]`);

  for (const file of selectedFiles) {
    const fileId = toMermaidId(`file-${file.relativePath}`);
    lines.push(`  ${fileId}[${quoteLabel(`File: ${file.relativePath}`)}]`);
    lines.push(`  ${repoId} --> ${fileId}`);

    for (const symbol of file.symbols.slice(0, 8)) {
      const symbolId = toMermaidId(symbol.id);
      lines.push(`  ${symbolId}[${quoteLabel(`${symbol.kind}: ${symbol.name}`)}]`);
      lines.push(`  ${fileId} --> ${symbolId}`);
    }
  }

  for (const edge of workspaceState.graph.edges.filter((edge) => edge.type === "IMPORTS").slice(0, 12)) {
    const fromId = toMermaidId(edge.from);
    const toId = toMermaidId(edge.to);
    lines.push(`  ${fromId} -. imports .-> ${toId}`);
  }

  return {
    type: DIAGRAM_TYPES.symbolGraph,
    title: "Symbol Graph",
    format: "mermaid",
    inference_mode: "static-ast-graph",
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

  lines.push(`  ${repoId}[${quoteLabel(`Repo: ${repoName}`)}]`);
  lines.push(`  docs[${quoteLabel(`Docs: ${workspaceState.documentIndex.totals.document_count}`)}]`);
  lines.push(`  ${repoId} --> docs`);

  for (const domain of domains) {
    const domainId = toMermaidId(domain.id);
    lines.push(`  ${domainId}[${quoteLabel(`Domain: ${domain.name}`)}]`);
    lines.push(`  ${repoId} --> ${domainId}`);

    for (const filePath of domain.file_paths.slice(0, 3)) {
      const fileId = toMermaidId(`hl-${filePath}`);
      lines.push(`  ${fileId}[${quoteLabel(shortFileLabel(filePath))}]`);
      lines.push(`  ${domainId} --> ${fileId}`);
    }
  }

  return {
    type: DIAGRAM_TYPES.highLevel,
    title: "High-Level Architecture",
    format: "mermaid",
    inference_mode: "static-heart-model",
    summary: `Shows top domains, representative files, and project document count from the persisted heart model.`,
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
  const lines = ["sequenceDiagram", "  autonumber", "  actor User"];
  const fileParticipants = [];
  const aliasByFile = new Map();
  let fallbackParticipant = "User";

  if (pack.relevant_documents.length > 0) {
    lines.push("  participant Docs as Project Docs");
    fallbackParticipant = "Docs";
  }

  for (const file of pack.relevant_files.slice(0, 4)) {
    const alias = toParticipantAlias(file.path, aliasByFile.size);
    aliasByFile.set(file.path, alias);
    fileParticipants.push(file.path);
    lines.push(`  participant ${alias} as ${escapeSequenceText(shortFileLabel(file.path))}`);
    fallbackParticipant = alias;
  }

  const noteTarget =
    fileParticipants.length > 0 ? aliasByFile.get(fileParticipants[fileParticipants.length - 1]) : fallbackParticipant;
  lines.push(
    `  Note over User,${noteTarget}: Heuristic static sequence inferred from context pack and import edges.`,
  );

  if (fileParticipants.length === 0) {
    lines.push(`  User->>${fallbackParticipant}: ${escapeSequenceText(task)}`);
  } else {
    const firstAlias = aliasByFile.get(fileParticipants[0]);
    lines.push(`  User->>${firstAlias}: ${escapeSequenceText(task)}`);

    if (pack.relevant_documents.length > 0) {
      lines.push(`  ${firstAlias}->>Docs: verify requirements and design`);
    }

    const interactions = buildSequenceInteractions(workspaceState.graph.edges, fileParticipants, aliasByFile);
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
    inference_mode: "static-context-heuristic",
    summary: `Shows a best-effort interaction flow derived from relevant files, imports, linked documents, and reuse targets.`,
    content: lines.join("\n"),
  };
}

function buildSequenceInteractions(edges, fileParticipants, aliasByFile) {
  const participantSet = new Set(fileParticipants);
  const interactions = [];

  for (const edge of edges.filter((entry) => entry.type === "IMPORTS")) {
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

function escapeSequenceText(value) {
  return String(value).replace(/\n+/g, " ").replace(/"/g, "'");
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

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
