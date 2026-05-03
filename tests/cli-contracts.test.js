import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createTempRepoCopy } from "./helpers/temp-repo.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");

function runCli(args, options = {}) {
  return spawnSync("node", [cliPath, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

async function createUninitializedRepo(t) {
  const fixtureRoot = await createTempRepoCopy(t);
  await fs.rm(path.join(fixtureRoot, "heart.config.yaml"), { force: true });
  return fixtureRoot;
}

test("CLI init creates config and policy scaffolding with detected environment metadata", async (t) => {
  const fixtureRoot = await createUninitializedRepo(t);
  const result = runCli(["init", "--json", "--root", fixtureRoot]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, "created");
  assert.equal(payload.created, true);
  assert.deepEqual(payload.created_files, {
    config: true,
    policy: true,
  });
  assert.equal(payload.repo_root, fixtureRoot);
  assert.equal(payload.detected.primary_language, "typescript");
  assert.equal(payload.detected.runtime, "node");
  assert.equal(payload.config_path, path.join(fixtureRoot, "heart.config.yaml"));
  assert.equal(payload.policy_path, path.join(fixtureRoot, ".heart", "policies.yaml"));
  assert.ok(payload.next_commands.some((command) => command.includes("heart doctor")));
});

test("CLI init repairs missing policy scaffolding without overwriting existing config", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  await fs.writeFile(
    path.join(fixtureRoot, "heart.config.yaml"),
    `project:
  name: sample-repo
`,
    "utf8",
  );
  const result = runCli(["init", "--json", "--root", fixtureRoot]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, "updated");
  assert.equal(payload.created, true);
  assert.deepEqual(payload.created_files, {
    config: false,
    policy: true,
  });
  await assert.doesNotReject(fs.access(payload.config_path));
  await assert.doesNotReject(fs.access(payload.policy_path));
});

test("CLI doctor returns deterministic preflight diagnostics", async (t) => {
  const fixtureRoot = await createUninitializedRepo(t);

  assert.equal(runCli(["init", "--root", fixtureRoot]).status, 0);
  const result = runCli(["doctor", "--json", "--root", fixtureRoot]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, "ready");
  assert.equal(payload.summary.warning_count, 0);
  assert.equal(payload.repo_root, fixtureRoot);
  assert.equal(payload.config.status, "loaded");
  assert.equal(payload.policy.status, "loaded");
  assert.ok(payload.document_roots.includes("docs"));
  assert.ok(payload.ignore_paths.includes("node_modules"));
  assert.ok(Array.isArray(payload.mcp.effective_enabled_tools));
  assert.ok(Array.isArray(payload.actions));
  assert.equal(payload.first_run.schema_version, 1);
  assert.deepEqual(
    payload.first_run.steps.map((step) => step.id),
    ["init", "doctor", "scan", "overview", "pack", "mcp_serve"],
  );
  assert.ok(payload.first_run.next_command.includes("heart scan") || payload.first_run.next_command.includes("heart overview"));
});

test("CLI doctor human output includes first-run checklist", async (t) => {
  const fixtureRoot = await createUninitializedRepo(t);

  assert.equal(runCli(["init", "--root", fixtureRoot]).status, 0);
  const result = runCli(["doctor", "--root", fixtureRoot]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^First-run:/m);
  assert.match(result.stdout, /\[done\] init: heart init --root /);
  assert.match(result.stdout, /\[done\] doctor: heart doctor --root /);
  assert.match(result.stdout, /pack: heart pack --root .*"your task"/);
  assert.match(result.stdout, /mcp_serve: heart mcp serve --root /);
});

test("CLI doctor reports effective default ignores plus configured document roots", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);

  await Promise.all([
    fs.mkdir(path.join(fixtureRoot, ".heart"), { recursive: true }),
    fs.mkdir(path.join(fixtureRoot, "generated"), { recursive: true }),
    fs.mkdir(path.join(fixtureRoot, "notes"), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(
      path.join(fixtureRoot, ".heart", "policies.yaml"),
      `rules:
  - id: fixture-policy
    description: fixture policy
`,
      "utf8",
    ),
    fs.writeFile(path.join(fixtureRoot, "generated", "artifact.ts"), "export const generated = true;\n", "utf8"),
    fs.writeFile(path.join(fixtureRoot, "notes", "requirements.md"), "# Notes\n\nConfig-selected docs.\n", "utf8"),
    fs.writeFile(
      path.join(fixtureRoot, "heart.config.yaml"),
      `project:
  name: sample-repo
  ignore:
    - generated
knowledge:
  document_paths:
    - notes
`,
      "utf8",
    ),
  ]);

  const result = runCli(["doctor", "--json", "--root", fixtureRoot]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.document_roots, ["notes", ".heart/imported-documents"]);
  assert.ok(payload.ignore_paths.includes("generated"));
  assert.ok(payload.ignore_paths.includes(".next"));
  assert.ok(payload.ignore_paths.includes(".heart/cache"));
  assert.ok(payload.ignore_paths.includes("vendor"));
  assert.equal(payload.parser.source_file_count, 3);
});

test("CLI overview exposes reusable index readiness", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  assert.equal(runCli(["init", "--root", fixtureRoot]).status, 0);
  const result = runCli(["overview", "--json", "--root", fixtureRoot]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.readiness.schema_version, 1);
  assert.equal(payload.readiness.status, "ready");
  assert.equal(payload.readiness.config_status, "loaded");
  assert.equal(payload.readiness.policy_status, "loaded");
  assert.equal(payload.readiness.generated_noise_exclusion.status, "ready");
  assert.equal(payload.readiness.cache.status, "created");
  assert.equal(payload.readiness.parser.engine, "typescript-ast");
  assert.equal(payload.readiness.documents.count, payload.document_count);
});

