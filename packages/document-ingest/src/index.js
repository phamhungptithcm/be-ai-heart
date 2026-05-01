import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".json", ".yaml", ".yml", ".docx", ".pdf"]);
const DEFAULT_IGNORES = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  ".worktrees",
  ".next",
  "output",
  ".playwright-cli",
  ".heart/benchmarks",
  ".heart/cache",
  ".heart/diagrams",
  ".heart/published",
]);
const SECRET_PATTERNS = [
  /\b(sk|rk|pk)_[a-z0-9_-]{8,}\b/gi,
  /\b(ghp|github_pat)_[a-z0-9_]{10,}\b/gi,
  /\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi,
  /\b(api[_ -]?key|secret|token|password|credential)\s*[:=]\s*["']?[^"'\s]+["']?/gi,
];
const RESTRICTED_DOCUMENT_LABEL_PATTERN =
  /\b(secret|secrets|credential|credentials|password|private[_ -]?key|client[_ -]?secret|access[_ -]?key)\b/i;
const RESTRICTED_DOCUMENT_CONTENT_PATTERN =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|authorization\s*:\s*bearer|client[_ -]?secret\s*[:=]|refresh[_ -]?token\s*[:=]/i;
const VERSION_SUFFIX_PATTERN = /(?:^|[-_ ])v(?:ersion)?[-_ ]?(\d+(?:\.\d+)*)$/i;
const DATE_SUFFIX_PATTERN = /(?:^|[-_ ])((?:19|20)\d{2}[-_ ]\d{2}[-_ ]\d{2})$/i;
const SEMANTIC_VECTOR_DIMENSIONS = 48;
const SEMANTIC_PHRASE_REPLACEMENTS = Object.freeze([
  [/sign[\s-]?in/gi, "authentication"],
  [/log[\s-]?in/gi, "authentication"],
  [/sign[\s-]?out/gi, "logout"],
  [/single[\s-]?sign[\s-]?on/gi, "sso"],
  [/\bprd\b/gi, "requirements"],
  [/\bspec\b/gi, "requirements"],
  [/\bbiz\b/gi, "business"],
]);
const SEMANTIC_TOKEN_REPLACEMENTS = Object.freeze({
  auth: "authentication",
  authenticate: "authentication",
  authenticated: "authentication",
  credentials: "authentication",
  credential: "authentication",
  signin: "authentication",
  signon: "authentication",
  login: "authentication",
  logins: "authentication",
  session: "authentication",
  sessions: "authentication",
  req: "requirements",
  requirement: "requirements",
  requirements: "requirements",
  specs: "requirements",
  design: "architecture",
  diagrams: "architecture",
  diagram: "architecture",
});

