import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluate } from "@mdx-js/mdx";
import * as jsxRuntime from "react/jsx-runtime";

const DOC_EXTENSION = ".mdx";

export function resolveDocsRoot(customRoot) {
  if (customRoot) {
    return path.resolve(customRoot);
  }

  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "content",
    "docs",
  );
}

export async function loadDocsCatalog({ docsRoot } = {}) {
  const root = resolveDocsRoot(docsRoot);
  const versions = await listDocVersions(root);
  const documents = [];

  for (const version of versions) {
    const versionRoot = path.join(root, version);
    for (const filePath of await collectDocFiles(versionRoot)) {
      const entry = await readDocFile({ docsRoot: root, filePath, version });
      documents.push(entry);
    }
  }

  documents.sort((left, right) => {
    if (left.version !== right.version) {
      return compareVersions(right.version, left.version);
    }

    if (left.metadata.order !== right.metadata.order) {
      return left.metadata.order - right.metadata.order;
    }

    return left.metadata.title.localeCompare(right.metadata.title);
  });

  return {
    docsRoot: root,
    versions,
    latestVersion: versions[0] ?? null,
    documents,
  };
}

export async function loadDocEntry({ docsRoot, version, slugSegments = [] } = {}) {
  const catalog = await loadDocsCatalog({ docsRoot });
  const resolvedVersion = resolveRequestedVersion(version, catalog.versions);
  if (!resolvedVersion) {
    return null;
  }

  const normalizedSlug = normalizeSlugSegments(slugSegments).join("/");
  const match = catalog.documents.find(
    (entry) => entry.version === resolvedVersion && entry.slug === normalizedSlug,
  );
  if (!match) {
    return null;
  }

  const source = await fs.readFile(match.filePath, "utf8");
  const { metadata, body } = parseFrontmatter(source);
  const evaluated = await evaluate(body, {
    ...jsxRuntime,
    development: false,
    useDynamicImport: false,
  });

  return {
    ...match,
    metadata: {
      ...match.metadata,
      ...metadata,
    },
    body,
    Content: evaluated.default,
  };
}

export function searchDocs(catalog, query) {
  const safeQuery = String(query ?? "")
    .trim()
    .toLowerCase();
  if (!safeQuery) {
    return catalog.documents;
  }

  const terms = safeQuery.split(/\s+/).filter(Boolean);
  return catalog.documents.filter((entry) => {
    const haystack = entry.searchText.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

async function readDocFile({ docsRoot, filePath, version }) {
  const source = await fs.readFile(filePath, "utf8");
  const { metadata, body } = parseFrontmatter(source);
  const relativePath = path.relative(path.join(docsRoot, version), filePath);
  const slugSegments = deriveSlugSegments(relativePath);
  const headings = extractHeadings(body);
  const plainText = stripMarkdown(body);

  return {
    version,
    slug: slugSegments.join("/"),
    slugSegments,
    href: `/docs/${version}/${slugSegments.join("/")}`,
    filePath,
    metadata: {
      title: metadata.title ?? toTitleCase(slugSegments.at(-1) ?? "Overview"),
      description: metadata.description ?? firstParagraph(plainText),
      category: metadata.category ?? "guide",
      order: Number(metadata.order ?? 100),
      keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
    },
    headings,
    excerpt: firstParagraph(plainText),
    searchText: [
      metadata.title,
      metadata.description,
      metadata.category,
      ...(Array.isArray(metadata.keywords) ? metadata.keywords : []),
      headings.map((heading) => heading.title).join(" "),
      plainText,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

async function listDocVersions(docsRoot) {
  let entries = [];
  try {
    entries = await fs.readdir(docsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => compareVersions(right, left));
}

async function collectDocFiles(root) {
  const results = [];

  async function walk(currentRoot) {
    let entries = [];
    try {
      entries = await fs.readdir(currentRoot, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const targetPath = path.join(currentRoot, entry.name);
      if (entry.isDirectory()) {
        await walk(targetPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(DOC_EXTENSION)) {
        results.push(targetPath);
      }
    }
  }

  await walk(root);
  return results;
}

function parseFrontmatter(source) {
  const normalized = String(source ?? "");
  if (!normalized.startsWith("---\n")) {
    return {
      metadata: {},
      body: normalized,
    };
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return {
      metadata: {},
      body: normalized,
    };
  }

  const rawFrontmatter = normalized.slice(4, closingIndex);
  const body = normalized.slice(closingIndex + 5).trim();
  return {
    metadata: parseSimpleFrontmatter(rawFrontmatter),
    body,
  };
}

function parseSimpleFrontmatter(frontmatter) {
  const metadata = {};
  let currentArrayKey = null;

  for (const rawLine of String(frontmatter ?? "").split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      continue;
    }

    const arrayItemMatch = line.match(/^\s*-\s+(.+)$/);
    if (arrayItemMatch && currentArrayKey) {
      metadata[currentArrayKey].push(stripWrappedString(arrayItemMatch[1]));
      continue;
    }

    const keyValueMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyValueMatch) {
      currentArrayKey = null;
      continue;
    }

    const [, key, rawValue] = keyValueMatch;
    if (!rawValue) {
      metadata[key] = [];
      currentArrayKey = key;
      continue;
    }

    metadata[key] = parseFrontmatterValue(rawValue);
    currentArrayKey = null;
  }

  return metadata;
}

function parseFrontmatterValue(value) {
  const safeValue = stripWrappedString(value.trim());
  if (/^-?\d+(\.\d+)?$/.test(safeValue)) {
    return Number(safeValue);
  }

  if (safeValue === "true") {
    return true;
  }

  if (safeValue === "false") {
    return false;
  }

  return safeValue;
}

function stripWrappedString(value) {
  return String(value ?? "").replace(/^['"]|['"]$/g, "");
}

function deriveSlugSegments(relativePath) {
  const withoutExtension = relativePath.replace(new RegExp(`${DOC_EXTENSION}$`), "");
  const segments = withoutExtension.split(path.sep).filter(Boolean);
  if (segments.at(-1) === "index") {
    segments.pop();
  }
  return normalizeSlugSegments(segments);
}

function normalizeSlugSegments(segments = []) {
  return segments
    .map((segment) => sanitizeSlug(segment))
    .filter(Boolean);
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractHeadings(body) {
  return String(body ?? "")
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,3})\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({
      depth: match[1].length,
      title: match[2].trim(),
      slug: sanitizeSlug(match[2]),
    }));
}

function stripMarkdown(body) {
  return String(body ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstParagraph(text) {
  return String(text ?? "")
    .split(/\.\s+/)
    .slice(0, 2)
    .join(". ")
    .trim();
}

function toTitleCase(value) {
  return String(value ?? "")
    .split(/[-/]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function compareVersions(left, right) {
  const leftValue = Number(String(left).replace(/[^0-9]/g, "") || 0);
  const rightValue = Number(String(right).replace(/[^0-9]/g, "") || 0);
  if (leftValue !== rightValue) {
    return leftValue - rightValue;
  }

  return String(left).localeCompare(String(right));
}

function resolveRequestedVersion(version, versions) {
  const safeVersion = String(version ?? "").trim();
  if (!safeVersion) {
    return versions[0] ?? null;
  }

  return versions.find((entry) => entry === safeVersion) ?? null;
}
