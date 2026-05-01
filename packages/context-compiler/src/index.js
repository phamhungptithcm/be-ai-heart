import { findRelevantDocuments } from "../../document-ingest/src/index.js";
import {
  getDecisionImplementationsForDocuments,
  getLinkedModulesForDocuments,
  getModuleRelationshipsForDocuments,
} from "../../entity-linker/src/index.js";
import { EDGE_TYPES } from "../../shared-schema/src/index.js";

const FILE_RELATION_WEIGHTS = Object.freeze({
  calls: 4,
  extends: 3,
  implements: 3,
  imports: 2,
});

const SYMBOL_RELATION_WEIGHTS = Object.freeze({
  calls: 5,
  extends: 4,
  implements: 4,
});

const DOCUMENT_CATEGORY_WEIGHTS = Object.freeze({
  requirements: 1.5,
  technical: 1.3,
  execution: 1.1,
  business: 0.9,
  general: 0.6,
});

const UI_INTENT_TOKENS = new Set([
  "admin",
  "button",
  "component",
  "components",
  "dashboard",
  "frontend",
  "layout",
  "page",
  "pages",
  "portal",
  "screen",
  "screens",
  "style",
  "styles",
  "table",
  "tables",
  "ui",
  "ux",
  "visual",
  "website",
]);

const CORE_INTENT_TOKENS = new Set([
  "api",
  "auth",
  "backend",
  "benchmark",
  "cli",
  "compiler",
  "context",
  "document",
  "documents",
  "graph",
  "ingest",
  "mcp",
  "parser",
  "policy",
  "runtime",
  "service",
  "session",
  "sync",
]);

const OWNERSHIP_DOMAIN_TOKENS = new Set([
  "admin",
  "api",
  "auth",
  "benchmark",
  "cli",
  "compiler",
  "context",
  "document",
  "documents",
  "graph",
  "ingest",
  "mcp",
  "parser",
  "policy",
  "portal",
  "runtime",
  "service",
  "session",
  "sync",
  "website",
]);

const SURFACE_OWNER_TOKENS = new Set(["admin", "portal", "website"]);

export function compileContextPack({
  task,
  graph,
  documentIndex = { documents: [], totals: { document_count: 0 } },
  heartModel = { domains: [], links: [], summary: { relationship_count: 0 } },
  policyReport = { violations: [] },
  maxFiles = 5,
  maxSymbols = 8,
  tokenBudget = null,
}) {
  const safeGraph = {
    ...graph,
    scanResult: {
      ...(graph?.scanResult ?? {}),
      files: graph?.scanResult?.files ?? [],
    },
    nodes: graph?.nodes ?? [],
    edges: graph?.edges ?? [],
  };
  const taskTokens = tokenize(task);
  const taskProfile = createTaskIntentProfile(taskTokens);
  const policyFocused = taskMentionsPolicy(taskTokens);
  const relevantDocuments = rankRelevantDocuments(documentIndex, task, taskTokens);
  const documentInfluenceByPath = createDocumentInfluenceMap(relevantDocuments, documentIndex, taskTokens);
  const linkedModules = getLinkedModulesForDocuments(
    heartModel,
    relevantDocuments.map((document) => document.path),
  );
  const moduleRelationships = getModuleRelationshipsForDocuments(
    heartModel,
    relevantDocuments.map((document) => document.path),
  );
  const decisionTargets = getDecisionImplementationsForDocuments(
    heartModel,
    relevantDocuments.map((document) => document.path),
  );
  const moduleBoosts = createModuleBoostMap(linkedModules, documentInfluenceByPath, { policyFocused });
  const relationshipBoosts = createModuleRelationshipBoostMap(moduleRelationships, documentInfluenceByPath, {
    policyFocused,
    boundaryFocused: taskProfile.boundaryFocused,
  });
  const relationshipAwareModuleBoosts = mergeBoostMaps(moduleBoosts, relationshipBoosts);
  const decisionBoosts = createDecisionBoostMaps(decisionTargets, documentInfluenceByPath, { policyFocused });
  const policyBoosts = createPolicyBoostMaps(safeGraph.scanResult, policyReport, taskTokens);
  const testingRequested = taskMentionsTesting(taskTokens);
  const intentBoosts = createIntentBoostMaps(safeGraph.scanResult, taskProfile);
  const recentActivityBoosts = createRecentActivityBoostMaps(safeGraph.scanResult, taskTokens);
  const normalizedTokenBudget = normalizeTokenBudget(tokenBudget);
  const rankingSeedFileLimit = Math.max(maxFiles, 3);
  const rankingSeedSymbolLimit = Math.max(maxSymbols, 6);
  const initialFileEntries = safeGraph.scanResult.files
    .map((file) => ({
      file,
      score:
        createBaseFileScore({
          file,
          taskTokens,
          testingRequested,
          intentBoosts,
          moduleBoosts: relationshipAwareModuleBoosts,
          decisionBoosts,
          policyBoosts,
          recentActivityBoosts,
        }),
    }))
    .sort(compareRankedFileEntries);
  const seedFiles = selectRankedEntries(initialFileEntries, rankingSeedFileLimit);
  const seedSymbolEntries = seedFiles
    .flatMap(({ file }) =>
      file.symbols.map((symbol) => ({
        ...symbol,
        file: file.relativePath,
        score: createBaseSymbolScore({
          symbol,
          file,
          taskTokens,
          testingRequested,
          intentBoosts,
          moduleBoosts: relationshipAwareModuleBoosts,
          decisionBoosts,
          policyBoosts,
          recentActivityBoosts,
        }),
      })),
    )
    .sort(compareRankedSymbolEntries)
    .slice(0, rankingSeedSymbolLimit);
  const graphBoosts = createGraphBoostMaps(safeGraph, seedSymbolEntries, seedFiles, {
    testingRequested,
  });
  const scoredFiles = safeGraph.scanResult.files
    .map((file) => ({
      file,
      score:
        createBaseFileScore({
          file,
          taskTokens,
          testingRequested,
          intentBoosts,
          moduleBoosts: relationshipAwareModuleBoosts,
          decisionBoosts,
          policyBoosts,
          recentActivityBoosts,
        }) +
        (graphBoosts.files.get(file.relativePath) ?? 0),
    }))
    .sort(compareRankedFileEntries);

  const fallbackFiles = selectRankedEntries(scoredFiles, maxFiles);
  const relevantSymbolEntries = fallbackFiles
    .flatMap(({ file }) =>
      file.symbols.map((symbol) => ({
        ...symbol,
        file: file.relativePath,
        score:
          createBaseSymbolScore({
            symbol,
            file,
            taskTokens,
            testingRequested,
            intentBoosts,
            moduleBoosts: relationshipAwareModuleBoosts,
            decisionBoosts,
            policyBoosts,
            recentActivityBoosts,
          }) +
          (graphBoosts.symbols.get(symbol.id) ?? 0),
      })),
    )
    .sort(compareRankedSymbolEntries)
    .slice(0, maxSymbols);

  const relevantFiles = fallbackFiles.filter((item) => item.score > 0);
  const selectedFiles = relevantFiles.length > 0 ? relevantFiles : fallbackFiles;

  const reuseCandidates = relevantSymbolEntries
    .filter((symbol) => symbol.exported)
    .slice(0, 5)
    .map((symbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      file: symbol.file,
      reason: `Matches task terms and already exists as reusable ${symbol.kind}.`,
    }));

  const relevantFilePaths = selectedFiles.map(({ file, score }) => ({
    path: file.relativePath,
    score,
    symbols: file.symbols.map((symbol) => symbol.name),
  }));
  const quality = buildQuality({
    taskTokens,
    relevantFiles: relevantFilePaths,
    relevantSymbols: relevantSymbolEntries,
    relevantDocuments,
    linkedModules,
    decisionTargets,
    reuseCandidates,
    policyReport,
  });
  const linkedContext = buildLinkedContext({
    linkedModules,
    moduleRelationships,
    decisionTargets,
    tokenBudget: normalizedTokenBudget,
  });
  const callPaths = collectCallPaths(safeGraph, relevantSymbolEntries);
  const graphContext = buildGraphContext(safeGraph, relevantSymbolEntries, relevantFilePaths);
  const testsToRun = collectTestsToRun(
    safeGraph,
    relevantSymbolEntries,
    relevantFilePaths,
    graphContext.related_tests,
  );
  const citations = buildCitations({
    relevantDocuments,
    relevantFiles: relevantFilePaths,
    relevantSymbols: relevantSymbolEntries,
    callPaths,
    linkedModules,
    policyReport,
  });
  const confidence = buildConfidence(quality);
  const pack = {
    schema_version: 2,
    task,
    summary: buildSummary(task, relevantFilePaths, relevantDocuments, linkedModules),
    token_budget: normalizedTokenBudget,
    relevant_files: relevantFilePaths,
    relevant_symbols: relevantSymbolEntries.map((symbol) => ({
      id: symbol.id,
      name: symbol.name,
      kind: symbol.kind,
      file: symbol.file,
      signature: compactText(symbol.signature, normalizedTokenBudget ? 96 : 160),
      score: symbol.score,
    })),
    relevant_documents: relevantDocuments.map((document) => ({
      ...document,
      summary: compactText(document.summary, normalizedTokenBudget ? 120 : 220),
    })),
    graph_context: graphContext,
    call_paths: callPaths,
    tests_to_run: testsToRun,
    related_tests: testsToRun,
    linked_context: linkedContext,
    reuse_candidates: reuseCandidates,
    policies: policyReport.violations.slice(0, 3).map((violation) => violation.message),
    risks: buildRisks(relevantFilePaths, relevantDocuments, policyReport),
    confidence,
    quality,
    citations,
    missing_context_warnings: quality.missing_context_warnings,
    open_questions: buildOpenQuestions(relevantFilePaths, relevantDocuments),
    estimated_tokens: 0,
    truncated: false,
  };

  return finalizeContextPack(pack, normalizedTokenBudget);
}

