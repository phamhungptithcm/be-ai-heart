import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

let nextTimestampMs = Date.now();

export async function createTempRepoCopy(t) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-"));
  const repoRoot = path.join(tempRoot, "sample-repo");

  await fs.cp(fixtureRoot, repoRoot, { recursive: true });
  await fs.rm(path.join(repoRoot, ".heart"), { recursive: true, force: true });

  if (t?.after) {
    t.after(async () => {
      await fs.rm(tempRoot, { recursive: true, force: true });
    });
  }

  return repoRoot;
}

export async function appendFileWithFreshMtime(filePath, suffix) {
  const current = await fs.readFile(filePath, "utf8");
  await writeFileWithFreshMtime(filePath, `${current}${suffix}`);
}

export async function writeFileWithFreshMtime(filePath, content) {
  nextTimestampMs += 2_000;
  const timestamp = new Date(nextTimestampMs);

  await fs.writeFile(filePath, content, "utf8");
  await fs.utimes(filePath, timestamp, timestamp);
}
