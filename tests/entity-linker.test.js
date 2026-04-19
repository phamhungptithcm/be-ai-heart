import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  LINK_TYPES,
  buildHeartModel,
  getDecisionImplementationsForDocuments,
  getLinkedModulesForDocuments,
} from "../packages/entity-linker/src/index.js";
import { scanDocumentTree } from "../packages/document-ingest/src/index.js";
import { scanSourceTree } from "../packages/parser-ts/src/index.js";

const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

test("entity linker builds module, decision, and domain relationships", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);
  const documentIndex = await scanDocumentTree(fixtureRoot, {
    roots: ["docs"],
  });
  const heartModel = buildHeartModel({
    scanResult,
    documentIndex,
  });

  assert.equal(heartModel.summary.domain_count, 1);
  assert.ok(heartModel.summary.relationship_type_counts[LINK_TYPES.documentToModule] >= 2);
  assert.ok(heartModel.summary.relationship_type_counts[LINK_TYPES.decisionToImplementation] >= 1);
  assert.ok(heartModel.summary.relationship_type_counts[LINK_TYPES.symbolToDomain] >= 6);

  const linkedModules = getLinkedModulesForDocuments(heartModel, ["docs/requirements.md"]);
  assert.equal(linkedModules[0].module, "auth");

  const decisionTargets = getDecisionImplementationsForDocuments(heartModel, ["docs/system-design.md"]);
  assert.ok(
    decisionTargets.some(
      (target) =>
        target.file_path === "src/auth/session.ts" ||
        target.target_name === "recordLoginAudit" ||
        target.target_name === "createSessionToken",
    ),
  );
});