function tokenize(value) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3);
}

function scoreFile(file, taskTokens) {
  const haystack = `${file.relativePath} ${file.symbols.map((symbol) => symbol.name).join(" ")}`.toLowerCase();
  return taskTokens.reduce((score, token) => score + (haystack.includes(token) ? 3 : 0), 0);
}

function scoreSymbol(symbol, taskTokens) {
  const haystack = `${symbol.name} ${symbol.signature}`.toLowerCase();
  return taskTokens.reduce((score, token) => score + (haystack.includes(token) ? 4 : 0), 0);
}

function createBaseFileScore({
  file,
  taskTokens,
  testingRequested,
  intentBoosts,
  moduleBoosts,
  decisionBoosts,
  policyBoosts,
  recentActivityBoosts,
}) {
  return (
    scoreFile(file, taskTokens) +
    applyTestPenalty(file.relativePath, testingRequested) +
    (intentBoosts.files.get(file.relativePath) ?? 0) +
    (moduleBoosts.files.get(file.relativePath) ?? 0) +
    (decisionBoosts.files.get(file.relativePath) ?? 0) +
    (policyBoosts.files.get(file.relativePath) ?? 0) +
    (recentActivityBoosts.files.get(file.relativePath) ?? 0)
  );
}

function createBaseSymbolScore({
  symbol,
  file,
  taskTokens,
  testingRequested,
  intentBoosts,
  moduleBoosts,
  decisionBoosts,
  policyBoosts,
  recentActivityBoosts,
}) {
  return (
    scoreSymbol(symbol, taskTokens) +
    applyTestPenalty(file.relativePath, testingRequested) +
    (intentBoosts.symbols.get(symbol.id) ?? 0) +
    (moduleBoosts.symbols.get(symbol.id) ?? 0) +
    (decisionBoosts.symbols.get(symbol.id) ?? 0) +
    (policyBoosts.symbols.get(symbol.id) ?? 0) +
    (recentActivityBoosts.symbols.get(symbol.id) ?? 0)
  );
}

function buildSummary(task, relevantFiles, relevantDocuments, linkedModules) {
  if (relevantFiles.length === 0 && relevantDocuments.length === 0) {
    return `No strong code matches found for "${task}". Start with project overview and architecture constraints.`;
  }

  return `Compiled a focused context pack for "${task}" from ${relevantFiles.length} relevant source files, ${relevantDocuments.length} relevant documents, and ${linkedModules.length} linked modules.`;
}

function buildRisks(relevantFiles, relevantDocuments, policyReport) {
  const risks = [];

  if (relevantFiles.length === 0 && relevantDocuments.length === 0) {
    risks.push("No strong source or document match found; adding new work may duplicate an existing idea outside the indexed slice.");
  }

  if (relevantFiles.length > 0 && relevantDocuments.length === 0) {
    risks.push("Code matches were found without supporting product or architecture docs; verify requirements and design intent before implementation.");
  }

  if (policyReport.violations.length > 0) {
    risks.push("Policy violations already exist in the scanned scope; check architecture boundaries before extending code.");
  }

  if (risks.length === 0) {
    risks.push("No immediate structural risk surfaced from the lightweight compiler; verify deeper domain behavior before shipping.");
  }

  return risks;
}

function buildOpenQuestions(relevantFiles, relevantDocuments) {
  if (relevantFiles.length === 0 && relevantDocuments.length === 0) {
    return ["Which package and which project document should own this task if neither code nor docs clearly match it?"];
  }

  if (relevantDocuments.length === 0) {
    return ["Which business, requirements, or technical document should be added so the heart can preserve intent for this area?"];
  }

  return ["Are there domain or policy constraints outside the indexed files that should shape the implementation?"];
}

function createModuleBoostMap(linkedModules, documentInfluenceByPath = new Map(), options = {}) {
  const files = new Map();
  const symbols = new Map();
  const linkScale = options.policyFocused ? 0.4 : 1;

  for (const module of linkedModules) {
    const supportingBoost = Math.max(
      0,
      ...(module.supporting_documents ?? []).map((documentPath) => documentInfluenceByPath.get(documentPath) ?? 0),
    );
    for (const filePath of module.file_paths ?? []) {
      files.set(
        filePath,
        Math.max(files.get(filePath) ?? 0, roundSignal((module.score * 4 + supportingBoost) * linkScale)),
      );
    }
  }

  return { files, symbols };
}

