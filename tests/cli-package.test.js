import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cliPackageRoot = path.resolve("packages/cli");
const fixtureRepoRoot = path.resolve("tests/fixtures/sample-repo");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
}

test("CLI package installs from a tarball and exposes heart outside the monorepo", async (t) => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-cli-package-"));
  const installRoot = path.join(workspaceRoot, "install");

  await fs.mkdir(installRoot, { recursive: true });

  t.after(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  const packResult = run("npm", ["pack", "--json"], {
    cwd: cliPackageRoot,
  });

  assert.equal(packResult.status, 0, packResult.stderr || packResult.stdout);
  const packPayload = JSON.parse(packResult.stdout);
  const tarballPath = path.join(cliPackageRoot, packPayload[0].filename);

  t.after(async () => {
    await fs.rm(tarballPath, { force: true });
  });

  const initResult = run("npm", ["init", "-y"], {
    cwd: installRoot,
  });
  assert.equal(initResult.status, 0, initResult.stderr || initResult.stdout);

  const installResult = run("npm", ["install", "--no-package-lock", tarballPath], {
    cwd: installRoot,
  });
  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);

  const heartBinPath = path.join(installRoot, "node_modules", ".bin", "heart");
  const helpResult = run(heartBinPath, ["--help"], {
    cwd: installRoot,
  });

  assert.equal(helpResult.status, 0, helpResult.stderr || helpResult.stdout);
  assert.match(helpResult.stdout, /^BeHeart CLI\b/m);
  assert.match(helpResult.stdout, /^\s+heart\s+init/m);
  assert.match(helpResult.stdout, /Start here/);

  const repoRoot = path.join(workspaceRoot, "repo");
  await fs.cp(fixtureRepoRoot, repoRoot, { recursive: true });

  const connectPlanResult = run(
    heartBinPath,
    ["connect", "install", "--json", "--dry-run", "--client", "cursor", "--scope", "repo", "--root", repoRoot],
    {
      cwd: installRoot,
    },
  );

  assert.equal(connectPlanResult.status, 0, connectPlanResult.stderr || connectPlanResult.stdout);
  const connectPlan = JSON.parse(connectPlanResult.stdout);
  assert.equal(path.isAbsolute(connectPlan.plan.mcp_entry.args[0]), true);
  assert.match(connectPlan.plan.mcp_entry.args[0], /node_modules\/beheart\/dist\/heart\.js$/);
  assert.ok(!connectPlan.plan.mcp_entry.args[0].includes("packages/cli/bin/heart.js"));
});