test("CLI overview human output is concise and action-oriented", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  assert.equal(runCli(["init", "--root", fixtureRoot]).status, 0);
  const result = runCli(["overview", "--root", fixtureRoot]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^Overview: sample-repo/m);
  assert.match(result.stdout, /^Memory:/m);
  assert.match(result.stdout, /^Docs\/spec:/m);
  assert.match(result.stdout, /^Next:/m);
  assert.doesNotMatch(result.stdout, /^readiness: \{/m);
});

test("CLI connect detect and doctor expose stable contracts", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-connect-"));

  t.after(async () => {
    await fs.rm(fakeHome, { recursive: true, force: true });
  });

  const env = {
    HOME: fakeHome,
    USERPROFILE: fakeHome,
  };

  const detectResult = runCli(["connect", "detect", "--json", "--root", fixtureRoot], { env });
  assert.equal(detectResult.status, 0);
  const detectPayload = JSON.parse(detectResult.stdout);
  assert.equal(detectPayload.repo_root, fixtureRoot);
  assert.ok(Array.isArray(detectPayload.agents));
  assert.ok(Array.isArray(detectPayload.models));
  assert.ok(Array.isArray(detectPayload.warnings));
  assert.ok(Array.isArray(detectPayload.recommendations));

  const doctorResult = runCli(["connect", "doctor", "--json", "--root", fixtureRoot], { env });
  assert.equal(doctorResult.status, 0);
  const doctorPayload = JSON.parse(doctorResult.stdout);
  assert.equal(doctorPayload.repo_root, fixtureRoot);
  assert.ok(Array.isArray(doctorPayload.inventory.agents));
  assert.equal(doctorPayload.status, "action_required");
  assert.ok(doctorPayload.actions.length >= 1);
});

test("CLI connect install --dry-run returns a plan and verify succeeds after install", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-connect-cli-"));

  t.after(async () => {
    await fs.rm(fakeHome, { recursive: true, force: true });
  });

  const env = {
    HOME: fakeHome,
    USERPROFILE: fakeHome,
  };

  const dryRun = runCli(
    ["connect", "install", "--json", "--dry-run", "--client", "cursor", "--scope", "repo", "--root", fixtureRoot],
    { env },
  );
  assert.equal(dryRun.status, 0);
  const dryRunPayload = JSON.parse(dryRun.stdout);
  assert.equal(dryRunPayload.plan.client, "cursor");
  assert.equal(dryRunPayload.plan.scope, "repo");

  const install = runCli(
    ["connect", "install", "--json", "--client", "cursor", "--scope", "repo", "--root", fixtureRoot],
    { env },
  );
  assert.equal(install.status, 0);
  const installPayload = JSON.parse(install.stdout);
  assert.equal(installPayload.status, "ready");

  const verify = runCli(
    ["connect", "verify", "--json", "--client", "cursor", "--scope", "repo", "--root", fixtureRoot],
    { env },
  );
  assert.equal(verify.status, 0);
  const verifyPayload = JSON.parse(verify.stdout);
  assert.equal(verifyPayload.status, "ready");
  assert.ok(["ok", "ready"].includes(verifyPayload.tools_list_status));
});

