import fs from "node:fs/promises";
import path from "node:path";

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".json", ".yaml", ".yml"]);
const DEFAULT_IGNORES = new Set(["node_modules", "dist", "coverage", ".git"]);

export async function scanDocumentTree(rootDir, options = {}) {
  const configuredRoots = options.roots?.length ? options.roots : ["docs"];
  const ignore = new Set([...(options.ignore ?? []), ...DEFAULT_IGNORES]);
  const files = [];

  for (const configuredRoot of configuredRoots) {
    const absoluteRoot = path.resolve(rootDir, configuredRoot);
    const found = await discoverDocuments(rootDir, absoluteRoot, ignore);
    files.push(...found);
  }

  const documents = [];

  for (const filePath of dedupe(files)) {
    const content = await fs.readFile(filePath, "utf8");
    const relativePath = normalizePath(path.relative(rootDir, filePath));
    documents.push(createDocumentRecord(relativePath, content));
  }

  return {
    rootDir,
    configured_roots: configuredRoots,
    documents,
    totals: {
      document_count: documents.length,
      category_counts: summarizeCategories(documents),
    },
  };
}

export function findRelevantDocuments(documentIndex, task, limit = 4) {
  const tokens = tokenize(task);

  return documentIndex.documents
    .map((document) => ({
      ...document,
      score: scoreDocument(document, tokens),
    }))
    .sort((left, right) => right.score - left.score)
    .filter((document) => document.score > 0)
    .slice(0, limit)
    .map((document) => ({
      path: document.path,
      category: document.category,
      title: document.title,
      summary: document.summary,
      score: document.score,
    }));
}

export function createDocumentOverview(documentIndex) {
  return {
    document_count: documentIndex.totals.document_count,
    category_counts: documentIndex.totals.category_counts,
    top_documents: documentIndex.documents.slice(0, 5).map((document) => ({
      path: document.path,
      category: document.category,
      title: document.title,
    })),
  };
}

function createDocumentRecord(relativePath, content) {
  const lines = content.split("\n");
  const titleLine = lines.find((line) => /^#\s+/.test(line)) ?? lines.find((line) => line.trim().length > 0) ?? relativePath;
  const title = titleLine.replace(/^#\s+/, "").trim();
  const category = classifyDocument(relativePath, content);
  const headings = lines
    .filter((line) => /^#{1,3}\s+/.test(line))
    .slice(0, 8)
    .map((line) => line.replace(/^#{1,3}\s+/, "").trim());
  const summary = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .slice(0, 3)
    .join(" ")
    .slice(0, 320);

  return {
    path: relativePath,
    title,
    category,
    headings,
    summary,
  };
}

function classifyDocument(relativePath, content) {
  const haystack = `${relativePath} ${content}`.toLowerCase();

  if (matchesAny(haystack, ["prd", "requirement", "acceptance criteria", "user story"])) {
    return "requirements";
  }

  if (matchesAny(haystack, ["architecture", "system design", "technical architecture", "mcp", "cli specification"])) {
    return "technical";
  }

  if (matchesAny(haystack, ["go-to-market", "pricing", "investor", "sales", "revenue", "executive summary"])) {
    return "business";
  }

  if (matchesAny(haystack, ["roadmap", "operating model", "implementation blueprint", "milestone"])) {
    return "execution";
  }

  return "general";
}

function matchesAny(haystack, terms) {
  return terms.some((term) => haystack.includes(term));
}

async function discoverDocuments(rootDir, targetRoot, ignore) {
  let entries;
  try {
    entries = await fs.readdir(targetRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(targetRoot, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, fullPath));

    if (shouldIgnore(relativePath, ignore)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await discoverDocuments(rootDir, fullPath, ignore)));
      continue;
    }

    if (SUPPORTED_DOCUMENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function shouldIgnore(relativePath, ignore) {
  const segments = relativePath.split("/");
  return segments.some((segment) => ignore.has(segment)) || ignore.has(relativePath);
}

function summarizeCategories(documents) {
  const counts = {};
  for (const document of documents) {
    counts[document.category] = (counts[document.category] ?? 0) + 1;
  }
  return counts;
}

function scoreDocument(document, tokens) {
  const haystack = `${document.path} ${document.title} ${document.category} ${document.headings.join(" ")} ${document.summary}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
}

function tokenize(value) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3);
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function dedupe(items) {
  return [...new Set(items)].sort();
}
