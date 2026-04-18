import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

const cliPath = path.resolve("packages/cli/bin/heart.js");
const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

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
