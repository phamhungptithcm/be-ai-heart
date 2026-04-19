import fs from "node:fs";
import path from "node:path";

export function resolveMonorepoRoot({ startDir = process.cwd(), fallbackDir = startDir } = {}) {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (looksLikeMonorepoRoot(currentDir)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return path.resolve(fallbackDir);
}

function looksLikeMonorepoRoot(candidateDir) {
  const packageJsonPath = path.join(candidateDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    if (packageJson.name === "be-ai-heart") {
      return true;
    }
  } catch {
    return false;
  }

  return fs.existsSync(path.join(candidateDir, "apps")) && fs.existsSync(path.join(candidateDir, "packages"));
}
