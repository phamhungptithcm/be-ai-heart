import fs from "node:fs/promises";
import path from "node:path";
import { scanSourceTree } from "../../parser-ts/src/index.js";

const EXTENSION_LANGUAGE_MAP = Object.freeze({
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
});

export async function detectProjectEnvironment(repoRoot, options = {}) {
  const scanResult = options.scanResult ?? (await scanSourceTree(repoRoot, { ignore: options.ignore }));
  const languageCounts = new Map();

  for (const file of scanResult.files ?? []) {
    const extension = path.extname(file.relativePath).toLowerCase();
    const language = EXTENSION_LANGUAGE_MAP[extension];
    if (!language) {
      continue;
    }

    languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
  }

  const languages = [...languageCounts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([language]) => language);
  const primaryLanguage = languages[0] ?? "unknown";
  const runtime = await detectRuntime(repoRoot, languages);

  return {
    primary_language: primaryLanguage,
    languages,
    runtime,
    parser_engine: scanResult.parser_engine,
    source_file_count: scanResult.totals?.file_count ?? 0,
  };
}

async function detectRuntime(repoRoot, languages) {
  if (languages.includes("typescript") || languages.includes("javascript")) {
    return "node";
  }

  try {
    await fs.access(path.join(repoRoot, "package.json"));
    return "node";
  } catch {
    return "unknown";
  }
}
