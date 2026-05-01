import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const entryPath = path.join(repoRoot, "packages", "cli", "src", "index.js");
const distRoot = path.join(repoRoot, "packages", "cli", "dist");
const outputPath = path.join(distRoot, "index.js");
const binPath = path.join(distRoot, "heart.js");

async function main() {
  await fs.mkdir(distRoot, { recursive: true });

  await build({
    entryPoints: [entryPath],
    outfile: outputPath,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    legalComments: "none",
  });

  await fs.writeFile(
    binPath,
    `#!/usr/bin/env node
import { runCli } from "./index.js";

const exitCode = await runCli(process.argv.slice(2));
process.exit(exitCode);
`,
    "utf8",
  );

  await fs.chmod(binPath, 0o755);
  process.stderr.write(
    `Bundled CLI package entry at ${path.relative(repoRoot, outputPath)} and ${path.relative(repoRoot, binPath)}.\n`,
  );
}

await main();
