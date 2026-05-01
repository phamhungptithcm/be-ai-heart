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

test("entity linker builds sparse domain relationships with provenance", () => {
  const heartModel = buildHeartModel({
    scanResult: {
      files: [
        {
          relativePath: "src/auth/login.ts",
          imports: ["../audit/trail"],
          import_details: [
            {
              specifier: "../audit/trail",
              imported_names: ["recordLoginAudit"],
              default_import: null,
              namespace_import: null,
              source_kind: "import",
            },
          ],
          calls: [
            {
              from_symbol_id: "sym:function:src/auth/login.ts:loginUser",
              from_symbol_name: "loginUser",
              from_kind: "function",
              to_name: "recordLoginAudit",
              expression: "recordLoginAudit",
              line: 4,
            },
          ],
          symbols: [
            {
              id: "sym:function:src/auth/login.ts:loginUser",
              kind: "function",
              name: "loginUser",
              exported: true,
              signature: "loginUser(username: string)",
            },
          ],
        },
        {
          relativePath: "src/audit/trail.ts",
          imports: [],
          import_details: [],
          calls: [],
          symbols: [
            {
              id: "sym:function:src/audit/trail.ts:recordLoginAudit",
              kind: "function",
              name: "recordLoginAudit",
              exported: true,
              signature: "recordLoginAudit(username: string)",
            },
          ],
        },
      ],
    },
    documentIndex: {
      documents: [
        {
          path: "docs/requirements.md",
          category: "requirements",
          title: "Login Audit Requirements",
          headings: ["Requirements"],
          summary: "Keep auth as the implementation anchor and reuse the audit trail path.",
        },
      ],
    },
  });

  const relationship = heartModel.links.find((link) => link.type === LINK_TYPES.domainToDomain);

  assert.ok(relationship);
  assert.equal(relationship.from, "domain:auth");
  assert.equal(relationship.to, "domain:audit");
  assert.equal(relationship.metadata.provenance, "EXTRACTED");
  assert.deepEqual(relationship.metadata.relationship_kinds, ["calls", "imports"]);
  assert.equal(relationship.metadata.evidence_count, 2);
  assert.equal(relationship.metadata.import_count, 1);
  assert.equal(relationship.metadata.call_count, 1);
});
