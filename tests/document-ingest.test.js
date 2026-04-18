import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { findRelevantDocuments, scanDocumentTree } from "../packages/document-ingest/src/index.js";

const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

test("document ingest scans and classifies project documents", async () => {
  const documentIndex = await scanDocumentTree(fixtureRoot, {
    roots: ["docs"],
  });

  assert.equal(documentIndex.totals.document_count, 2);
  assert.equal(documentIndex.totals.category_counts.requirements, 1);
  assert.equal(documentIndex.totals.category_counts.technical, 1);
});

test("document retrieval finds relevant documents for a task", async () => {
  const documentIndex = await scanDocumentTree(fixtureRoot, {
    roots: ["docs"],
  });
  const results = findRelevantDocuments(documentIndex, "login audit requirements");

  assert.equal(results[0].path, "docs/requirements.md");
  assert.ok(results.length >= 1);
});
