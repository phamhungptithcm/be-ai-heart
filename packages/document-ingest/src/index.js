import fs from "node:fs/promises";
import path from "node:path";

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".json", ".yaml", ".yml"]);
const DEFAULT_IGNORES = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  ".next",
  "output",
  ".playwright-cli",
  ".heart/cache",
  ".heart/diagrams",
  ".heart/published",
]);

export async function scanDocumentTree(rootDir, options = {}) {
  const configuredRoots = options.roots?.length ? options.roots : ["docs"];
  const ignore = new Set([...(options.ignore ?? []), ...DEFAULT_IGNORES]);
  const files = [];
  const previousDocumentsByPath = new Map(
    (options.previousDocumentIndex?.documents ?? []).map((document) => [document.path, document]),
  );

  for (const configuredRoot of configuredRoots) {
    const absoluteRoot = path.resolve(rootDir, configuredRoot);
    const found = await discoverDocuments(rootDir, absoluteRoot, ignore, absoluteRoot);
    files.push(...found);
  }

  const documents = [];
  const currentPaths = new Set();
  let reusedDocumentCount = 0;
  let reparsedDocumentCount = 0;
  let addedDocumentCount = 0;
  let changedDocumentCount = 0;

  for (const filePath of dedupe(files)) {
    const relativePath = normalizePath(path.relative(rootDir, filePath));
    const fileStats = await fs.stat(filePath);
    const statSummary = summarizeStat(fileStats);
    const previousDocument = previousDocumentsByPath.get(relativePath);
    currentPaths.add(relativePath);

    if (canReuseDocument(previousDocument, statSummary)) {
      documents.push(previousDocument);
      reusedDocumentCount += 1;
      continue;
    }

    const content = await fs.readFile(filePath, "utf8");
    documents.push(createDocumentRecord(relativePath, content, statSummary));
    reparsedDocumentCount += 1;

    if (!previousDocument) {
      addedDocumentCount += 1;
    } else {
      changedDocumentCount += 1;
    }
  }

  let removedDocumentCount = 0;
  for (const documentPath of previousDocumentsByPath.keys()) {
    if (!currentPaths.has(documentPath)) {
      removedDocumentCount += 1;
    }
  }

  return {
    rootDir,
    configured_roots: configuredRoots,
    documents,
    totals: {
      document_count: documents.length,
      category_counts: summarizeCategories(documents),
    },
    incremental: {
      reused_document_count: reusedDocumentCount,
      reparsed_document_count: reparsedDocumentCount,
      added_document_count: addedDocumentCount,
      changed_document_count: changedDocumentCount,
      removed_document_count: removedDocumentCount,
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

function createDocumentRecord(relativePath, content, statSummary) {
  const structured = readStructuredDocument(content);
  const lines = content.split("\n");
  const titleLine =
    structured?.title ??
    lines.find((line) => /^#\s+/.test(line)) ??
    lines.find((line) => line.trim().length > 0) ??
    relativePath;
  const title = String(titleLine).replace(/^#\s+/, "").trim();
  const category = structured?.category ?? classifyDocument(relativePath, content);
  const headings = lines
    .filter((line) => /^#{1,3}\s+/.test(line))
    .slice(0, 8)
    .map((line) => line.replace(/^#{1,3}\s+/, "").trim());
  const summary =
    structured?.summary ??
    lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .slice(0, 3)
      .join(" ")
      .slice(0, 320);
  const contentPreview = structured?.body?.slice(0, 4000) ?? content.slice(0, 4000);

  return {
    path: relativePath,
    title,
    category,
    headings,
    summary,
    content_preview: contentPreview,
    document_stats: statSummary,
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

async function discoverDocuments(rootDir, targetRoot, ignore, currentDir = targetRoot) {
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, fullPath));

    if (shouldIgnore(relativePath, ignore)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await discoverDocuments(rootDir, targetRoot, ignore, fullPath)));
      continue;
    }

    if (SUPPORTED_DOCUMENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function shouldIgnore(relativePath, ignore) {
  const normalizedPath = normalizePath(relativePath);
  const segments = normalizedPath.split("/");

  for (const ignoredPath of ignore) {
    if (ignoredPath.includes("/") && (normalizedPath === ignoredPath || normalizedPath.startsWith(`${ignoredPath}/`))) {
      return true;
    }
  }

  return segments.some((segment) => ignore.has(segment)) || ignore.has(normalizedPath);
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

function summarizeStat(fileStats) {
  return {
    size: fileStats.size,
    mtime_ms: fileStats.mtimeMs,
  };
}

function canReuseDocument(previousDocument, statSummary) {
  if (!previousDocument?.document_stats) {
    return false;
  }

  return (
    previousDocument.document_stats.size === statSummary.size &&
    previousDocument.document_stats.mtime_ms === statSummary.mtime_ms
  );
}

function readStructuredDocument(content) {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      title: parsed.title ? String(parsed.title) : "",
      category: parsed.category ? String(parsed.category) : "",
      summary: parsed.summary ? String(parsed.summary) : "",
      body: parsed.body ? String(parsed.body) : "",
    };
  } catch {
    return null;
  }
}
