import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const connectSrcDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveHeartCliPath({ env = process.env, argv = process.argv } = {}) {
  const envPath = env.BE_AI_HEART_CLI_PATH;
  if (typeof envPath === "string" && envPath.trim().length > 0) {
    return path.resolve(envPath);
  }

  const argvPath = Array.isArray(argv) ? argv[1] : undefined;
  if (isLikelyHeartCliPath(argvPath)) {
    return resolveExistingPath(argvPath);
  }

  const candidates = [
    path.resolve(connectSrcDir, "../../cli/bin/heart.js"),
    path.resolve(connectSrcDir, "../../cli/dist/heart.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return resolveExistingPath(candidate);
    }
  }

  return candidates[0];
}

function isLikelyHeartCliPath(candidate) {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return false;
  }

  const resolvedPath = path.resolve(candidate);
  const baseName = path.basename(resolvedPath);
  if (baseName !== "heart" && baseName !== "heart.js") {
    return false;
  }

  return fs.existsSync(resolvedPath);
}

function resolveExistingPath(targetPath) {
  const resolvedPath = path.resolve(targetPath);
  try {
    return fs.realpathSync(resolvedPath);
  } catch {
    return resolvedPath;
  }
}
