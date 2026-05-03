import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createConnectTestContext } from "./helpers/connect-test-context.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";
import { writeTypedGraphFixture } from "./helpers/typed-graph-fixture.js";
import { writeWebDocumentSubmission } from "../packages/document-sync/src/index.js";
import {
  writeAgentRunRecord,
  writeLlmCallRecord,
} from "../services/api/src/index.js";
import { resolveServiceStorageRoot } from "../services/api/src/storage.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");
const connectFixtureRoot = path.resolve("tests/fixtures/sample-repo");

async function createCliConnectRepo(t) {
  const context = await createConnectTestContext(t);
  const { repoRoot } = context;
  await fs.cp(connectFixtureRoot, repoRoot, { recursive: true });
  return context;
}

function runCliExpectFailure(args, options = {}) {
  try {
    execFileSync("node", args, { encoding: "utf8", ...options });
    assert.fail("expected command to fail");
  } catch (error) {
    return error;
  }
}

test("CLI overview returns JSON summary", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const raw = execFileSync("node", [cliPath, "overview", "--json", "--root", fixtureRoot], {
    encoding: "utf8",
  });
  const result = JSON.parse(raw);

  assert.equal(result.file_count, 3);
  assert.equal(result.symbol_count, 6);
  assert.equal(result.parser_engine, "typescript-ast");
  assert.equal(result.document_count, 2);
});

test("CLI pack returns JSON context pack", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const raw = execFileSync(
    "node",
    [cliPath, "pack", "--json", "--root", fixtureRoot, "add", "login", "audit", "visibility"],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.task, "add login audit visibility");
  assert.ok(result.relevant_files.length >= 1);
  assert.ok(result.quality.relevance_score > 0.5);
  assert.equal(result.evidence_summary.citation_count, result.citations.length);
});

test("CLI find symbol returns matching typed symbol records", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  await writeTypedGraphFixture(fixtureRoot);
  const raw = execFileSync("node", [cliPath, "find", "symbol", "--json", "--root", fixtureRoot, "AuthService"], {
    encoding: "utf8",
  });
  const result = JSON.parse(raw);

  assert.equal(result.query, "AuthService");
  assert.equal(result.matches[0].name, "AuthService");
  assert.equal(result.matches[0].kind, "class");
});

test("CLI deps explains imports, calls, and inheritance for typed symbols", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  await writeTypedGraphFixture(fixtureRoot);
  const raw = execFileSync("node", [cliPath, "deps", "--json", "--root", fixtureRoot, "AuthService"], {
    encoding: "utf8",
  });
  const result = JSON.parse(raw);

  assert.equal(result.resolved_file, "src/auth/service.ts");
  assert.ok(result.outgoing_imports.includes("src/auth/base.ts"));
  assert.ok(result.outgoing_imports.includes("src/auth/login.ts"));
  assert.ok(result.outgoing_calls.includes("loginUser"));
  assert.ok(result.extends.includes("BaseAuthService"));
  assert.ok(result.implements.includes("AuthWorkflow"));
  assert.ok(result.evidence.some((entry) => entry.type === "IMPORTS"));
  assert.ok(result.evidence.some((entry) => entry.type === "CALLS"));
  assert.ok(Array.isArray(result.policy_violations));
  assert.ok(Array.isArray(result.document_constraints));
});

test("CLI impact uses typed graph evidence instead of import-only file analysis", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  await writeTypedGraphFixture(fixtureRoot);
  const raw = execFileSync("node", [cliPath, "impact", "--json", "--root", fixtureRoot, "loginUser"], {
    encoding: "utf8",
  });
  const result = JSON.parse(raw);

  assert.equal(result.resolved_file, "src/auth/login.ts");
  assert.ok(result.dependent_files.includes("src/auth/service.ts"));
  assert.ok(result.related_tests.includes("src/auth/login.test.ts"));
  assert.ok(result.dependent_symbols.includes("authenticate"));
  assert.ok(result.evidence.some((entry) => entry.type === "CALLS"));
  assert.ok(result.evidence.some((entry) => entry.type === "TESTED_BY"));
});

test("CLI policy check returns repo policy violations", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  await fs.mkdir(path.join(fixtureRoot, ".heart"), { recursive: true });
  await fs.writeFile(
    path.join(fixtureRoot, ".heart", "policies.yaml"),
    `rules:
  - id: auth-internal-imports
    from_prefix: src/auth/
    blocked_prefix: src/auth/
    description: auth files should not import sibling auth modules
`,
    "utf8",
  );

  const raw = execFileSync("node", [cliPath, "policy", "check", "--json", "--root", fixtureRoot], {
    encoding: "utf8",
  });
  const result = JSON.parse(raw);

  assert.equal(result.rules[0].id, "auth-internal-imports");
  assert.ok(result.violations.length >= 1);
  assert.ok(result.violations.every((violation) => violation.rule_id === "auth-internal-imports"));
  assert.ok(result.violations.some((violation) => violation.file.startsWith("src/auth/")));
});