test("CLI fails fast on unknown flags", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const result = runCli(["overview", "--bogus", "--root", fixtureRoot]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown flag: --bogus/);
});

test("CLI validates typed flag values for token budget", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);

  for (const invalidValue of ["nope", "0"]) {
    const result = runCli(["pack", "--json", "--root", fixtureRoot, "--token-budget", invalidValue, "login", "audit"]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /--token-budget must be a positive integer/);
  }
});

test("CLI validates numeric flag values instead of silently accepting NaN", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const result = runCli([
    "agent",
    "run",
    "--root",
    fixtureRoot,
    "--input-cost-per-1m",
    "nope",
    "--upstream-base-url",
    "http://127.0.0.1:8787/v1",
    "--",
    "echo",
    "hi",
  ]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--input-cost-per-1m must be a non-negative number/);
});

test("CLI rejects negative benchmark pricing flags", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const result = runCli([
    "benchmark",
    "capture",
    "baseline",
    "login-audit-flow",
    "--root",
    fixtureRoot,
    "--output-cost-per-1m",
    "-1",
    "--upstream-base-url",
    "http://127.0.0.1:8787/v1",
    "--",
    "echo",
    "hi",
  ]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--output-cost-per-1m must be a non-negative number/);
});

test("CLI requires paired observed benchmark run ids", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const result = runCli([
    "benchmark",
    "run",
    "--root",
    fixtureRoot,
    "--baseline-run",
    "baseline-run-1",
    "login-audit-flow",
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Both --baseline-run and --assisted-run are required/);
});

test("CLI returns empty matches for find symbol when nothing is found", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const result = runCli(["find", "symbol", "--json", "--root", fixtureRoot, "DefinitelyMissingSymbol"]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.query, "DefinitelyMissingSymbol");
  assert.deepEqual(payload.matches, []);
});

test("CLI signals not-found targets for deps and impact without mixing prose into json", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);

  for (const command of ["deps", "impact"]) {
    const result = runCli([command, "--json", "--root", fixtureRoot, "DefinitelyMissingTarget"]);
    assert.equal(result.status, 3);
    assert.equal(result.stderr, "");
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.target, "DefinitelyMissingTarget");
    assert.equal(payload.found, false);
    assert.equal(payload.status, "not_found");
  }
});

test("CLI mcp tools respects mcp.enabled_tools filtering in json output", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  await fs.writeFile(
    path.join(fixtureRoot, "heart.config.yaml"),
    `mcp:
  enabled_tools:
    - project_overview
    - context_pack
`,
    "utf8",
  );

  const result = runCli(["mcp", "tools", "--json", "--root", fixtureRoot]);

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.enabled_tools, ["project_overview", "context_pack"]);
  assert.ok(payload.disabled_tools.includes("dependency_explain"));
  assert.deepEqual(payload.tools.map((tool) => tool.name), ["project_overview", "context_pack"]);
});

test("CLI connect detect human output is concise and action-oriented", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-connect-human-"));

  t.after(async () => {
    await fs.rm(fakeHome, { recursive: true, force: true });
  });

  const result = runCli(["connect", "detect", "--root", fixtureRoot], {
    env: {
      HOME: fakeHome,
      USERPROFILE: fakeHome,
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Connect/);
  assert.match(result.stdout, /Next:/);
  assert.doesNotMatch(result.stdout, /repo_root:/);
});

test("CLI default help is compact and grouped around first-run flow", () => {
  const result = runCli([]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Start here/i);
  assert.match(result.stdout, /Core commands/i);
  assert.match(result.stdout, /heart init/);
  assert.match(result.stdout, /heart doctor/);
  assert.match(result.stdout, /heart pack/);
  assert.match(result.stdout, /heart connect detect/);
  assert.match(result.stdout, /heart mcp/);
  assert.doesNotMatch(result.stdout, /Additional Commands/);
});

test("CLI supports per-command help without treating --help as an invalid flag", () => {
  const result = runCli(["pack", "--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /heart pack/);
});