function createModuleRelationshipBoostMap(moduleRelationships, documentInfluenceByPath = new Map(), options = {}) {
  const files = new Map();
  const symbols = new Map();
  const linkScale = options.policyFocused ? 0.35 : options.boundaryFocused ? 1.1 : 0.7;

  for (const relationship of moduleRelationships) {
    const supportingBoost = Math.max(
      0,
      ...(relationship.supporting_documents ?? []).map(
        (documentPath) => documentInfluenceByPath.get(documentPath) ?? 0,
      ),
    );
    const provenanceBoost = relationship.provenance === "EXTRACTED" ? 3 : 2;
    const baseBoost = roundSignal((relationship.score * provenanceBoost + supportingBoost) * linkScale);

    for (const filePath of relationship.target_file_paths ?? []) {
      files.set(filePath, Math.max(files.get(filePath) ?? 0, baseBoost));
    }

    const symbolBoost = roundSignal(baseBoost * 0.7);
    for (const symbolId of relationship.target_symbol_ids ?? []) {
      symbols.set(symbolId, Math.max(symbols.get(symbolId) ?? 0, symbolBoost));
    }
  }

  return { files, symbols };
}

function mergeBoostMaps(...boostMaps) {
  const files = new Map();
  const symbols = new Map();

  for (const boostMap of boostMaps) {
    for (const [filePath, score] of boostMap.files ?? []) {
      files.set(filePath, Math.max(files.get(filePath) ?? 0, score));
    }
    for (const [symbolId, score] of boostMap.symbols ?? []) {
      symbols.set(symbolId, Math.max(symbols.get(symbolId) ?? 0, score));
    }
  }

  return { files, symbols };
}

function createDecisionBoostMaps(decisionTargets, documentInfluenceByPath = new Map(), options = {}) {
  const files = new Map();
  const symbols = new Map();
  const linkScale = options.policyFocused ? 0.4 : 1;

  for (const target of decisionTargets) {
    const supportingBoost = documentInfluenceByPath.get(target.supporting_document) ?? 0;
    if (target.target_type === "file") {
      files.set(
        target.file_path,
        Math.max(files.get(target.file_path) ?? 0, roundSignal((target.score * 5 + supportingBoost) * linkScale)),
      );
      continue;
    }

    symbols.set(
      target.target_id,
      Math.max(symbols.get(target.target_id) ?? 0, roundSignal((target.score * 5 + supportingBoost) * linkScale)),
    );
    files.set(
      target.file_path,
      Math.max(files.get(target.file_path) ?? 0, roundSignal((target.score * 2 + supportingBoost) * linkScale)),
    );
  }

  return { files, symbols };
}

function createGraphBoostMaps(graph, seedSymbols, seedFiles, { testingRequested = false } = {}) {
  const neighborhood = collectGraphNeighborhood(
    graph,
    seedSymbols,
    seedFiles.map(({ file, score }) => ({
      path: file.relativePath,
      score,
      symbols: file.symbols.map((symbol) => symbol.name),
    })),
  );
  const files = new Map();
  const symbols = new Map();

  for (const file of neighborhood.relatedFiles.values()) {
    files.set(file.path, scoreRelationTypes(file.relation_types, FILE_RELATION_WEIGHTS));
  }

  for (const symbol of neighborhood.relatedSymbols.values()) {
    symbols.set(symbol.id, scoreRelationTypes(symbol.relation_types, SYMBOL_RELATION_WEIGHTS));
  }

  for (const testPath of neighborhood.relatedTests) {
    files.set(testPath, Math.max(files.get(testPath) ?? 0, testingRequested ? 3 : 1));
  }

  return { files, symbols };
}

function createPolicyBoostMaps(scanResult, policyReport = { violations: [] }, taskTokens = []) {
  const files = new Map();
  const symbols = new Map();
  const policyFocused = taskMentionsPolicy(taskTokens);
  const baseBoost = policyFocused ? 8 : 1;
  const filesByPath = new Map((scanResult.files ?? []).map((file) => [file.relativePath, file]));

  for (const violation of policyReport.violations ?? []) {
    if (!violation.file) {
      continue;
    }

    const overlapBonus = countPathTokenOverlap(violation.file, taskTokens) * 0.5;
    const fileBoost = roundSignal(baseBoost + overlapBonus);
    files.set(violation.file, Math.max(files.get(violation.file) ?? 0, fileBoost));

    for (const symbol of filesByPath.get(violation.file)?.symbols ?? []) {
      symbols.set(symbol.id, Math.max(symbols.get(symbol.id) ?? 0, roundSignal(fileBoost * 0.75)));
    }

    if (!policyFocused || !violation.resolved_path) {
      continue;
    }

    const neighborBoost = roundSignal(Math.max(1, fileBoost * 0.2));
    files.set(violation.resolved_path, Math.max(files.get(violation.resolved_path) ?? 0, neighborBoost));
    for (const symbol of filesByPath.get(violation.resolved_path)?.symbols ?? []) {
      symbols.set(symbol.id, Math.max(symbols.get(symbol.id) ?? 0, roundSignal(neighborBoost * 0.5)));
    }
  }

  return { files, symbols };
}

function createRecentActivityBoostMaps(scanResult, taskTokens = []) {
  const files = new Map();
  const symbols = new Map();
  const recencyFocused = taskMentionsRecentActivity(taskTokens);
  const mtimes = (scanResult.files ?? [])
    .map((file) => file.file_stats?.mtime_ms)
    .filter((value) => Number.isFinite(value));
  const recencyRange = createNumericRange(mtimes);

  for (const file of scanResult.files ?? []) {
    const normalized = normalizeInRange(file.file_stats?.mtime_ms, recencyRange);
    if (normalized <= 0) {
      continue;
    }

    const fileBoost = roundSignal(normalized * (recencyFocused ? 4 : 1));
    files.set(file.relativePath, fileBoost);

    for (const symbol of file.symbols ?? []) {
      symbols.set(symbol.id, roundSignal(fileBoost * 0.75));
    }
  }

  return { files, symbols };
}

function createTaskIntentProfile(taskTokens = []) {
  const uniqueTokens = dedupe(taskTokens);
  const ownerKeywords = uniqueTokens.filter((token) => OWNERSHIP_DOMAIN_TOKENS.has(token));
  const surfaceKeywords = new Set(ownerKeywords.filter((token) => SURFACE_OWNER_TOKENS.has(token)));
  const uiFocused = uniqueTokens.some((token) => UI_INTENT_TOKENS.has(token));
  const coreFocused = uniqueTokens.some((token) => CORE_INTENT_TOKENS.has(token));
  const boundaryFocused = uniqueTokens.some((token) =>
    ["architecture", "boundary", "boundaries", "governance", "ownership", "reuse"].includes(token),
  );

  return {
    uiFocused,
    coreFocused,
    boundaryFocused,
    preferCoreOwnership: coreFocused && !uiFocused,
    ownerKeywords,
    surfaceKeywords,
  };
}