test("CLI diagram generate prints a single mermaid diagram", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const raw = execFileSync("node", [cliPath, "diagram", "generate", "symbol-graph", "--root", fixtureRoot], {
    encoding: "utf8",
  });

  assert.match(raw, /flowchart LR/);
  assert.match(raw, /loginUser/);
});

test("CLI diagram generate prints a cross-source mindmap", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const raw = execFileSync("node", [cliPath, "diagram", "generate", "mindmap", "--root", fixtureRoot], {
    encoding: "utf8",
  });

  assert.match(raw, /^mindmap/m);
  assert.match(raw, /Business/);
  assert.match(raw, /Requirements/);
  assert.match(raw, /Code Domains/);
});

test("CLI diagram sync publishes a repository profile to custom portal and admin roots", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");

  execFileSync("mkdir", ["-p", portalRoot, adminRoot], { encoding: "utf8" });

  const raw = execFileSync(
    "node",
    [
      cliPath,
      "diagram",
      "sync",
      "--json",
      "--root",
      fixtureRoot,
      "--slug",
      "fixture-profile",
      "--portal-root",
      portalRoot,
      "--admin-root",
      adminRoot,
    ],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.profile_slug, "fixture-profile");
  assert.ok(result.synced_destinations.some((destination) => destination.kind === "portal"));
  assert.ok(result.synced_destinations.some((destination) => destination.kind === "admin"));
});

test("CLI docs search returns relevant project documents", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const raw = execFileSync(
    "node",
    [cliPath, "docs", "search", "--json", "--root", fixtureRoot, "login", "audit", "requirements"],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.query, "login audit requirements");
  assert.equal(result.matches[0].path, "docs/requirements.md");
});

test("CLI connect detect returns JSON inventory", async (t) => {
  const { repoRoot } = await createCliConnectRepo(t);
  const raw = execFileSync("node", [cliPath, "connect", "detect", "--json", "--root", repoRoot], {
    encoding: "utf8",
  });
  const result = JSON.parse(raw);

  assert.equal(result.repo_root, repoRoot);
  assert.ok(Array.isArray(result.agents));
  assert.ok(Array.isArray(result.models));
  assert.ok(Array.isArray(result.warnings));
  assert.ok(Array.isArray(result.recommendations));
  assert.ok(result.agents.every((agent) => typeof agent.id === "string"));
});

test("CLI connect install dry-run returns a plan", async (t) => {
  const { repoRoot } = await createCliConnectRepo(t);
  const targetPath = path.join(repoRoot, ".continue", "mcpServers", "heart-mcp.json");
  const raw = execFileSync(
    "node",
    [
      cliPath,
      "connect",
      "install",
      "--json",
      "--dry-run",
      "--client",
      "continue",
      "--scope",
      "repo",
      "--root",
      repoRoot,
    ],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.plan.client, "continue");
  assert.equal(result.plan.scope, "repo");
  assert.equal(result.plan.repo_root, repoRoot);
  assert.equal(result.plan.files_to_modify[0], targetPath);
  assert.equal(result.plan.mcp_entry.mcpServers[0].name, "heart-mcp");
  assert.equal(result.plan.mcp_entry.mcpServers[0].args[0], cliPath);
  await assert.rejects(fs.stat(targetPath));
});

test("CLI connect verify returns a ready report", async () => {
  const repoRoot = path.resolve(".");
  const raw = execFileSync(
    "node",
    [cliPath, "connect", "verify", "--json", "--client", "cursor", "--root", repoRoot],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.repo_root, repoRoot);
  assert.equal(result.client, "cursor");
  assert.equal(result.status, "ready");
  assert.ok(["ok", "ready"].includes(result.initialize_status));
  assert.ok(["ok", "ready"].includes(result.tools_list_status));
});

test("CLI connect verify requires a client", () => {
  assert.throws(
    () => {
      execFileSync("node", [cliPath, "connect", "verify", "--json", "--root", path.resolve(".")], {
        encoding: "utf8",
      });
    },
    /Usage: heart connect verify --client CLIENT/,
  );
});

test("CLI connect install rejects invalid scope values", async (t) => {
  const { repoRoot } = await createCliConnectRepo(t);
  const error = runCliExpectFailure([
    cliPath,
    "connect",
    "install",
    "--json",
    "--dry-run",
    "--client",
    "continue",
    "--scope",
    "typo",
    "--root",
    repoRoot,
  ]);

  assert.match(error.stderr, /Invalid --scope value: typo\. Expected repo or user\./);
  assert.doesNotMatch(error.stderr, /at .*index\.js/);
});

test("CLI connect install reports unsupported clients as a CLI error", async (t) => {
  const { repoRoot } = await createCliConnectRepo(t);
  const error = runCliExpectFailure([
    cliPath,
    "connect",
    "install",
    "--json",
    "--dry-run",
    "--client",
    "not-a-client",
    "--root",
    repoRoot,
  ]);

  assert.match(error.stderr, /Unsupported connect client: not-a-client\./);
  assert.doesNotMatch(error.stderr, /at .*index\.js/);
});

