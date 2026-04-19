import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createConnectTestContext } from "./helpers/connect-test-context.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");
const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

async function createCliConnectRepo(t) {
  const { repoRoot } = await createConnectTestContext(t);
  await fs.cp(fixtureRoot, repoRoot, { recursive: true });
  return { repoRoot };
}

test("CLI overview returns JSON summary", () => {
  const raw = execFileSync("node", [cliPath, "overview", "--json", "--root", fixtureRoot], {
    encoding: "utf8",
  });
  const result = JSON.parse(raw);

  assert.equal(result.file_count, 3);
  assert.equal(result.symbol_count, 6);
  assert.equal(result.parser_engine, "typescript-ast");
  assert.equal(result.document_count, 2);
});

test("CLI pack returns JSON context pack", () => {
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
});

test("CLI docs search returns relevant project documents", () => {
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
  assert.ok(result.agents.some((agent) => agent.id === "cursor"));
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
  await assert.rejects(fs.stat(targetPath));
});

test("CLI connect verify returns a ready report", async (t) => {
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
  assert.equal(result.initialize_status, "ok");
  assert.equal(result.tools_list_status, "ok");
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

test("CLI connect install rejects unsupported backup flag", async (t) => {
  const { repoRoot } = await createCliConnectRepo(t);

  assert.throws(
    () => {
      execFileSync(
        "node",
        [
          cliPath,
          "connect",
          "install",
          "--json",
          "--dry-run",
          "--backup",
          "--client",
          "continue",
          "--root",
          repoRoot,
        ],
        {
          encoding: "utf8",
        },
      );
    },
    /Unsupported flag: --backup/,
  );
});

test("CLI connect doctor returns repo diagnostics", async (t) => {
  const repoRoot = path.resolve(".");
  const raw = execFileSync("node", [cliPath, "connect", "doctor", "--json", "--root", repoRoot], {
    encoding: "utf8",
  });
  const result = JSON.parse(raw);

  assert.equal(result.repo_root, repoRoot);
  assert.equal(result.status, "ready");
  assert.ok(Array.isArray(result.warnings));
  assert.equal(result.warnings.length, 0);
});

test("CLI connect help is not a subcommand", () => {
  assert.throws(
    () => {
      execFileSync("node", [cliPath, "connect", "help"], {
        encoding: "utf8",
      });
    },
    /heart connect detect/,
  );
});

test("CLI help includes connect commands", () => {
  const raw = execFileSync("node", [cliPath, "help"], {
    encoding: "utf8",
  });

  assert.match(raw, /heart connect detect/);
  assert.match(raw, /heart connect verify --client CLIENT/);
  assert.match(raw, /heart connect doctor/);
});
