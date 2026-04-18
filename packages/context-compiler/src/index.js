import { findRelevantDocuments } from "../../document-ingest/src/index.js";

export function compileContextPack({
  task,
  graph,
  documentIndex = { documents: [], totals: { document_count: 0 } },
  policyReport = { violations: [] },
  maxFiles = 5,
  maxSymbols = 8,
}) {
  const taskTokens = tokenize(task);
  const scoredFiles = graph.scanResult.files
    .map((file) => ({
      file,
      score: scoreFile(file, taskTokens),
    }))
    .sort((left, right) => right.score - left.score);

  const relevantFiles = scoredFiles.filter((item) => item.score > 0).slice(0, maxFiles);
  const fallbackFiles = relevantFiles.length > 0 ? relevantFiles : scoredFiles.slice(0, maxFiles);

  const relevantSymbols = fallbackFiles
    .flatMap(({ file }) =>
      file.symbols.map((symbol) => ({
        ...symbol,
        file: file.relativePath,
        score: scoreSymbol(symbol, taskTokens),
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
  const relevantDocuments = findRelevantDocuments(documentIndex, task);

  return {
    task,
    summary: buildSummary(task, relevantFilePaths, relevantDocuments),
    relevant_files: relevantFilePaths,
    relevant_symbols: relevantSymbols.map((symbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      file: symbol.file,
      signature: symbol.signature,
    })),
    relevant_documents: relevantDocuments,
    reuse_candidates: reuseCandidates,
    policies: policyReport.violations.slice(0, 3).map((violation) => violation.message),
    risks: buildRisks(relevantFilePaths, relevantDocuments, policyReport),
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

function buildSummary(task, relevantFiles, relevantDocuments) {
  if (relevantFiles.length === 0 && relevantDocuments.length === 0) {
    return `No strong code matches found for "${task}". Start with project overview and architecture constraints.`;
  }

  return `Compiled a focused context pack for "${task}" from ${relevantFiles.length} relevant source files and ${relevantDocuments.length} relevant documents.`;
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