test("CLI connect verify reports unsupported clients as a CLI error", async (t) => {
  const { repoRoot } = await createCliConnectRepo(t);
  const error = runCliExpectFailure([
    cliPath,
    "connect",
    "verify",
    "--json",
    "--client",
    "not-a-client",
    "--root",
    repoRoot,
  ]);

  assert.match(error.stderr, /Unsupported connect client: not-a-client\./);
  assert.doesNotMatch(error.stderr, /at .*index\.js/);
});

test("CLI connect install creates backups when requested", async (t) => {
  const { repoRoot } = await createCliConnectRepo(t);
  const cursorConfigPath = path.join(repoRoot, ".cursor", "mcp.json");
  const originalConfig = JSON.stringify(
    {
      mcpServers: {
        existing: {
          command: "node",
          args: ["--version"],
        },
      },
    },
    null,
    2,
  );

  await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
  await fs.writeFile(cursorConfigPath, originalConfig, "utf8");

  const raw = execFileSync(
    "node",
    [
      cliPath,
      "connect",
      "install",
      "--json",
      "--backup",
      "--client",
      "cursor",
      "--scope",
      "repo",
      "--root",
      repoRoot,
    ],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.client, "cursor");
  assert.equal(result.backups.length, 1);
  assert.equal(result.backups[0].source, cursorConfigPath);
  assert.equal(result.backups[0].backup, `${cursorConfigPath}.bak`);
  assert.equal(await fs.readFile(result.backups[0].backup, "utf8"), originalConfig);
  assert.ok(JSON.parse(await fs.readFile(cursorConfigPath, "utf8")).mcpServers["heart-mcp"]);
});

test("CLI connect install reports backup failures without a stack trace", async (t) => {
  const { repoRoot } = await createCliConnectRepo(t);
  const cursorConfigPath = path.join(repoRoot, ".cursor", "mcp.json");

  await fs.mkdir(cursorConfigPath, { recursive: true });

  const error = runCliExpectFailure([
    cliPath,
    "connect",
    "install",
    "--json",
    "--backup",
    "--client",
    "cursor",
    "--scope",
    "repo",
    "--root",
    repoRoot,
  ]);

  assert.match(error.stderr, /^Connect install failed: /m);
  assert.doesNotMatch(error.stderr, /at .*index\.js/);
});

test("CLI connect verify exits non-zero and prints a failed JSON report", async (t) => {
  const { tempRoot } = await createConnectTestContext(t);
  const badRoot = path.join(tempRoot, "not-a-directory");

  await fs.writeFile(badRoot, "not a directory", "utf8");

  const error = runCliExpectFailure([
    cliPath,
    "connect",
    "verify",
    "--json",
    "--client",
    "cursor",
    "--root",
    badRoot,
  ]);
  const result = JSON.parse(error.stdout);

  assert.equal(error.status, 1);
  assert.equal(result.client, "cursor");
  assert.equal(result.repo_root, badRoot);
  assert.equal(result.status, "failed");
  assert.equal(result.initialize_status, "failed");
  assert.equal(result.tools_list_status, "failed");
  assert.ok(Array.isArray(result.warnings));
  assert.ok(result.warnings.length >= 1);
});

test("CLI connect install exits non-zero when verification fails after a user-scope install", async (t) => {
  const { tempRoot, homeRoot, env } = await createConnectTestContext(t);
  const badRoot = path.join(tempRoot, "not-a-directory");
  const cursorConfigPath = path.join(homeRoot, ".cursor", "mcp.json");

  await fs.writeFile(badRoot, "not a directory", "utf8");

  const error = runCliExpectFailure(
    [
      cliPath,
      "connect",
      "install",
      "--json",
      "--client",
      "cursor",
      "--scope",
      "user",
      "--root",
      badRoot,
    ],
    {
      env: {
        ...process.env,
        ...env,
      },
    },
  );
  const result = JSON.parse(error.stdout);
  const payload = JSON.parse(await fs.readFile(cursorConfigPath, "utf8"));

  assert.equal(error.status, 1);
  assert.equal(result.client, "cursor");
  assert.equal(result.scope, "user");
  assert.equal(result.status, "failed");
  assert.equal(result.plan.target_file, cursorConfigPath);
  assert.equal(payload.mcpServers["heart-mcp"].args[0], cliPath);
});

test("CLI connect doctor returns repo diagnostics", async (t) => {
  const { repoRoot, homeRoot } = await createCliConnectRepo(t);
  const raw = execFileSync("node", [cliPath, "connect", "doctor", "--json", "--root", repoRoot], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: homeRoot,
      USERPROFILE: homeRoot,
    },
  });
  const result = JSON.parse(raw);

  assert.equal(result.repo_root, repoRoot);
  assert.equal(result.status, "action_required");
  assert.ok(Array.isArray(result.warnings));
  assert.ok(Array.isArray(result.actions));
});

test("CLI connect help aliases return connect usage", () => {
  const helpOutput = execFileSync("node", [cliPath, "connect", "help"], {
    encoding: "utf8",
  });
  const aliasOutput = execFileSync("node", [cliPath, "connect", "--help"], {
    encoding: "utf8",
  });

  assert.match(helpOutput, /heart connect detect/);
  assert.match(aliasOutput, /heart connect detect/);
  assert.match(helpOutput, /heart connect verify --client CLIENT/);
  assert.match(aliasOutput, /heart connect verify --client CLIENT/);
  assert.doesNotMatch(helpOutput, /Unknown connect subcommand/);
  assert.doesNotMatch(aliasOutput, /Unknown connect subcommand/);
});