let cachedOcrCapabilityPromise;
let cachedOcrCapabilityKey = "";

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

    documents.push(await createDocumentRecord(filePath, relativePath, statSummary));
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

  const enrichedDocuments = enrichDocumentsWithLineage(documents);
  const indexedDocuments = enrichDocumentsWithSemanticProfiles(enrichedDocuments);

  return {
    rootDir,
    configured_roots: configuredRoots,
    documents: indexedDocuments,
    totals: {
      document_count: indexedDocuments.length,
      category_counts: summarizeCategories(indexedDocuments),
      sensitivity_counts: summarizeSensitivity(indexedDocuments),
      lineage_count: countLineages(indexedDocuments),
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
  const queryProfile = createSemanticQueryProfile(task);

  return selectRetrievableDocuments(documentIndex.documents ?? [])
    .map((document) => {
      const scoring = scoreDocument(document, tokens, queryProfile);
      return {
        ...document,
        ...scoring,
      };
    })
    .sort((left, right) => right.score - left.score)
    .filter((document) => document.score > 0 || document.semantic_score >= 0.18)
    .slice(0, limit)
    .map((document) => ({
      path: document.path,
      category: document.category,
      title: document.title,
      source_type: document.source_type,
      summary: toSearchableSummary(document),
      summary_redacted: document.sensitivity?.level === "restricted",
      freshness: document.freshness,
      sensitivity: document.sensitivity,
      lineage: compactLineage(document.lineage),
      extraction: compactExtraction(document.extraction),
      lexical_score: document.lexical_score,
      semantic_score: document.semantic_score,
      score: document.score,
    }));
}

export function createDocumentOverview(documentIndex) {
  return {
    document_count: documentIndex.totals.document_count,
    category_counts: documentIndex.totals.category_counts,
    sensitivity_counts: documentIndex.totals.sensitivity_counts,
    lineage_count: documentIndex.totals.lineage_count ?? countLineages(documentIndex.documents ?? []),
    top_documents: documentIndex.documents.slice(0, 5).map((document) => ({
      path: document.path,
      category: document.category,
      title: document.title,
      sensitivity: document.sensitivity?.level ?? "internal",
    })),
  };
}

async function createDocumentRecord(filePath, relativePath, statSummary) {
  const payload = await readDocumentPayload(filePath, relativePath);
  const content = payload.content;
  const structured = readStructuredDocument(content);
  const lines = content.split("\n");
  const titleLine =
    structured?.title ??
    lines.find((line) => /^#\s+/.test(line)) ??
    lines.find((line) => line.trim().length > 0) ??
    relativePath;
  const title = String(titleLine).replace(/^#\s+/, "").trim();
  const category = structured?.category ?? classifyDocument(relativePath, content);
  const sensitivity = detectSensitivity(relativePath, structured?.body ?? content, structured);
  const lineage = createLineage(relativePath, structured, filePath);
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
  const previewSource = structured?.body?.slice(0, 4000) ?? content.slice(0, 4000);
  const contentPreview = redactSensitiveContent(previewSource);

  return {
    path: relativePath,
    source_type: resolveSourceType(relativePath),
    title,
    category,
    headings,
    summary,
    content_preview: contentPreview,
    extraction: payload.extraction,
    freshness: {
      updated_at: new Date(statSummary.mtime_ms).toISOString(),
      source_mtime_ms: statSummary.mtime_ms,
    },
    lineage,
    sensitivity,
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

function summarizeSensitivity(documents) {
  const counts = {};
  for (const document of documents) {
    const level = document.sensitivity?.level ?? "internal";
    counts[level] = (counts[level] ?? 0) + 1;
  }
  return counts;
}

function countLineages(documents) {
  return new Set(
    documents.map((document) => document.lineage?.lineage_id || `path:${document.path}`),
  ).size;
}

function scoreDocument(document, tokens, queryProfile) {
  const haystack = `${document.path} ${document.title} ${document.category} ${document.headings.join(" ")} ${document.summary} ${document.lineage?.canonical_title ?? ""}`.toLowerCase();
  const lexicalScore = tokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
  const semanticScore = roundScore(cosineSimilarity(queryProfile?.vector ?? [], document.semantic_profile?.vector ?? []));
  const latestBoost = document.lineage?.is_latest === false ? -1 : 1;
  const sensitivityPenalty = document.sensitivity?.level === "restricted" ? 0.5 : 0;
  return {
    lexical_score: lexicalScore,
    semantic_score: semanticScore,
    score: roundScore(Math.max(0, lexicalScore + semanticScore * 4 + latestBoost - sensitivityPenalty)),
  };
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

async function readDocumentPayload(filePath, relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  if (extension === ".docx") {
    return extractDocxPayload(filePath);
  }

  if (extension === ".pdf") {
    return extractPdfPayload(filePath);
  }

  return {
    content: await fs.readFile(filePath, "utf8"),
    extraction: {
      extractor: "plain-text",
      mode: "text",
      layout_aware: false,
      page_count: null,
      ocr_available: false,
      ocr_engine: "",
      ocr_applied: false,
      ocr_recommended: false,
    },
  };
}

async function extractDocxPayload(filePath) {
  const fromZip = await extractDocxTextWithUnzip(filePath);
  if (fromZip.trim().length > 0) {
    return {
      content: fromZip,
      extraction: {
        extractor: "docx-zip",
        mode: "xml-text",
        layout_aware: false,
        page_count: null,
        ocr_available: false,
        ocr_engine: "",
        ocr_applied: false,
        ocr_recommended: false,
      },
    };
  }

  const fromPython = await extractDocxTextWithPython(filePath);
  if (fromPython.trim().length > 0) {
    return {
      content: fromPython,
      extraction: {
        extractor: "docx-python",
        mode: "xml-text",
        layout_aware: false,
        page_count: null,
        ocr_available: false,
        ocr_engine: "",
        ocr_applied: false,
        ocr_recommended: false,
      },
    };
  }

  return {
    content: "",
    extraction: {
      extractor: "docx-empty",
      mode: "empty",
      layout_aware: false,
      page_count: null,
      ocr_available: false,
      ocr_engine: "",
      ocr_applied: false,
      ocr_recommended: false,
    },
  };
}

async function extractDocxTextWithUnzip(filePath) {
  try {
    const { stdout } = await execFileAsync("unzip", ["-p", filePath, "word/document.xml"], {
      maxBuffer: 1024 * 1024 * 8,
      timeout: 15000,
    });
    return normalizeExtractedText(stripXml(stdout));
  } catch {
    return "";
  }
}

async function extractDocxTextWithPython(filePath) {
  const script = [
    "import html, re, sys, zipfile",
    "with zipfile.ZipFile(sys.argv[1]) as archive:",
    "    xml = archive.read('word/document.xml').decode('utf-8', 'ignore')",
    "xml = re.sub(r'</w:p>', '\\n', xml)",
    "xml = re.sub(r'<[^>]+>', ' ', xml)",
    "print(html.unescape(xml))",
  ].join("\n");

  for (const candidate of resolvePythonCandidates()) {
    try {
      const { stdout } = await execFileAsync(candidate, ["-c", script, filePath], {
        maxBuffer: 1024 * 1024 * 8,
        timeout: 15000,
      });
      return normalizeExtractedText(stdout);
    } catch {
      continue;
    }
  }

  return "";
}

async function extractPdfPayload(filePath) {
  const fromPython = await extractPdfTextWithPython(filePath);
  if (fromPython.content.trim().length > 0 && !shouldAttemptPdfOcr(fromPython)) {
    return fromPython;
  }

  if (shouldAttemptPdfOcr(fromPython)) {
    const fromOcr = await extractPdfTextWithOcrMyPdf(filePath, fromPython);
    if (fromOcr) {
      return fromOcr;
    }
  }

  const ocrCapability = await detectOcrCapability();
  return {
    content: fromPython.content.trim().length > 0 ? fromPython.content : extractPdfText(await fs.readFile(filePath)),
    extraction: {
      ...fromPython.extraction,
      extractor: fromPython.content.trim().length > 0 ? fromPython.extraction.extractor : "pdf-latin1-fallback",
      mode: fromPython.content.trim().length > 0 ? fromPython.extraction.mode : "raw-text",
      layout_aware: fromPython.content.trim().length > 0 ? fromPython.extraction.layout_aware : false,
      page_count: fromPython.content.trim().length > 0 ? fromPython.extraction.page_count : null,
      ocr_available: ocrCapability.available,
      ocr_engine: ocrCapability.engine,
      ocr_applied: false,
      ocr_recommended: true,
    },
  };
}

async function extractPdfTextWithPython(filePath) {
  const script = [
    "import json, sys",
    "from pypdf import PdfReader",
    "reader = PdfReader(sys.argv[1])",
    "pages = []",
    "for page in reader.pages:",
    "    layout_text = ''",
    "    plain_text = ''",
    "    try:",
    "        layout_text = page.extract_text(extraction_mode='layout') or ''",
    "    except TypeError:",
    "        layout_text = ''",
    "    plain_text = page.extract_text() or ''",
    "    selected = layout_text if layout_text.strip() else plain_text",
    "    pages.append({",
    "        'selected_text': selected,",
    "        'layout_used': bool(layout_text.strip()),",
    "        'char_count': len(selected.strip()),",
    "    })",
    "print(json.dumps({",
    "    'text': '\\n'.join(page['selected_text'] for page in pages if page['selected_text']),",
    "    'page_count': len(reader.pages),",
    "    'layout_used': any(page['layout_used'] for page in pages),",
    "    'page_char_counts': [page['char_count'] for page in pages],",
    "}))",
  ].join("\n");

  for (const candidate of resolvePythonCandidates()) {
    try {
      const { stdout } = await execFileAsync(candidate, ["-c", script, filePath], {
        maxBuffer: 1024 * 1024 * 8,
        timeout: 20000,
      });
      const parsed = JSON.parse(stdout);
      const ocrCapability = await detectOcrCapability();
      const normalizedText = normalizeExtractedText(parsed.text ?? "");
      const weakText = normalizedText.length < 40;
      return {
        content: normalizedText,
        extraction: {
          extractor: "pypdf",
          mode: parsed.layout_used ? "layout" : "plain",
          layout_aware: Boolean(parsed.layout_used),
          page_count: Number(parsed.page_count ?? 0) || null,
          page_char_counts: Array.isArray(parsed.page_char_counts) ? parsed.page_char_counts : [],
          ocr_available: ocrCapability.available,
          ocr_engine: ocrCapability.engine,
          ocr_applied: false,
          ocr_recommended: weakText,
        },
      };
    } catch {
      continue;
    }
  }

  const ocrCapability = await detectOcrCapability();
  return {
    content: "",
    extraction: {
      extractor: "pdf-empty",
      mode: "empty",
      layout_aware: false,
      page_count: null,
      ocr_available: ocrCapability.available,
      ocr_engine: ocrCapability.engine,
      ocr_applied: false,
      ocr_recommended: true,
    },
  };
}

async function extractPdfTextWithOcrMyPdf(filePath, priorExtraction) {
  const ocrCapability = await detectOcrCapability();
  if (!ocrCapability.ocrmypdf_available) {
    return null;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-pdf-ocr-"));
  const ocrOutputPath = path.join(tempDir, "ocr-output.pdf");

  try {
    await execFileAsync("ocrmypdf", ["--force-ocr", "--skip-text", filePath, ocrOutputPath], {
      maxBuffer: 1024 * 1024 * 4,
      timeout: 120000,
    });
    const ocrExtraction = await extractPdfTextWithPython(ocrOutputPath);
    const fallbackText =
      ocrExtraction.content.trim().length > 0
        ? ocrExtraction.content
        : extractPdfText(await fs.readFile(ocrOutputPath));
    if (fallbackText.trim().length === 0) {
      return null;
    }

    return {
      content: fallbackText,
      extraction: {
        ...ocrExtraction.extraction,
        extractor: `${ocrExtraction.extraction.extractor}+ocrmypdf`,
        mode: ocrExtraction.extraction.layout_aware ? "ocr-layout" : "ocr-text",
        ocr_available: true,
        ocr_engine: "ocrmypdf",
        ocr_applied: true,
        ocr_recommended: false,
        ocr_source_extractor: priorExtraction?.extraction?.extractor ?? "",
      },
    };
  } catch {
    return null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
  }
}

function shouldAttemptPdfOcr(pdfPayload) {
  const extraction = pdfPayload?.extraction ?? {};
  if (!extraction.ocr_available || extraction.ocr_applied) {
    return false;
  }

  return extraction.ocr_recommended === true || String(pdfPayload?.content ?? "").trim().length === 0;
}

function extractPdfText(buffer) {
  const source = buffer.toString("latin1");
  const literalMatches = [...source.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)].map((match) =>
    decodePdfString(match[1]),
  );
  const arrayMatches = [...source.matchAll(/\[(.*?)\]\s*TJ/gms)].flatMap((match) =>
    [...match[1].matchAll(/\(([^()]*(?:\\.[^()]*)*)\)/g)].map((item) => decodePdfString(item[1])),
  );
  const combined = [...literalMatches, ...arrayMatches]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");

  if (combined.length > 0) {
    return normalizeExtractedText(combined);
  }

  const printable = source
    .replace(/[^ -~\n]+/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8)
    .slice(0, 40)
    .join("\n");

  return normalizeExtractedText(printable);
}

function decodePdfString(value) {
  return String(value ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function stripXml(value) {
  return String(value ?? "")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ");
}

function normalizeExtractedText(value) {
  return String(value ?? "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function resolvePythonCandidates() {
  const bundledRuntime = process.env.HOME
    ? path.join(
        process.env.HOME,
        ".cache",
        "codex-runtimes",
        "codex-primary-runtime",
        "dependencies",
        "python",
        "bin",
        "python3",
      )
    : "";

  return dedupe([
    process.env.BE_AI_HEART_PYTHON,
    process.env.CODEX_PYTHON_EXECUTABLE,
    process.env.PYTHON,
    bundledRuntime,
    "python3",
    "python",
  ].filter(Boolean));
}

function resolveSourceType(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  switch (extension) {
    case ".md":
    case ".mdx":
      return "markdown";
    case ".json":
      return "json";
    case ".yaml":
    case ".yml":
      return "yaml";
    case ".docx":
      return "docx";
    case ".pdf":
      return "pdf";
    default:
      return extension.replace(/^\./, "") || "text";
  }
}

async function detectOcrCapability() {
  const cacheKey = `${process.env.PATH ?? ""}|${process.env.BE_AI_HEART_PYTHON ?? ""}|${process.env.CODEX_PYTHON_EXECUTABLE ?? ""}`;
  if (!cachedOcrCapabilityPromise || cachedOcrCapabilityKey !== cacheKey) {
    cachedOcrCapabilityKey = cacheKey;
    cachedOcrCapabilityPromise = resolveOcrCapability();
  }

  return cachedOcrCapabilityPromise;
}

async function resolveOcrCapability() {
  const capability = {
    available: false,
    engine: "",
    ocrmypdf_available: false,
    tesseract_available: false,
  };

  for (const candidate of ["ocrmypdf", "tesseract"]) {
    try {
      await execFileAsync(candidate, ["--version"], {
        maxBuffer: 1024 * 64,
        timeout: 5000,
      });
      capability[`${candidate}_available`] = true;
    } catch {
      continue;
    }
  }

  capability.available = capability.ocrmypdf_available || capability.tesseract_available;
  capability.engine = capability.ocrmypdf_available
    ? "ocrmypdf"
    : capability.tesseract_available
    ? "tesseract"
    : "";

  return capability;
}

function createLineage(relativePath, structured = null, filePath = "") {
  const normalizedPath = normalizePath(relativePath);
  const { lineageSeed, versionLabel, versionRank } = deriveVersionMetadata(
    normalizedPath,
    structured?.title ?? "",
    structured,
  );
  if (normalizedPath.startsWith(".heart/imported-documents/web/")) {
    return {
      source_kind: "imported",
      source_system: structured?.source || "portal-web-upload",
      source_path: normalizedPath,
      submission_id: structured?.submission_id ?? "",
      profile_slug: structured?.profile_slug ?? "",
      lineage_seed: lineageSeed,
      version_label: versionLabel,
      version_rank: versionRank,
      supersedes: structured?.supersedes ?? "",
    };
  }

  if (normalizedPath.startsWith(".heart/imported-documents/local/")) {
    return {
      source_kind: "imported",
      source_system: structured?.source || "cli-import",
      source_path: normalizedPath,
      original_path: structured?.source_path ?? "",
      imported_from: path.basename(filePath),
      lineage_seed: lineageSeed,
      version_label: versionLabel,
      version_rank: versionRank,
      supersedes: structured?.supersedes ?? "",
    };
  }

  return {
    source_kind: "repository",
    source_system: "workspace",
    source_path: normalizedPath,
    lineage_seed: lineageSeed,
    version_label: versionLabel,
    version_rank: versionRank,
    supersedes: structured?.supersedes ?? "",
  };
}

function deriveVersionMetadata(relativePath, title = "", structured = null) {
  const explicitLineage = normalizeSlug(
    structured?.lineage_id || structured?.document_id || structured?.version_group || "",
  );
  const explicitVersion = String(structured?.version || structured?.version_id || "").trim();
  const stem = path.basename(relativePath, path.extname(relativePath));
  const titleSeed = normalizeSlug(title || stem);
  const pathSeed = normalizeSlug(stripVersionSuffix(stem));
  const lineageSeed = explicitLineage || pathSeed || titleSeed || normalizeSlug(relativePath);
  const versionLabel = explicitVersion || extractVersionLabel(stem) || "";
  const versionRank = deriveVersionRank(versionLabel);

  return {
    lineageSeed,
    versionLabel,
    versionRank,
  };
}

function stripVersionSuffix(value) {
  return String(value ?? "")
    .replace(VERSION_SUFFIX_PATTERN, "")
    .replace(DATE_SUFFIX_PATTERN, "")
    .trim();
}

function extractVersionLabel(value) {
  const versionMatch = String(value ?? "").match(VERSION_SUFFIX_PATTERN);
  if (versionMatch) {
    return `v${versionMatch[1]}`;
  }

  const dateMatch = String(value ?? "").match(DATE_SUFFIX_PATTERN);
  if (dateMatch) {
    return dateMatch[1].replace(/[_ ]/g, "-");
  }

  return "";
}

function deriveVersionRank(versionLabel) {
  if (!versionLabel) {
    return 0;
  }

  const digits = versionLabel.match(/\d+/g) ?? [];
  if (digits.length === 0) {
    return 0;
  }

  return Number(digits.map((value) => value.padStart(4, "0")).join(""));
}

function detectSensitivity(relativePath, content, structured = null) {
  const classificationHaystack = `${relativePath}\n${structured?.title ?? ""}\n${structured?.summary ?? ""}`;
  const haystack = `${classificationHaystack}\n${content}`.toLowerCase();
  const hasSecretPattern = SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(content);
  });
  const hasRestrictedLabel = RESTRICTED_DOCUMENT_LABEL_PATTERN.test(classificationHaystack);
  const hasRestrictedContentMarker = RESTRICTED_DOCUMENT_CONTENT_PATTERN.test(content);
  const reasons = [];
  let level = "internal";

  if (hasSecretPattern || hasRestrictedLabel || hasRestrictedContentMarker) {
    level = "restricted";
    reasons.push("secret-like labels or credential patterns detected");
  } else if (
    relativePath.includes(".heart/imported-documents/") ||
    /customer|client|pricing|contract|invoice|requirements|acceptance criteria/i.test(haystack)
  ) {
    level = "customer";
    reasons.push("customer or project requirement content detected");
  } else if (/public|website|press/i.test(haystack)) {
    level = "public";
    reasons.push("document appears suitable for public sharing");
  }

  return {
    level,
    reasons,
  };
}

function redactSensitiveContent(content) {
  let redacted = String(content ?? "");
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      const labelMatch = match.match(/^(api[_ -]?key|secret|token|password|credential)/i);
      if (labelMatch) {
        return `${labelMatch[0]}: [REDACTED]`;
      }

      if (/^Bearer\s+/i.test(match)) {
        return "Bearer [REDACTED]";
      }

      return "[REDACTED]";
    });
  }
  return redacted;
}

function enrichDocumentsWithLineage(documents) {
  const documentsByLineage = new Map();

  for (const document of documents) {
    const lineageId = document.lineage?.lineage_seed || normalizeSlug(document.title) || normalizeSlug(document.path);
    const existing = documentsByLineage.get(lineageId) ?? [];
    existing.push(document);
    documentsByLineage.set(lineageId, existing);
  }

  return documents.map((document) => {
    const lineageId = document.lineage?.lineage_seed || normalizeSlug(document.title) || normalizeSlug(document.path);
    const group = [...(documentsByLineage.get(lineageId) ?? [document])].sort(compareDocumentVersions);
    const currentIndex = group.findIndex((entry) => entry.path === document.path);
    const latest = group[0] ?? document;
    const previous = currentIndex >= 0 ? group[currentIndex + 1] ?? null : null;

    return {
      ...document,
      lineage: {
        ...document.lineage,
        lineage_id: lineageId,
        canonical_title: latest.title,
        is_latest: latest.path === document.path,
        latest_path: latest.path,
        previous_path: previous?.path ?? "",
        version_label: document.lineage?.version_label || inferVersionLabelFromOrder(group, currentIndex),
        version_rank:
          Number.isFinite(Number(document.lineage?.version_rank)) && Number(document.lineage?.version_rank) > 0
            ? Number(document.lineage.version_rank)
            : group.length - currentIndex,
        group_size: group.length,
      },
    };
  });
}

function enrichDocumentsWithSemanticProfiles(documents) {
  return documents.map((document) => ({
    ...document,
    semantic_profile: buildSemanticProfile(document),
  }));
}

function compareDocumentVersions(left, right) {
  const leftRank = Number(left.lineage?.version_rank ?? 0);
  const rightRank = Number(right.lineage?.version_rank ?? 0);
  if (leftRank !== rightRank) {
    return rightRank - leftRank;
  }

  const leftTime = Number(left.document_stats?.mtime_ms ?? 0);
  const rightTime = Number(right.document_stats?.mtime_ms ?? 0);
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return left.path.localeCompare(right.path);
}

function inferVersionLabelFromOrder(group, index) {
  if (index <= 0) {
    return "latest";
  }

  return `v${group.length - index}`;
}

function selectRetrievableDocuments(documents) {
  const latestByLineage = new Map();

  for (const document of documents) {
    const lineageId = document.lineage?.lineage_id || document.lineage?.lineage_seed || document.path;
    const existing = latestByLineage.get(lineageId);
    if (!existing || compareDocumentVersions(document, existing) < 0) {
      latestByLineage.set(lineageId, document);
    }
  }

  return [...latestByLineage.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function toSearchableSummary(document) {
  if (document.sensitivity?.level === "restricted") {
    return "Restricted document match. Summary redacted; inspect locally if explicitly authorized.";
  }

  return document.summary;
}

function buildSemanticProfile(document) {
  const semanticText = createSemanticText(document);
  const tokens = tokenizeSemanticText(semanticText);
  const vector = buildSemanticVector(tokens);
  return {
    version: 1,
    dims: SEMANTIC_VECTOR_DIMENSIONS,
    keywords: [...new Set(tokens)].slice(0, 12),
    vector,
  };
}

function createSemanticQueryProfile(task) {
  const tokens = tokenizeSemanticText(task);
  return {
    dims: SEMANTIC_VECTOR_DIMENSIONS,
    vector: buildSemanticVector(tokens),
  };
}

function createSemanticText(document) {
  const safeSummary = document.sensitivity?.level === "restricted"
    ? redactSensitiveContent(document.summary)
    : document.summary;
  const safePreview = document.content_preview ?? "";
  return [
    document.path,
    document.title,
    document.title,
    document.category,
    document.lineage?.canonical_title ?? "",
    ...(document.headings ?? []),
    safeSummary,
    safePreview,
  ].join("\n");
}

function tokenizeSemanticText(value) {
  let normalized = String(value ?? "").toLowerCase();
  for (const [pattern, replacement] of SEMANTIC_PHRASE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .split(/[^a-z0-9]+/i)
    .map((token) => normalizeSemanticToken(token))
    .filter((token) => token.length >= 3);
}

function normalizeSemanticToken(token) {
  let normalized = String(token ?? "").trim().toLowerCase();
  normalized = SEMANTIC_TOKEN_REPLACEMENTS[normalized] ?? normalized;

  if (normalized.endsWith("ies") && normalized.length > 4) {
    return normalized.slice(0, -3) + "y";
  }

  if (normalized.endsWith("ing") && normalized.length > 5) {
    normalized = normalized.slice(0, -3);
  } else if (normalized.endsWith("ed") && normalized.length > 4) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith("s") && normalized.length > 4) {
    normalized = normalized.slice(0, -1);
  }

  return SEMANTIC_TOKEN_REPLACEMENTS[normalized] ?? normalized;
}

function buildSemanticVector(tokens) {
  const vector = new Array(SEMANTIC_VECTOR_DIMENSIONS).fill(0);
  for (const token of tokens) {
    const bucket = hashSemanticToken(token) % SEMANTIC_VECTOR_DIMENSIONS;
    vector[bucket] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => roundScore(value / magnitude));
}

function hashSemanticToken(token) {
  let hash = 0;
  for (const character of String(token)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function cosineSimilarity(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || right.length === 0) {
    return 0;
  }

  const dimensions = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < dimensions; index += 1) {
    dot += Number(left[index] ?? 0) * Number(right[index] ?? 0);
  }

  return Math.max(0, dot);
}

function compactExtraction(extraction = {}) {
  return {
    extractor: extraction.extractor ?? "",
    mode: extraction.mode ?? "",
    layout_aware: Boolean(extraction.layout_aware),
    page_count: extraction.page_count ?? null,
    ocr_available: Boolean(extraction.ocr_available),
    ocr_engine: extraction.ocr_engine ?? "",
    ocr_applied: Boolean(extraction.ocr_applied),
    ocr_recommended: Boolean(extraction.ocr_recommended),
  };
}

function roundScore(value) {
  return Math.round(Number(value ?? 0) * 1000) / 1000;
}

function compactLineage(lineage = {}) {
  return {
    lineage_id: lineage.lineage_id ?? lineage.lineage_seed ?? "",
    canonical_title: lineage.canonical_title ?? "",
    is_latest: lineage.is_latest ?? true,
    latest_path: lineage.latest_path ?? lineage.source_path ?? "",
    previous_path: lineage.previous_path ?? "",
    version_label: lineage.version_label ?? "",
    group_size: Number(lineage.group_size ?? 1),
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
      source: parsed.source ? String(parsed.source) : "",
      source_path: parsed.source_path ? String(parsed.source_path) : "",
      submission_id: parsed.submission_id ? String(parsed.submission_id) : "",
      profile_slug: parsed.profile_slug ? String(parsed.profile_slug) : "",
      lineage_id: parsed.lineage_id ? String(parsed.lineage_id) : "",
      document_id: parsed.document_id ? String(parsed.document_id) : "",
      version_group: parsed.version_group ? String(parsed.version_group) : "",
      version: parsed.version ? String(parsed.version) : "",
      version_id: parsed.version_id ? String(parsed.version_id) : "",
      supersedes: parsed.supersedes ? String(parsed.supersedes) : "",
    };
  } catch {
    return null;
  }
}

function normalizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
