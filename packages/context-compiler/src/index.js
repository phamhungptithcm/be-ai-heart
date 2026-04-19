import { findRelevantDocuments } from "../../document-ingest/src/index.js";
import {
  getDecisionImplementationsForDocuments,
  getLinkedModulesForDocuments,
} from "../../entity-linker/src/index.js";

export function compileContextPack({
  task,
  graph,
  documentIndex = { documents: [], totals: { document_count: 0 } },
  heartModel = { domains: [], links: [], summary: { relationship_count: 0 } },
  policyReport = { violations: [] },
  maxFiles = 5,
  maxSymbols = 8,
}) {
  const taskTokens = tokenize(task);
  const relevantDocuments = findRelevantDocuments(documentIndex, task);
  const linkedModules = getLinkedModulesForDocuments(
    heartModel,
    relevantDocuments.map((document) => document.path),
  );
  const decisionTargets = getDecisionImplementationsForDocuments(
    heartModel,
    relevantDocuments.map((document) => document.path),
  );
  const moduleBoosts = createModuleBoostMap(linkedModules);
  const decisionBoosts = createDecisionBoostMaps(decisionTargets);
  const scoredFiles = graph.scanResult.files
    .map((file) => ({
      file,
      score:
        scoreFile(file, taskTokens) +
        (moduleBoosts.files.get(file.relativePath) ?? 0) +
        (decisionBoosts.files.get(file.relativePath) ?? 0),
    }))
    .sort((left, right) => right.score - left.score);

  const relevantFiles = scoredFiles.filter((item) => item.score > 0).slice(0, maxFiles);
  const fallbackFiles = relevantFiles.length > 0 ? relevantFiles : scoredFiles.slice(0, maxFiles);

  const relevantSymbols = fallbackFiles
    .flatMap(({ file }) =>
      file.symbols.map((symbol) => ({
        ...symbol,
        file: file.relativePath,
        score:
          scoreSymbol(symbol, taskTokens) +
          (moduleBoosts.symbols.get(symbol.id) ?? 0) +
          (decisionBoosts.symbols.get(symbol.id) ?? 0),
      })),
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, maxSymbols);

  const reuseCandidates = relevantSymbols
    .filter((symbol) => symbol.exported)
    .slice(0, 5)
    .map((symbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      file: symbol.file,
      reason: `Matches task terms and already exists as reusable ${symbol.kind}.`,
    }));

  const relevantFilePaths = fallbackFiles.map(({ file, score }) => ({
    path: file.relativePath,
    score,
    symbols: file.symbols.map((symbol) => symbol.name),
  }));
  const quality = buildQuality({
    taskTokens,
    relevantFiles: relevantFilePaths,
    relevantSymbols,
    relevantDocuments,
    linkedModules,
    decisionTargets,
    reuseCandidates,
    policyReport,
  });
  const linkedContext = {
    modules: linkedModules.slice(0, 4),
    implementation_targets: decisionTargets.slice(0, 6),
  };

  return {
    task,
    summary: buildSummary(task, relevantFilePaths, relevantDocuments, linkedModules),
    relevant_files: relevantFilePaths,
    relevant_symbols: relevantSymbols.map((symbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      file: symbol.file,
      signature: symbol.signature,
    })),
    relevant_documents: relevantDocuments,
    linked_context: linkedContext,
    reuse_candidates: reuseCandidates,
    policies: policyReport.violations.slice(0, 3).map((violation) => violation.message),
    risks: buildRisks(relevantFilePaths, relevantDocuments, policyReport),
    quality,
    missing_context_warnings: quality.missing_context_warnings,
    open_questions: buildOpenQuestions(relevantFilePaths, relevantDocuments),
  };
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

function createModuleBoostMap(linkedModules) {
  const files = new Map();
  const symbols = new Map();

  for (const module of linkedModules) {
    for (const filePath of module.file_paths ?? []) {
      files.set(filePath, Math.max(files.get(filePath) ?? 0, module.score * 4));
    }
  }

  return { files, symbols };
}

function createDecisionBoostMaps(decisionTargets) {
  const files = new Map();
  const symbols = new Map();

  for (const target of decisionTargets) {
    if (target.target_type === "file") {
      files.set(target.file_path, Math.max(files.get(target.file_path) ?? 0, target.score * 5));
      continue;
    }

    symbols.set(target.target_id, Math.max(symbols.get(target.target_id) ?? 0, target.score * 5));
    files.set(target.file_path, Math.max(files.get(target.file_path) ?? 0, target.score * 2));
  }

  return { files, symbols };
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

function collectMatchedTaskTokens({
  taskTokens,
  relevantFiles,
  relevantSymbols,
  relevantDocuments,
  linkedModules,
}) {
  const haystack = [
    relevantFiles.map((file) => `${file.path} ${file.symbols.join(" ")}`).join(" "),
    relevantSymbols.map((symbol) => `${symbol.name} ${symbol.signature ?? ""}`).join(" "),
    relevantDocuments.map((document) => `${document.path} ${document.title} ${document.summary}`).join(" "),
    linkedModules.map((module) => `${module.module} ${(module.file_paths ?? []).join(" ")}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return new Set(taskTokens.filter((token) => haystack.includes(token)));
}

function clampScore(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
