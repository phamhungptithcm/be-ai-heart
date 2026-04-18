import path from "node:path";
import fs from "node:fs/promises";

export async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureParentDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function writeJsonFile(filePath, payload) {
  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
}

export async function writeTextFile(filePath, text) {
  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, text);
}