function createIntentBoostMaps(scanResult, taskProfile) {
  const files = new Map();
  const symbols = new Map();

  for (const file of scanResult.files ?? []) {
    const fileBoost = scoreFileIntentAlignment(file.relativePath, taskProfile);
    if (fileBoost !== 0) {
      files.set(file.relativePath, fileBoost);
    }

    const symbolBoost = roundSignal(fileBoost * 0.7);
    if (symbolBoost === 0) {
      continue;
    }

    for (const symbol of file.symbols ?? []) {
      symbols.set(symbol.id, symbolBoost);
    }
  }

  return { files, symbols };
}

function scoreFileIntentAlignment(filePath, taskProfile = {}) {
  const layer = classifyPathLayer(filePath);
  const ownerSegment = extractOwnerSegment(filePath, layer);
  const pathTokens = tokenize(filePath.replaceAll("/", " "));
  const ownerMatchCount = taskProfile.ownerKeywords.filter(
    (token) => token === ownerSegment || pathTokens.includes(token),
  ).length;
  const surfaceMatched = taskProfile.surfaceKeywords.has(ownerSegment);
  let boost = 0;

  if (taskProfile.preferCoreOwnership) {
    if (layer === "package") {
      boost += 7;
    } else if (layer === "service") {
      boost += 5;
    } else if (layer === "app") {
      boost -= surfaceMatched ? 1 : 5;
    }
  } else if (taskProfile.uiFocused) {
    if (layer === "app") {
      boost += 7;
    } else if (layer === "package") {
      boost -= 2;
    }
  }

  if (ownerMatchCount > 0) {
    if (layer === "package") {
      boost += 10 + ownerMatchCount * 2;
    } else if (layer === "service") {
      boost += 8 + ownerMatchCount * 2;
    } else if (layer === "app") {
      boost += (surfaceMatched || taskProfile.uiFocused ? 7 : 2) + ownerMatchCount;
    } else {
      boost += 3 + ownerMatchCount;
    }
  }

  if (taskProfile.boundaryFocused) {
    if (layer === "package" || layer === "service") {
      boost += ownerMatchCount > 0 ? 4 : 2;
    } else if (layer === "app" && !surfaceMatched) {
      boost -= 1;
    }
  }

  return roundSignal(boost);
}

function classifyPathLayer(filePath = "") {
  const normalized = String(filePath).replace(/\\/g, "/");
  if (normalized.startsWith("packages/")) {
    return "package";
  }
  if (normalized.startsWith("services/")) {
    return "service";
  }
  if (normalized.startsWith("apps/")) {
    return "app";
  }
  if (normalized.startsWith("tests/") || isTestPath(normalized)) {
    return "test";
  }
  return "other";
}

function extractOwnerSegment(filePath = "", layer = "other") {
  const segments = String(filePath).replace(/\\/g, "/").split("/");
  if (["package", "service", "app"].includes(layer)) {
    return segments[1] ?? "";
  }
  return segments[0] ?? "";
}

function rankRelevantDocuments(documentIndex, task, taskTokens, limit = 4) {
  const matchedDocuments = findRelevantDocuments(documentIndex, task, Math.max(limit * 2, limit));
  const documentsByPath = new Map((documentIndex.documents ?? []).map((document) => [document.path, document]));
  const documentMtimes = (documentIndex.documents ?? [])
    .map((document) => document.document_stats?.mtime_ms)
    .filter((value) => Number.isFinite(value));
  const recencyRange = createNumericRange(documentMtimes);
  const documentFocused = taskMentionsDocumentContext(taskTokens);
  const recencyFocused = taskMentionsRecentActivity(taskTokens);

  return matchedDocuments
    .map((document) => {
      const sourceDocument = documentsByPath.get(document.path) ?? document;
      const categoryBoost = DOCUMENT_CATEGORY_WEIGHTS[sourceDocument.category] ?? DOCUMENT_CATEGORY_WEIGHTS.general;
      const focusBoost = documentFocused ? roundSignal(categoryBoost * 0.75) : 0;
      const recencyBoost = recencyFocused
        ? roundSignal(normalizeInRange(sourceDocument.document_stats?.mtime_ms, recencyRange) * 2)
        : 0;

      return {
        ...document,
        score: roundSignal(document.score + categoryBoost + focusBoost + recencyBoost),
      };
    })
    .sort(compareRankedDocuments)
    .slice(0, limit);
}

function createDocumentInfluenceMap(relevantDocuments, documentIndex, taskTokens = []) {
  const documentsByPath = new Map((documentIndex.documents ?? []).map((document) => [document.path, document]));
  const documentMtimes = (documentIndex.documents ?? [])
    .map((document) => document.document_stats?.mtime_ms)
    .filter((value) => Number.isFinite(value));
  const recencyRange = createNumericRange(documentMtimes);
  const recencyFocused = taskMentionsRecentActivity(taskTokens);
  const influences = new Map();

  for (const document of relevantDocuments) {
    const sourceDocument = documentsByPath.get(document.path) ?? document;
    const categoryBoost = DOCUMENT_CATEGORY_WEIGHTS[sourceDocument.category] ?? DOCUMENT_CATEGORY_WEIGHTS.general;
    const recencyBoost = recencyFocused
      ? roundSignal(normalizeInRange(sourceDocument.document_stats?.mtime_ms, recencyRange) * 2)
      : 0;
    influences.set(document.path, roundSignal(document.score + categoryBoost + recencyBoost));
  }

  return influences;
}

function buildQuality({
  taskTokens,
  relevantFiles,
  relevantSymbols,
  relevantDocuments,
  linkedModules,
  decisionTargets,
  reuseCandidates,
  policyReport,
}) {
  const matchedTokens = collectMatchedTaskTokens({
    taskTokens,
    relevantFiles,
    relevantSymbols,
    relevantDocuments,
    linkedModules,
  });
  const coverageRatio = taskTokens.length === 0 ? 1 : matchedTokens.size / taskTokens.length;
  const relevanceScore = clampScore(
    coverageRatio * 0.6 +
      Math.min(relevantFiles.length, 3) / 3 * 0.15 +
      Math.min(relevantDocuments.length, 2) / 2 * 0.15 +
      Math.min(linkedModules.length, 2) / 2 * 0.1,
  );
  const reuseSignals = relevantDocuments.some((document) =>
    /reuse|existing|current|anchor/i.test(`${document.title} ${document.summary}`),
  );
  const reuseConfidence = clampScore(
    Math.min(reuseCandidates.length, 3) / 3 * 0.45 +
      Math.min(decisionTargets.filter((target) => target.target_type === "symbol").length, 2) / 2 * 0.2 +
      (reuseSignals ? 0.2 : 0) +
      (linkedModules.length > 0 ? 0.15 : 0),
  );
  const policyPenalty = Math.min(policyReport.violations.length, 3) * 0.15;
  const architectureConfidence = clampScore(
    0.2 +
      (relevantDocuments.length > 0 ? 0.2 : 0) +
      (linkedModules.length > 0 ? 0.2 : 0) +
      (decisionTargets.length > 0 ? 0.15 : 0) +
      (policyPenalty === 0 ? 0.25 : 0) -
      policyPenalty,
  );
  const missingContextWarnings = [];

  if (relevantDocuments.length === 0) {
    missingContextWarnings.push("No relevant requirements or design document was found for this task.");
  }

  if (linkedModules.length === 0) {
    missingContextWarnings.push("No document-to-module links were available for the matched documents.");
  }

  if (decisionTargets.length === 0) {
    missingContextWarnings.push("No decision-to-implementation link was found, so implementation ownership may still be ambiguous.");
  }

  if (reuseCandidates.length === 0) {
    missingContextWarnings.push("No strong reuse candidate surfaced from the current linked context.");
  }

  if (policyReport.violations.length > 0) {
    missingContextWarnings.push("Existing policy violations reduce architecture confidence for this pack.");
  }

  return {
    relevance_score: relevanceScore,
    reuse_confidence: reuseConfidence,
    architecture_confidence: architectureConfidence,
    missing_context_warnings: missingContextWarnings,
  };
}

