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

async function createCliConnectInstallRepo(t) {
  const { repoRoot } = await createConnectTestContext(t);
  const workspaceRoot = path.resolve(".");

  await fs.cp(fixtureRoot, repoRoot, { recursive: true });
  await fs.symlink(path.join(workspaceRoot, "packages"), path.join(repoRoot, "packages"), "dir");

  return { repoRoot };
}

function runCliExpectFailure(args) {
  try {
    execFileSync("node", args, { encoding: "utf8" });
    assert.fail("expected command to fail");
  } catch (error) {
    return error;
  }
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
  const { repoRoot } = await createCliConnectInstallRepo(t);
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
  const { repoRoot } = await createCliConnectInstallRepo(t);
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

test("CLI help includes connect commands", () => {
  const raw = execFileSync("node", [cliPath, "help"], {
    encoding: "utf8",
  });

  assert.match(raw, /heart connect detect/);
  assert.match(raw, /heart connect verify --client CLIENT/);
  assert.match(raw, /--backup/);
  assert.match(raw, /heart connect doctor/);
});
