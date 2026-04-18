import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const WORKSPACE_GROUPS = ["apps", "packages", "services"];
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "coverage", ".git"]);
const CHECK_EXTENSIONS = new Set([".js", ".mjs"]);

async function main() {
  await validateWorkspaceStructure();
  const files = await collectJavaScriptFiles(ROOT_DIR);

  for (const filePath of files) {
    execFileSync("node", ["--check", filePath], { stdio: "pipe" });
  }

  process.stdout.write(
    `Build validation passed for ${files.length} JavaScript files across the scaffold.\n`,
  );
}

async function validateWorkspaceStructure() {
  for (const group of WORKSPACE_GROUPS) {
    const groupPath = path.join(ROOT_DIR, group);
    const entries = await safeReadDir(groupPath);

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const workspacePath = path.join(groupPath, entry.name);
      const packageJsonPath = path.join(workspacePath, "package.json");
      await fs.access(packageJsonPath);
    }
  }
}

async function collectJavaScriptFiles(rootDir) {
  const results = [];
  const entries = await safeReadDir(rootDir);

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectJavaScriptFiles(entryPath)));
      continue;
    }

    if (CHECK_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(entryPath);
    }
  }

  return results.sort();
}

async function safeReadDir(targetPath) {
  try {
    return await fs.readdir(targetPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

await main();