function buildConfidence(quality) {
  const overall = clampScore(
    (quality.relevance_score + quality.reuse_confidence + quality.architecture_confidence) / 3,
  );

  return {
    overall,
    relevance: quality.relevance_score,
    reuse: quality.reuse_confidence,
    architecture: quality.architecture_confidence,
  };
}

function collectCallPaths(graph, relevantSymbols, limit = 6) {
  const relevantSymbolIds = expandRelevantSymbolIds(graph, relevantSymbols);
  const edges = graph.edges ?? [];

  return edges
    .filter(
      (edge) =>
        edge.type === EDGE_TYPES.calls &&
        (relevantSymbolIds.has(edge.from) || relevantSymbolIds.has(edge.to)),
    )
    .map((edge) => {
      const fromNode = findGraphNode(graph, edge.from);
      const toNode = findGraphNode(graph, edge.to);
      if (!fromNode || !toNode) {
        return null;
      }

      return {
        from: fromNode.name,
        to: toNode.name,
        from_file: fromNode.path,
        to_file: toNode.path,
        evidence: EDGE_TYPES.calls,
      };
    })
    .filter(Boolean)
    .sort(compareSerializedEntries)
    .slice(0, limit);
}

function collectTestsToRun(graph, relevantSymbols, relevantFiles, seedTests = [], limit = 6) {
  const neighborhood = collectGraphNeighborhood(graph, relevantSymbols, relevantFiles);
  const relevantSymbolIds = new Set([
    ...neighborhood.expandedSymbolIds,
    ...neighborhood.relatedSymbolIds,
  ]);
  const relevantFileIds = new Set([
    ...relevantFiles.map((file) => `file:${file.path}`),
    ...[...neighborhood.relatedFilePaths].map((filePath) => `file:${filePath}`),
  ]);
  const tests = new Set(seedTests);
  const edges = graph.edges ?? [];

  for (const edge of edges) {
    if (edge.type !== EDGE_TYPES.testedBy) {
      continue;
    }

    if (!relevantSymbolIds.has(edge.from) && !relevantFileIds.has(edge.from)) {
      continue;
    }

    const testNode = findGraphNode(graph, edge.to);
    if (testNode?.path) {
      tests.add(testNode.path);
    }
  }

  return [...tests].sort().slice(0, limit);
}

function buildGraphContext(graph, relevantSymbols, relevantFiles, limits = {}) {
  const neighborhood = collectGraphNeighborhood(graph, relevantSymbols, relevantFiles);

  return {
    related_files: [...neighborhood.relatedFiles.values()]
      .sort(compareSerializedEntries)
      .slice(0, limits.maxFiles ?? 5),
    related_symbols: [...neighborhood.relatedSymbols.values()]
      .sort(compareSerializedEntries)
      .slice(0, limits.maxSymbols ?? 8),
    related_tests: [...neighborhood.relatedTests].sort().slice(0, limits.maxTests ?? 6),
  };
}

function buildCitations({
  relevantDocuments,
  relevantFiles,
  relevantSymbols,
  callPaths,
  linkedModules,
  policyReport,
}) {
  const citations = [];

  citations.push(
    ...relevantDocuments.slice(0, 3).map((document) => ({
      type: "document",
      path: document.path,
      title: document.title,
      score: document.score,
      reason: "Matched task terms in project documents.",
    })),
  );
  citations.push(
    ...callPaths.slice(0, 2).map((callPath) => ({
      type: "graph",
      relation: EDGE_TYPES.calls,
      from: callPath.from,
      to: callPath.to,
      from_file: callPath.from_file,
      to_file: callPath.to_file,
      reason: "Typed call graph evidence near ranked symbols.",
    })),
  );
  citations.push(
    ...relevantFiles.filter((file) => file.score > 0).slice(0, 3).map((file) => ({
      type: "file",
      path: file.path,
      score: file.score,
      reason: "Ranked as a top implementation file.",
    })),
  );
  citations.push(
    ...relevantSymbols.filter((symbol) => symbol.score > 0).slice(0, 4).map((symbol) => ({
      type: "symbol",
      id: symbol.id,
      path: symbol.file,
      name: symbol.name,
      reason: "Ranked as a relevant implementation symbol.",
    })),
  );
  citations.push(
    ...linkedModules.slice(0, 2).map((module) => ({
      type: "linked_module",
      module: module.module,
      reason: "Document-to-module linking boosted retrieval.",
    })),
  );

  if (policyReport.violations.length > 0) {
    const violation = policyReport.violations[0];
    citations.push({
      type: "policy",
      rule_id: violation.rule_id,
      path: violation.file,
      reason: "Existing policy evidence affects architecture confidence.",
    });
  }

  return normalizeCitations(citations);
}

