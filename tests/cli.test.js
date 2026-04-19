import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createTempRepoCopy } from "./helpers/temp-repo.js";
import { writeTypedGraphFixture } from "./helpers/typed-graph-fixture.js";
import { writeWebDocumentSubmission } from "../packages/document-sync/src/index.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");

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
});

test("CLI diagram generate prints a single mermaid diagram", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const raw = execFileSync("node", [cliPath, "diagram", "generate", "symbol-graph", "--root", fixtureRoot], {
    encoding: "utf8",
  });

  assert.match(raw, /flowchart LR/);
  assert.match(raw, /loginUser/);
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
  assert.ok(result.persisted.report_path.endsWith(".heart/benchmarks/" + `${result.report.report_id}.json`));
  assert.equal(portalIndex.reports.length, 1);
  assert.equal(adminIndex.reports.length, 1);
  assert.equal(portalIndex.reports[0].report_id, result.report.report_id);
});

test("CLI benchmark run loads a scenario manifest and publishes benchmark artifacts", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const portalRoot = path.join(workspaceRoot, "apps", "portal");
  const adminRoot = path.join(workspaceRoot, "apps", "admin");
  const scenarioPath = path.join(workspaceRoot, "login-audit-flow.json");

  await Promise.all([
    fs.mkdir(portalRoot, { recursive: true }),
    fs.mkdir(adminRoot, { recursive: true }),
    fs.writeFile(
      scenarioPath,
      `${JSON.stringify(
        {
          id: "login-audit-flow",
          repo: "sample-repo",
          provider: "openai",
          model: "gpt-5.4",
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
  assert.equal(portalIndex.reports.length, 1);
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