test("CLI scan reports cache lifecycle and supports rebuild", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);

  const created = JSON.parse(
    execFileSync("node", [cliPath, "scan", "--json", "--root", fixtureRoot], {
      encoding: "utf8",
    }),
  );
  assert.equal(created.cache.status, "created");
  assert.ok(created.heart.relationship_count > 0);
  assert.equal(created.cache.source_changes.added_file_count, 3);
  assert.equal(created.cache.document_changes.added_document_count, 2);

  const hit = JSON.parse(
    execFileSync("node", [cliPath, "scan", "--json", "--root", fixtureRoot], {
      encoding: "utf8",
    }),
  );
  assert.equal(hit.cache.status, "hit");
  assert.equal(hit.cache.source_changes.reused_file_count, 3);
  assert.equal(hit.cache.document_changes.reused_document_count, 2);

  const rebuild = JSON.parse(
    execFileSync("node", [cliPath, "scan", "--json", "--rebuild", "--root", fixtureRoot], {
      encoding: "utf8",
    }),
  );
  assert.equal(rebuild.cache.status, "rebuild");
  assert.equal(rebuild.cache.source_changes.reparsed_file_count, 3);
  assert.equal(rebuild.cache.document_changes.reparsed_document_count, 2);
});

test("CLI benchmark compare writes local report and publishes portal/admin benchmark artifacts", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const baselinePath = path.join(workspaceRoot, "baseline.json");
  const assistedPath = path.join(workspaceRoot, "assisted.json");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
    fs.writeFile(
      baselinePath,
      `${JSON.stringify({
        tokens: 2000,
        minutes: 28,
        duplicates: 4,
        policy_violations: 3,
        review_edits: 8,
        memory_refreshes: 6,
        token_cost_usd: 0.4,
      })}\n`,
      "utf8",
    ),
    fs.writeFile(
      assistedPath,
      `${JSON.stringify({
        tokens: 1200,
        minutes: 17,
        duplicates: 1,
        policy_violations: 1,
        review_edits: 3,
        memory_refreshes: 2,
        token_cost_usd: 0.24,
      })}\n`,
      "utf8",
    ),
  ]);
  execFileSync("node", [cliPath, "init", "--root", fixtureRoot], {
    encoding: "utf8",
  });

  const raw = execFileSync(
    "node",
    [
      cliPath,
      "benchmark",
      "compare",
      "--json",
      "--root",
      fixtureRoot,
      "--slug",
      "fixture-profile",
      "--scenario",
      "login-audit-flow",
      "--provider",
      "openai",
      "--model",
      "gpt-5.4",
      "--portal-root",
      portalRoot,
      "--admin-root",
      adminRoot,
      baselinePath,
      assistedPath,
    ],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);
  const portalIndex = JSON.parse(await fs.readFile(path.join(portalRoot, "public", "benchmarks", "index.json"), "utf8"));
  const adminIndex = JSON.parse(await fs.readFile(path.join(adminRoot, "public", "benchmarks", "index.json"), "utf8"));

  assert.equal(result.report.profile_slug, "fixture-profile");
  assert.equal(result.report.scenario, "login-audit-flow");
  assert.equal(result.report.provider, "openai");
  assert.equal(result.report.model, "gpt-5.4");
  assert.equal(result.report.metrics.token_savings_pct, 40);
  assert.equal(result.report.metrics.memory_refresh_reduction_pct, 67);
  assert.equal(result.report.evidence_bundle.available, true);
  assert.ok(result.persisted.report_path.endsWith(".heart/benchmarks/" + `${result.report.report_id}.json`));
  assert.ok(result.persisted.markdown_path.endsWith(".heart/benchmarks/" + `${result.report.report_id}.md`));
  assert.ok(
    result.report.evidence_bundle.local_manifest_path.endsWith(
      `.heart/benchmarks/evidence/${result.report.report_id}/manifest.json`,
    ),
  );
  assert.equal(portalIndex.reports.length, 1);
  assert.equal(adminIndex.reports.length, 1);
  assert.equal(portalIndex.reports[0].report_id, result.report.report_id);
});