function normalizeTokenBudget(tokenBudget) {
  const normalized = Number(tokenBudget);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function finalizeContextPack(pack, tokenBudget) {
  const basePack = refreshContextPackEvidence(
    compactContextPack({
      ...pack,
      estimated_tokens: 0,
      truncated: false,
    }),
  );
  const boundedPack = tokenBudget ? applyTokenBudget(basePack, tokenBudget) : basePack;
  const finalizedPack = refreshContextPackEvidence(boundedPack);

  return {
    ...finalizedPack,
    estimated_tokens: estimateContextPackTokens(finalizedPack),
  };
}

function applyTokenBudget(pack, tokenBudget) {
  const candidate = refreshContextPackEvidence(cloneContextPack(pack));
  let estimatedTokens = estimateContextPackTokens(candidate);

  if (estimatedTokens <= tokenBudget) {
    return candidate;
  }

  let truncated = false;
  const droppableCollections = [
    createArrayTrimmer(candidate, "open_questions", 0),
    createArrayTrimmer(candidate, "risks", 0),
    createArrayTrimmer(candidate, "policies", 0),
    createNestedArrayTrimmer(candidate, ["linked_context", "implementation_targets"], 0),
    createNestedArrayTrimmer(candidate, ["linked_context", "relationships"], 0),
    createNestedArrayTrimmer(candidate, ["linked_context", "modules"], candidate.linked_context.modules.length > 0 ? 1 : 0),
    createArrayTrimmer(candidate, "reuse_candidates", candidate.reuse_candidates.length > 0 ? 1 : 0),
    createArrayTrimmer(candidate, "missing_context_warnings", 0),
    createNestedArrayTrimmer(candidate, ["quality", "missing_context_warnings"], 0),
    createArrayTrimmer(candidate, "relevant_documents", candidate.relevant_documents.length > 0 ? 1 : 0),
    createNestedArrayTrimmer(
      candidate,
      ["graph_context", "related_symbols"],
      candidate.graph_context.related_symbols.length > 0 ? 1 : 0,
    ),
    createNestedArrayTrimmer(
      candidate,
      ["graph_context", "related_files"],
      candidate.graph_context.related_files.length > 0 ? 1 : 0,
    ),
    createNestedArrayTrimmer(
      candidate,
      ["graph_context", "related_tests"],
      candidate.graph_context.related_tests.length > 0 ? 1 : 0,
    ),
    createArrayTrimmer(candidate, "citations", candidate.citations.length > 0 ? 1 : 0),
    createArrayTrimmer(candidate, "call_paths", candidate.call_paths.length > 0 ? 1 : 0),
    createArrayTrimmer(candidate, "tests_to_run", candidate.tests_to_run.length > 0 ? 1 : 0),
    createArrayTrimmer(candidate, "related_tests", candidate.related_tests.length > 0 ? 1 : 0),
    createArrayTrimmer(candidate, "relevant_symbols", candidate.relevant_symbols.length > 0 ? 1 : 0),
    createArrayTrimmer(candidate, "relevant_files", candidate.relevant_files.length > 0 ? 1 : 0),
  ];

  while (estimatedTokens > tokenBudget) {
    const nextTrimmer = droppableCollections.find((trimmer) => trimmer.length() > trimmer.min);
    if (!nextTrimmer) {
      break;
    }

    nextTrimmer.trim();
    truncated = true;
    refreshContextPackEvidence(candidate);
    estimatedTokens = estimateContextPackTokens(candidate);
  }

  if (estimatedTokens > tokenBudget) {
    candidate.summary = buildCompactSummary(candidate);
    refreshContextPackEvidence(candidate);
    estimatedTokens = estimateContextPackTokens(candidate);
  }

  if (estimatedTokens > tokenBudget && candidate.summary.length > 96) {
    candidate.summary = compactText(candidate.summary, 96);
    truncated = true;
    refreshContextPackEvidence(candidate);
    estimatedTokens = estimateContextPackTokens(candidate);
  }

  if (estimatedTokens > tokenBudget) {
    candidate.relevant_files = candidate.relevant_files.map((file) => ({
      path: file.path,
    }));
    candidate.relevant_symbols = candidate.relevant_symbols.map((symbol) => ({
      id: symbol.id,
      name: symbol.name,
      kind: symbol.kind,
      file: symbol.file,
    }));
    candidate.relevant_documents = candidate.relevant_documents.map((document) => ({
      path: document.path,
      category: document.category,
      title: document.title,
    }));
    candidate.confidence = {
      overall: candidate.confidence.overall,
    };
    candidate.quality = {
      relevance_score: candidate.quality.relevance_score,
      reuse_confidence: candidate.quality.reuse_confidence,
      architecture_confidence: candidate.quality.architecture_confidence,
    };
    truncated = true;
    refreshContextPackEvidence(candidate);
    estimatedTokens = estimateContextPackTokens(candidate);
  }

  candidate.truncated = truncated;
  return refreshContextPackEvidence(candidate);
}

function refreshContextPackEvidence(pack) {
  pack.citations = normalizeCitations(pack.citations ?? []);
  const estimatedTokens = Math.max(
    numberOrZero(pack.estimated_tokens),
    estimateContextPackTokens({
      ...pack,
      evidence_summary: undefined,
      estimated_tokens: undefined,
    }),
  );
  pack.evidence_summary = createEvidenceSummary(pack, estimatedTokens);
  return pack;
}

function createEvidenceSummary(pack, estimatedTokens) {
  const taskTokens = tokenize(pack.task ?? "");
  const matchedTokens = collectMatchedTaskTokens({
    taskTokens,
    relevantFiles: pack.relevant_files ?? [],
    relevantSymbols: pack.relevant_symbols ?? [],
    relevantDocuments: pack.relevant_documents ?? [],
    linkedModules: pack.linked_context?.modules ?? [],
  });
  const matchedTaskTokenPct =
    taskTokens.length === 0 ? 100 : Math.round((matchedTokens.size / taskTokens.length) * 100);
  const citationTypeCounts = countCitationTypes(pack.citations ?? []);
  const coverageScore = clampScore(
    matchedTaskTokenPct / 100 * 0.45 +
      Math.min(pack.citations.length, 4) / 4 * 0.2 +
      Math.min(pack.call_paths.length, 3) / 3 * 0.15 +
      Math.min(pack.tests_to_run.length, 2) / 2 * 0.1 +
      Math.min(pack.relevant_documents.length, 2) / 2 * 0.1,
  );
  const compactnessScore = clampScore(
    pack.token_budget
      ? Math.min(1, numberOrZero(pack.token_budget) / Math.max(estimatedTokens, numberOrZero(pack.token_budget), 1))
      : Math.max(0.35, 1 - Math.max(0, estimatedTokens - 1200) / 1800),
  );
  const overallEvidenceScore = clampScore(
    coverageScore * 0.45 +
      compactnessScore * 0.2 +
      numberOrZero(pack.confidence?.overall) * 0.2 +
      Math.min(pack.citations.length, 4) / 4 * 0.15,
  );

  return {
    matched_task_token_count: matchedTokens.size,
    matched_task_token_pct: matchedTaskTokenPct,
    citation_count: pack.citations.length,
    graph_citation_count: citationTypeCounts.graph,
    document_citation_count: citationTypeCounts.document,
    policy_citation_count: citationTypeCounts.policy,
    call_path_count: pack.call_paths.length,
    tests_to_run_count: pack.tests_to_run.length,
    relevant_file_count: pack.relevant_files.length,
    relevant_symbol_count: pack.relevant_symbols.length,
    relevant_document_count: pack.relevant_documents.length,
    missing_context_warning_count: pack.missing_context_warnings.length,
    coverage_score: coverageScore,
    compactness_score: compactnessScore,
    overall_evidence_score: overallEvidenceScore,
  };
}

function countCitationTypes(citations = []) {
  return citations.reduce(
    (counts, citation) => {
      counts[citation.type] = (counts[citation.type] ?? 0) + 1;
      return counts;
    },
    {
      document: 0,
      graph: 0,
      policy: 0,
    },
  );
}

function normalizeCitations(citations = []) {
  return prioritizeEvidenceCitations(
    dedupeByKey(
      citations.filter(isMeaningfulCitation).map((citation) => stripUndefinedFields(citation)),
      createCitationKey,
    ),
  ).map((citation, index) => ({
    ...citation,
    evidence_rank: index + 1,
  }));
}

function isMeaningfulCitation(citation = {}) {
  switch (citation.type) {
    case "document":
      return Boolean(citation.path || citation.title);
    case "graph":
      return Boolean(citation.from && citation.to);
    case "file":
      return Boolean(citation.path);
    case "symbol":
      return Boolean(citation.id || (citation.path && citation.name));
    case "linked_module":
      return Boolean(citation.module);
    case "policy":
      return Boolean(citation.rule_id || citation.path);
    default:
      return Object.keys(citation).length > 0;
  }
}

function createCitationKey(citation = {}) {
  switch (citation.type) {
    case "document":
      return `${citation.type}:${citation.path ?? citation.title}`;
    case "graph":
      return `${citation.type}:${citation.relation ?? ""}:${citation.from ?? ""}:${citation.to ?? ""}:${citation.from_file ?? ""}:${citation.to_file ?? ""}`;
    case "file":
      return `${citation.type}:${citation.path ?? ""}`;
    case "symbol":
      return `${citation.type}:${citation.id ?? ""}:${citation.path ?? ""}:${citation.name ?? ""}`;
    case "linked_module":
      return `${citation.type}:${citation.module ?? ""}`;
    case "policy":
      return `${citation.type}:${citation.rule_id ?? ""}:${citation.path ?? ""}`;
    default:
      return JSON.stringify(citation);
  }
}

function stripUndefinedFields(entry = {}) {
  return Object.fromEntries(
    Object.entries(entry).filter(([key, value]) => value !== undefined && key !== "evidence_rank"),
  );
}

function cloneContextPack(pack) {
  return {
    ...pack,
    relevant_files: [...pack.relevant_files],
    relevant_symbols: [...pack.relevant_symbols],
    relevant_documents: [...pack.relevant_documents],
    graph_context: {
      related_files: pack.graph_context.related_files.map((entry) => ({
        ...entry,
        relation_types: [...(entry.relation_types ?? [])],
      })),
      related_symbols: pack.graph_context.related_symbols.map((entry) => ({
        ...entry,
        relation_types: [...(entry.relation_types ?? [])],
      })),
      related_tests: [...pack.graph_context.related_tests],
    },
    call_paths: [...pack.call_paths],
    tests_to_run: [...pack.tests_to_run],
    related_tests: [...pack.related_tests],
    linked_context: {
      modules: [...pack.linked_context.modules],
      relationships: pack.linked_context.relationships.map((relationship) => ({
        ...relationship,
        relationship_kinds: [...(relationship.relationship_kinds ?? [])],
        supporting_documents: [...(relationship.supporting_documents ?? [])],
        target_file_paths: [...(relationship.target_file_paths ?? [])],
        target_symbol_ids: [...(relationship.target_symbol_ids ?? [])],
        target_symbol_names: [...(relationship.target_symbol_names ?? [])],
      })),
      implementation_targets: [...pack.linked_context.implementation_targets],
    },
    reuse_candidates: [...pack.reuse_candidates],
    policies: [...pack.policies],
    risks: [...pack.risks],
    confidence: { ...pack.confidence },
    quality: {
      ...pack.quality,
      missing_context_warnings: [...pack.quality.missing_context_warnings],
    },
    citations: [...pack.citations],
    missing_context_warnings: [...pack.missing_context_warnings],
    open_questions: [...pack.open_questions],
  };
}

function createArrayTrimmer(target, key, min) {
  return {
    min,
    length: () => target[key].length,
    trim: () => {
      target[key] = target[key].slice(0, -1);
    },
  };
}

function createNestedArrayTrimmer(target, [outerKey, innerKey], min) {
  return {
    min,
    length: () => target[outerKey][innerKey].length,
    trim: () => {
      target[outerKey] = {
        ...target[outerKey],
        [innerKey]: target[outerKey][innerKey].slice(0, -1),
      };
    },
  };
}

function estimateContextPackTokens(pack) {
  const payload = {
    ...pack,
    estimated_tokens: undefined,
  };

  return Math.max(1, Math.ceil(JSON.stringify(payload).length / 4));
}

function findGraphNode(graph, nodeId) {
  return (graph.nodes ?? []).find((node) => node.id === nodeId) ?? null;
}

function expandRelevantSymbolIds(graph, relevantSymbols) {
  const expanded = new Set(relevantSymbols.map((symbol) => symbol.id));

  for (const symbol of relevantSymbols) {
    const fileEntry = graph.scanResult.files.find((file) => file.relativePath === symbol.file);
    if (!fileEntry) {
      continue;
    }

    const queue = [symbol.name];
    const seenContainers = new Set(queue);

    while (queue.length > 0) {
      const containerName = queue.shift();

      for (const candidate of fileEntry.symbols) {
        if (candidate.container !== containerName) {
          continue;
        }

        expanded.add(candidate.id);
        if (!seenContainers.has(candidate.name)) {
          seenContainers.add(candidate.name);
          queue.push(candidate.name);
        }
      }
    }
  }

  return expanded;
}

function collectGraphNeighborhood(graph, relevantSymbols, relevantFiles) {
  const expandedSymbolIds = expandRelevantSymbolIds(graph, relevantSymbols);
  const relevantFilePaths = new Set(relevantFiles.map((file) => file.path));
  const relatedFiles = new Map();
  const relatedSymbols = new Map();
  const relatedTests = new Set();
  const relatedSymbolIds = new Set();
  const relatedFilePaths = new Set();

  for (const edge of graph.edges ?? []) {
    if ([EDGE_TYPES.calls, EDGE_TYPES.extends, EDGE_TYPES.implements].includes(edge.type)) {
      if (expandedSymbolIds.has(edge.from)) {
        const targetNode = findGraphNode(graph, edge.to);
        if (targetNode) {
          relatedSymbolIds.add(targetNode.id);
          addRelatedSymbol(relatedSymbols, targetNode, edge.type);
          addRelatedFile(relatedFiles, targetNode.path, edge.type, relatedFilePaths);
        }
      }

      if (expandedSymbolIds.has(edge.to)) {
        const sourceNode = findGraphNode(graph, edge.from);
        if (sourceNode) {
          relatedSymbolIds.add(sourceNode.id);
          addRelatedSymbol(relatedSymbols, sourceNode, edge.type);
          addRelatedFile(relatedFiles, sourceNode.path, edge.type, relatedFilePaths);
        }
      }

      continue;
    }

    if (edge.type === EDGE_TYPES.imports) {
      const fromPath = edge.from.replace(/^file:/, "");
      const toPath = edge.to.replace(/^file:/, "");

      if (relevantFilePaths.has(fromPath)) {
        addRelatedFile(relatedFiles, toPath, edge.type, relatedFilePaths);
      }

      if (relevantFilePaths.has(toPath)) {
        addRelatedFile(relatedFiles, fromPath, edge.type, relatedFilePaths);
      }
    }
  }

  for (const edge of graph.edges ?? []) {
    if (edge.type !== EDGE_TYPES.testedBy) {
      continue;
    }

    const fromFilePath = edge.from.replace(/^file:/, "");
    if (
      expandedSymbolIds.has(edge.from) ||
      relevantFilePaths.has(fromFilePath) ||
      relatedSymbolIds.has(edge.from) ||
      relatedFilePaths.has(fromFilePath)
    ) {
      const testNode = findGraphNode(graph, edge.to);
      if (testNode?.path) {
        relatedTests.add(testNode.path);
      }
    }
  }

  return {
    expandedSymbolIds,
    relatedFiles,
    relatedSymbols,
    relatedTests,
    relatedSymbolIds,
    relatedFilePaths,
  };
}

function compareSerializedEntries(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function compareRankedFileEntries(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.file.relativePath.localeCompare(right.file.relativePath);
}

function compareRankedSymbolEntries(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.file !== right.file) {
    return left.file.localeCompare(right.file);
  }

  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  return left.id.localeCompare(right.id);
}

function compareRankedDocuments(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.path.localeCompare(right.path);
}

function selectRankedEntries(entries, maxEntries) {
  const positiveEntries = entries.filter((entry) => entry.score > 0).slice(0, maxEntries);
  return positiveEntries.length > 0 ? positiveEntries : entries.slice(0, maxEntries);
}

function scoreRelationTypes(relationTypes = [], weights = {}) {
  return relationTypes.reduce((score, relationType) => score + (weights[relationType] ?? 0), 0);
}

function taskMentionsPolicy(taskTokens) {
  return taskTokens.some((token) =>
    [
      "policy",
      "policies",
      "boundary",
      "boundaries",
      "architecture",
      "compliance",
      "compliant",
      "governance",
      "violation",
      "violations",
      "import",
      "imports",
      "secure",
      "safety",
    ].includes(token),
  );
}

function taskMentionsRecentActivity(taskTokens) {
  return taskTokens.some((token) =>
    [
      "recent",
      "latest",
      "current",
      "change",
      "changes",
      "changed",
      "update",
      "updated",
      "refactor",
      "refine",
      "extend",
      "modify",
      "patch",
    ].includes(token),
  );
}

function taskMentionsDocumentContext(taskTokens) {
  return taskTokens.some((token) =>
    [
      "requirement",
      "requirements",
      "design",
      "document",
      "documents",
      "docs",
      "spec",
      "specs",
      "business",
      "product",
      "architecture",
      "decision",
      "anchor",
    ].includes(token),
  );
}

function countPathTokenOverlap(filePath, taskTokens) {
  const fileTokens = tokenize(filePath);
  return taskTokens.reduce((count, token) => count + (fileTokens.includes(token) ? 1 : 0), 0);
}

function createNumericRange(values) {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function normalizeInRange(value, range) {
  if (!Number.isFinite(value) || !range || range.max <= range.min) {
    return 0;
  }

  return (value - range.min) / (range.max - range.min);
}

function roundSignal(value) {
  return Number(value.toFixed(2));
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function prioritizeEvidenceCitations(citations) {
  const priority = {
    graph: 0,
    document: 1,
    file: 2,
    symbol: 3,
    linked_module: 4,
    policy: 5,
  };

  return [...citations].sort((left, right) => {
    const leftPriority = priority[left.type] ?? 99;
    const rightPriority = priority[right.type] ?? 99;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return compareSerializedEntries(left, right);
  });
}

function addRelatedFile(target, filePath, relationType, relatedFilePaths) {
  if (!filePath) {
    return;
  }

  relatedFilePaths.add(filePath);
  const existing = target.get(filePath) ?? {
    path: filePath,
    relation_types: [],
  };

  existing.relation_types = dedupeByKey(
    [...existing.relation_types, relationType.toLowerCase()],
    (entry) => entry,
  );
  target.set(filePath, existing);
}

function addRelatedSymbol(target, node, relationType) {
  if (!node?.id || !node.path) {
    return;
  }

  const existing = target.get(node.id) ?? {
    id: node.id,
    name: node.name,
    type: node.type,
    file: node.path,
    relation_types: [],
  };

  existing.relation_types = dedupeByKey(
    [...existing.relation_types, relationType.toLowerCase()],
    (entry) => entry,
  );
  target.set(node.id, existing);
}

function dedupeByKey(entries, selectKey) {
  const seen = new Set();
  const deduped = [];

  for (const entry of entries) {
    const key = selectKey(entry);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

function applyTestPenalty(relativePath, testingRequested) {
  return !testingRequested && isTestPath(relativePath) ? -4 : 0;
}

function taskMentionsTesting(taskTokens) {
  return taskTokens.some((token) => ["test", "tests", "coverage", "spec"].includes(token));
}

function isTestPath(relativePath) {
  return /\.test\.[^.]+$/u.test(relativePath) || /\.spec\.[^.]+$/u.test(relativePath);
}

function compactContextPack(pack) {
  return {
    ...pack,
    summary: compactText(pack.summary, 160),
    relevant_files: pack.relevant_files.map((file) => ({
      ...file,
      symbols: (file.symbols ?? []).slice(0, 3),
    })),
    relevant_symbols: pack.relevant_symbols.map((symbol) => ({
      ...symbol,
      signature: compactText(symbol.signature, 120),
    })),
    relevant_documents: pack.relevant_documents.map((document) => ({
      ...document,
      summary: compactText(document.summary, 120),
    })),
    graph_context: {
      related_files: pack.graph_context.related_files.map((entry) => ({
        ...entry,
        relation_types: (entry.relation_types ?? []).slice(0, 2),
      })),
      related_symbols: pack.graph_context.related_symbols.map((entry) => ({
        ...entry,
        relation_types: (entry.relation_types ?? []).slice(0, 2),
      })),
      related_tests: [...pack.graph_context.related_tests],
    },
    citations: pack.citations.map((citation) => ({
      ...citation,
      reason: compactText(citation.reason, 48),
    })),
  };
}

function buildLinkedContext({ linkedModules, moduleRelationships, decisionTargets, tokenBudget }) {
  if (!tokenBudget) {
    return {
      modules: linkedModules.slice(0, 4),
      relationships: moduleRelationships.slice(0, 4),
      implementation_targets: decisionTargets.slice(0, 6),
    };
  }

  return {
    modules: linkedModules.slice(0, 3).map((module) => ({
      module: module.module,
      score: module.score,
      file_paths: (module.file_paths ?? []).slice(0, 2),
      supporting_documents: (module.supporting_documents ?? []).slice(0, 2),
    })),
    relationships: moduleRelationships.slice(0, 3).map((relationship) => ({
      from_module: relationship.from_module,
      to_module: relationship.to_module,
      provenance: relationship.provenance,
      relationship_kinds: (relationship.relationship_kinds ?? []).slice(0, 2),
      score: relationship.score,
    })),
    implementation_targets: decisionTargets.slice(0, 3).map((target) => ({
      target_type: target.target_type,
      file_path: target.file_path,
      target_name: target.target_name ?? target.target_id,
      score: target.score,
    })),
  };
}

function buildCompactSummary(pack) {
  return `Focused context for "${pack.task}" with ${pack.relevant_files.length} files, ${pack.relevant_documents.length} docs, and ${pack.relevant_symbols.length} symbols.`;
}

function compactText(value, maxLength) {
  if (typeof value !== "string") {
    return value ?? "";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function collectMatchedTaskTokens({
  taskTokens,
  relevantFiles,
  relevantSymbols,
  relevantDocuments,
  linkedModules,
}) {
  const haystack = [
    relevantFiles.map((file) => `${file.path} ${(file.symbols ?? []).join(" ")}`).join(" "),
    relevantSymbols.map((symbol) => `${symbol.name} ${symbol.signature ?? ""}`).join(" "),
    relevantDocuments.map((document) => `${document.path} ${document.title} ${document.summary}`).join(" "),
    linkedModules.map((module) => `${module.module} ${(module.file_paths ?? []).join(" ")}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return new Set(taskTokens.filter((token) => haystack.includes(token)));
}

function dedupe(values = []) {
  return [...new Set(values)];
}

function clampScore(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