test("CLI benchmark run loads a scenario manifest and publishes benchmark artifacts", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const datasetPath = path.join(workspaceRoot, "auth-audit-memory.json");
  const scenarioPath = path.join(workspaceRoot, "login-audit-flow.json");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
    fs.writeFile(
      datasetPath,
      `${JSON.stringify(
        {
          id: "auth-audit-memory",
          title: "Auth Audit Memory",
          repo_strategy: "current-repo",
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    fs.writeFile(
      scenarioPath,
      `${JSON.stringify(
        {
          id: "login-audit-flow",
          title: "Login Audit Flow",
          repo: "sample-repo",
          provider: "openai",
          model: "gpt-5.4",
          dataset: datasetPath,
          baseline: {
            tokens: 2400,
            minutes: 34,
            duplicates: 3,
            policy_violations: 2,
            review_edits: 8,
            memory_refreshes: 5,
            token_cost_usd: 0.48,
          },
          assisted: {
            tokens: 1450,
            minutes: 20,
            duplicates: 1,
            policy_violations: 0,
            review_edits: 3,
            memory_refreshes: 1,
            token_cost_usd: 0.29,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);
  execFileSync("node", [cliPath, "init", "--root", fixtureRoot], {
    encoding: "utf8",
  });

  const raw = execFileSync(
    "node",
    [
      cliPath,
      "benchmark",
      "run",
      "--json",
      "--root",
      fixtureRoot,
      "--slug",
      "fixture-profile",
      "--portal-root",
      portalRoot,
      "--admin-root",
      adminRoot,
      scenarioPath,
    ],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);
  const portalIndex = JSON.parse(await fs.readFile(path.join(portalRoot, "public", "benchmarks", "index.json"), "utf8"));

  assert.equal(result.report.profile_slug, "fixture-profile");
  assert.equal(result.report.scenario, "login-audit-flow");
  assert.equal(result.report.metrics.token_savings_pct, 40);
  assert.equal(result.report.metrics.memory_refresh_reduction_pct, 80);
  assert.equal(result.report.evidence_bundle.available, true);
  assert.equal(result.report.framework.dataset.id, "auth-audit-memory");
  assert.equal(result.report.evidence_bundle.scan_provenance.available, true);
  assert.ok(result.report.evidence_bundle.scan_provenance.config_hash);
  assert.ok(result.report.evidence_bundle.scan_provenance.ignore_paths.includes(".heart/benchmarks"));
  assert.equal(result.report.evidence_bundle.scan_provenance.repo_root, undefined);
  assert.equal(result.report.evidence_bundle.readiness.status, "ready");
  assert.equal(result.report.evidence_bundle.readiness.generated_noise_exclusion.status, "ready");
  assert.equal(result.report.evidence_bundle.readiness.repo_root, undefined);
  const localEvidenceManifest = JSON.parse(
    await fs.readFile(result.report.evidence_bundle.local_manifest_path, "utf8"),
  );
  assert.deepEqual(localEvidenceManifest.scan_provenance, result.report.evidence_bundle.scan_provenance);
  assert.deepEqual(localEvidenceManifest.readiness, result.report.evidence_bundle.readiness);
  assert.equal(portalIndex.reports.length, 1);
});

test("CLI benchmark capture writes a capture artifact for a launcher-bound run", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const datasetPath = path.join(workspaceRoot, "auth-audit-memory.json");
  const scenarioPath = path.join(workspaceRoot, "login-audit-flow.json");
  const upstreamServer = http.createServer((req, res) => {
    res.statusCode = 204;
    res.end();
  });

  await new Promise((resolve) => upstreamServer.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstreamServer.address();
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamAddress.port}/v1`;

  t.after(() => {
    upstreamServer.close();
  });

  await Promise.all([
    fs.writeFile(
      datasetPath,
      `${JSON.stringify(
        {
          id: "auth-audit-memory",
          title: "Auth Audit Memory",
          repo_strategy: "current-repo",
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    fs.writeFile(
      scenarioPath,
      `${JSON.stringify(
        {
          id: "login-audit-flow",
          title: "Login Audit Flow",
          provider: "openai",
          model: "gpt-5.4",
          dataset: datasetPath,
          baseline: {
            tokens: 2400,
            minutes: 34,
          },
          assisted: {
            tokens: 1450,
            minutes: 20,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  const raw = execFileSync(
    "node",
    [
      cliPath,
      "benchmark",
      "capture",
      "baseline",
      scenarioPath,
      "--json",
      "--root",
      fixtureRoot,
      "--slug",
      "fixture-profile",
      "--upstream-base-url",
      upstreamBaseUrl,
      "--",
      "node",
      "--input-type=module",
      "-e",
      [
        "if (!process.env.BE_AI_HEART_AGENT_RUN_ID) process.exit(2);",
        "if (process.env.BE_AI_HEART_BENCHMARK_MODE !== 'baseline') process.exit(3);",
        "if (process.env.BE_AI_HEART_BENCHMARK_SCENARIO !== 'login-audit-flow') process.exit(4);",
        "process.exit(0);",
      ].join(" "),
    ],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);
  const artifact = JSON.parse(await fs.readFile(result.artifact.capture_path, "utf8"));

  assert.equal(result.run.mode, "baseline");
  assert.equal(result.run.scenario_id, "login-audit-flow");
  assert.equal(result.command.exit_code, 0);
  assert.equal(result.summary.measurement_mode, "estimated");
  assert.equal(artifact.mode, "baseline");
  assert.equal(artifact.run.run_id, result.run.run_id);
  assert.equal(artifact.summary.measurement_mode, "estimated");
  assert.match(result.artifact.capture_path, /\/\.heart\/benchmarks\/captures\/.+\.json$/);
});

test("CLI benchmark run prefers observed agent run telemetry when run ids are supplied", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const datasetPath = path.join(workspaceRoot, "auth-audit-memory.json");
  const scenarioPath = path.join(workspaceRoot, "login-audit-flow.json");
  const serviceStorageRoot = resolveServiceStorageRoot({ repoRoot: fixtureRoot });

  await Promise.all([
    fs.writeFile(
      datasetPath,
      `${JSON.stringify(
        {
          id: "auth-audit-memory",
          title: "Auth Audit Memory",
          repo_strategy: "current-repo",
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    fs.writeFile(
      scenarioPath,
      `${JSON.stringify(
        {
          id: "login-audit-flow",
          title: "Login Audit Flow",
          provider: "openai",
          model: "gpt-5.4",
          dataset: datasetPath,
          baseline: {
            tokens: 2400,
            minutes: 34,
            duplicates: 3,
            policy_violations: 2,
            review_edits: 8,
            memory_refreshes: 5,
            token_cost_usd: 0.48,
          },
          assisted: {
            tokens: 1450,
            minutes: 20,
            duplicates: 1,
            policy_violations: 0,
            review_edits: 3,
            memory_refreshes: 1,
            token_cost_usd: 0.29,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  await Promise.all([
    writeAgentRunRecord({
      serviceStorageRoot,
      run: {
        run_id: "baseline-run-1",
        profile_slug: "fixture-profile",
        workspace_slug: "fixture-profile",
        customer_slug: "fixture-profile",
        repo: path.basename(fixtureRoot),
        scenario_id: "login-audit-flow",
        mode: "baseline",
        status: "completed",
        provider: "openai",
        model: "gpt-5.4",
        started_at: "2026-04-19T15:00:00.000Z",
        ended_at: "2026-04-19T15:30:00.000Z",
      },
    }),
    writeAgentRunRecord({
      serviceStorageRoot,
      run: {
        run_id: "assisted-run-1",
        profile_slug: "fixture-profile",
        workspace_slug: "fixture-profile",
        customer_slug: "fixture-profile",
        repo: path.basename(fixtureRoot),
        scenario_id: "login-audit-flow",
        mode: "assisted",
        status: "completed",
        provider: "openai",
        model: "gpt-5.4",
        started_at: "2026-04-19T16:00:00.000Z",
        ended_at: "2026-04-19T16:10:00.000Z",
      },
    }),
    writeLlmCallRecord({
      serviceStorageRoot,
      call: {
        llm_call_id: "baseline-call-1",
        run_id: "baseline-run-1",
        sequence: 1,
        provider: "openai",
        model: "gpt-5.4",
        request_kind: "chat_completions",
        method: "POST",
        path: "/chat/completions",
        status_code: 200,
        latency_ms: 1250,
        prompt_tokens: 1000,
        completion_tokens: 400,
        total_tokens: 1400,
        cost_usd: 0.18,
        usage_available: true,
      },
    }),
    writeLlmCallRecord({
      serviceStorageRoot,
      call: {
        llm_call_id: "assisted-call-1",
        run_id: "assisted-run-1",
        sequence: 1,
        provider: "openai",
        model: "gpt-5.4",
        request_kind: "chat_completions",
        method: "POST",
        path: "/chat/completions",
        status_code: 200,
        latency_ms: 900,
        prompt_tokens: 500,
        completion_tokens: 200,
        total_tokens: 700,
        cost_usd: 0.08,
        usage_available: true,
      },
    }),
  ]);

  const raw = execFileSync(
    "node",
    [
      cliPath,
      "benchmark",
      "run",
      "--json",
      "--root",
      fixtureRoot,
      "--slug",
      "fixture-profile",
      "--baseline-run",
      "baseline-run-1",
      "--assisted-run",
      "assisted-run-1",
      scenarioPath,
    ],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.report.baseline.tokens, 1400);
  assert.equal(result.report.assisted.tokens, 700);
  assert.equal(result.report.baseline.minutes, 30);
  assert.equal(result.report.assisted.minutes, 10);
  assert.equal(result.report.baseline.token_cost_usd, 0.18);
  assert.equal(result.report.assisted.token_cost_usd, 0.08);
  assert.equal(result.report.baseline.measurement.mode, "observed");
  assert.equal(result.report.assisted.measurement.mode, "observed");
  assert.equal(result.report.baseline.measurement.run_id, "baseline-run-1");
  assert.equal(result.report.assisted.measurement.run_id, "assisted-run-1");
  assert.equal(result.report.metrics.token_savings_pct, 50);
  assert.equal(result.report.metrics.time_savings_pct, 67);

  await writeAgentRunRecord({
    serviceStorageRoot,
    run: {
      run_id: "estimated-baseline-run",
      profile_slug: "fixture-profile",
      workspace_slug: "fixture-profile",
      customer_slug: "fixture-profile",
      repo: path.basename(fixtureRoot),
      scenario_id: "login-audit-flow",
      mode: "baseline",
      status: "completed",
      provider: "openai",
      model: "gpt-5.4",
      started_at: "2026-04-19T17:00:00.000Z",
      ended_at: "2026-04-19T17:01:00.000Z",
    },
  });
  const incompleteObservedError = runCliExpectFailure([
    cliPath,
    "benchmark",
    "run",
    "--json",
    "--root",
    fixtureRoot,
    "--slug",
    "fixture-profile",
    "--baseline-run",
    "estimated-baseline-run",
    "--assisted-run",
    "assisted-run-1",
    scenarioPath,
  ]);
  assert.match(String(incompleteObservedError.stderr), /fully observed usage/);

  await Promise.all([
    writeAgentRunRecord({
      serviceStorageRoot,
      run: {
        run_id: "wrong-scenario-baseline-run",
        profile_slug: "fixture-profile",
        workspace_slug: "fixture-profile",
        customer_slug: "fixture-profile",
        repo: path.basename(fixtureRoot),
        scenario_id: "wrong-scenario",
        mode: "baseline",
        status: "completed",
        provider: "openai",
        model: "gpt-5.4",
        started_at: "2026-04-19T18:00:00.000Z",
        ended_at: "2026-04-19T18:05:00.000Z",
      },
    }),
    writeLlmCallRecord({
      serviceStorageRoot,
      call: {
        llm_call_id: "wrong-scenario-call-1",
        run_id: "wrong-scenario-baseline-run",
        sequence: 1,
        provider: "openai",
        model: "gpt-5.4",
        request_kind: "chat_completions",
        method: "POST",
        path: "/chat/completions",
        status_code: 200,
        latency_ms: 100,
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cost_usd: 0.02,
        usage_available: true,
      },
    }),
  ]);
  const scenarioMismatchError = runCliExpectFailure([
    cliPath,
    "benchmark",
    "run",
    "--json",
    "--root",
    fixtureRoot,
    "--slug",
    "fixture-profile",
    "--baseline-run",
    "wrong-scenario-baseline-run",
    "--assisted-run",
    "assisted-run-1",
    scenarioPath,
  ]);
  assert.match(String(scenarioMismatchError.stderr), /does not match benchmark scenario login-audit-flow/);
});

test("CLI benchmark run --all executes the full local suite and writes a suite report", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const benchmarkRoot = path.join(fixtureRoot, "benchmarks");
  const datasetRoot = path.join(fixtureRoot, "benchmarks", "datasets");
  const scenarioRoot = path.join(fixtureRoot, "benchmarks", "scenarios");

  await fs.mkdir(benchmarkRoot, { recursive: true });
  await Promise.all([fs.mkdir(datasetRoot, { recursive: true }), fs.mkdir(scenarioRoot, { recursive: true })]);

  await Promise.all([
    fs.writeFile(
      path.join(datasetRoot, "shared.json"),
      `${JSON.stringify(
        {
          id: "shared",
          title: "Shared Dataset",
          repo_strategy: "current-repo",
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    fs.writeFile(
      path.join(scenarioRoot, "a.json"),
      `${JSON.stringify(
        {
          id: "a",
          title: "Scenario A",
          dataset_id: "shared",
          baseline: { tokens: 120, minutes: 12, duplicates: 1, review_edits: 2, memory_refreshes: 2 },
          assisted: { tokens: 80, minutes: 8, duplicates: 0, review_edits: 1, memory_refreshes: 1 },
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    fs.writeFile(
      path.join(scenarioRoot, "b.json"),
      `${JSON.stringify(
        {
          id: "b",
          title: "Scenario B",
          dataset_id: "shared",
          baseline: { tokens: 220, minutes: 18, duplicates: 2, review_edits: 3, memory_refreshes: 2 },
          assisted: { tokens: 140, minutes: 10, duplicates: 1, review_edits: 1, memory_refreshes: 1 },
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  const raw = execFileSync(
    "node",
    [cliPath, "benchmark", "run", "--all", "--json", "--root", fixtureRoot, "--slug", "fixture-profile"],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.suite.scenario_count, 2);
  assert.equal(result.scenario_reports.length, 2);
  assert.ok(result.suite.aggregate_metrics.avg_token_savings_pct > 0);
  assert.ok(result.suite_persisted.report_path.endsWith(".json"));
  assert.ok(result.suite_persisted.markdown_path.endsWith(".md"));
});

test("CLI agent run binds a spawned command to the proxy launcher environment", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const upstreamServer = http.createServer((req, res) => {
    res.statusCode = 204;
    res.end();
  });

  await new Promise((resolve) => upstreamServer.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstreamServer.address();
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamAddress.port}/v1`;

  t.after(() => {
    upstreamServer.close();
  });

  const raw = execFileSync(
    "node",
    [
      cliPath,
      "agent",
      "run",
      "--json",
      "--root",
      fixtureRoot,
      "--slug",
      "fixture-profile",
      "--scenario",
      "login-audit-flow",
      "--mode",
      "baseline",
      "--provider",
      "openai",
      "--model",
      "gpt-5.4",
      "--upstream-base-url",
      upstreamBaseUrl,
      "--",
      "node",
      "--input-type=module",
      "-e",
      [
        "if (!process.env.OPENAI_BASE_URL || !process.env.OPENAI_BASE_URL.includes('/proxy/openai/runs/')) process.exit(2);",
        "if (process.env.OPENAI_API_BASE !== process.env.OPENAI_BASE_URL) process.exit(3);",
        "if (process.env.OPENAI_API_BASE_URL !== process.env.OPENAI_BASE_URL) process.exit(4);",
        "process.exit(0);",
      ].join(" "),
    ],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.run.mode, "baseline");
  assert.equal(result.run.scenario_id, "login-audit-flow");
  assert.equal(result.command.exit_code, 0);
  assert.equal(result.summary.measurement_mode, "estimated");
  assert.equal(result.summary.total_tokens, 0);
  assert.match(result.proxy.base_url, /\/proxy\/openai\/runs\/.+\/v1$/);
});

test("CLI service export writes a canonical migration snapshot", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const exportPath = path.join(workspaceRoot, "service-export.json");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
  ]);

  execFileSync(
    "node",
    [
      cliPath,
      "diagram",
      "sync",
      "--json",
      "--root",
      fixtureRoot,
      "--slug",
      "fixture-profile",
      "--portal-root",
      portalRoot,
      "--admin-root",
      adminRoot,
    ],
    {
      encoding: "utf8",
    },
  );

  const raw = execFileSync(
    "node",
    [cliPath, "service", "export", "--json", "--root", fixtureRoot, "--out", exportPath],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);
  const snapshot = JSON.parse(await fs.readFile(exportPath, "utf8"));

  assert.equal(result.output_path, exportPath);
  assert.equal(snapshot.source.driver, "sqlite");
  assert.ok(snapshot.tables.repository_profiles.length >= 1);
  assert.ok(snapshot.tables.workspace_identities.length >= 1);
  assert.ok(result.table_counts.sessions >= 2);
});

test("CLI docs import writes imported document and publishes document artifacts to portal and admin", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const sourceDocumentPath = path.join(workspaceRoot, "business-brief.md");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
    fs.writeFile(sourceDocumentPath, "# Business Brief\n\nDrive safer AI rollout.\n", "utf8"),
  ]);

  const raw = execFileSync(
    "node",
    [
      cliPath,
      "docs",
      "import",
      "--json",
      "--root",
      fixtureRoot,
      "--slug",
      "fixture-profile",
      "--category",
      "business",
      "--title",
      "Business Brief",
      "--summary",
      "Drive safer AI rollout.",
      "--portal-root",
      portalRoot,
      "--admin-root",
      adminRoot,
      sourceDocumentPath,
    ],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);
  const portalDocumentsIndex = JSON.parse(
    await fs.readFile(path.join(portalRoot, "public", "documents", "index.json"), "utf8"),
  );
  const adminDocumentsIndex = JSON.parse(
    await fs.readFile(path.join(adminRoot, "public", "documents", "index.json"), "utf8"),
  );

  assert.ok(result.imported_path.endsWith(path.join(".heart", "imported-documents", "local", "business-brief.json")));
  assert.equal(result.document_count >= 1, true);
  assert.equal(result.synced_destinations.length, 2);
  assert.equal(portalDocumentsIndex.repositories.length, 1);
  assert.equal(adminDocumentsIndex.repositories.length, 1);
  assert.equal(portalDocumentsIndex.repositories[0].profile_slug, "fixture-profile");
});

test("CLI docs sync-web imports queued web submissions for the target profile and republishes documents", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
  ]);

  await writeWebDocumentSubmission({
    portalRoot,
    adminRoot,
    submission: {
      profile_slug: "fixture-profile",
      title: "Checkout PRD",
      category: "requirements",
      summary: "Clarify acceptance criteria.",
      body: "The new checkout flow must preserve audit visibility.",
    },
  });
  await writeWebDocumentSubmission({
    portalRoot,
    adminRoot,
    submission: {
      profile_slug: "other-profile",
      title: "Other repo note",
      category: "business",
      summary: "Should not import here.",
      body: "Ignore for fixture-profile.",
    },
  });

  const raw = execFileSync(
    "node",
    [
      cliPath,
      "docs",
      "sync-web",
      "--json",
      "--root",
      fixtureRoot,
      "--slug",
      "fixture-profile",
      "--portal-root",
      portalRoot,
      "--admin-root",
      adminRoot,
    ],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);
  const importedDocument = JSON.parse(
    await fs.readFile(
      path.join(fixtureRoot, ".heart", "imported-documents", "web", "fixture-profile-checkout-prd.json"),
      "utf8",
    ),
  );
  const portalRepositoryDocuments = JSON.parse(
    await fs.readFile(path.join(portalRoot, "public", "documents", "repositories", "fixture-profile.json"), "utf8"),
  );

  assert.equal(result.imported_count, 1);
  assert.equal(result.matched_profile_slug, "fixture-profile");
  assert.equal(result.synced_destinations.length, 2);
  assert.equal(importedDocument.title, "Checkout PRD");
  assert.ok(portalRepositoryDocuments.documents.some((document) => document.title === "Checkout PRD"));
  assert.ok(portalRepositoryDocuments.documents.every((document) => document.title !== "Other repo note"));
});
