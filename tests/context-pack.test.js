import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { compileContextPack } from "../packages/context-compiler/src/index.js";
import { buildHeartModel } from "../packages/entity-linker/src/index.js";
import { buildProjectGraph } from "../packages/graph/src/index.js";
import { scanDocumentTree } from "../packages/document-ingest/src/index.js";
import { scanSourceTree } from "../packages/parser-ts/src/index.js";
import { evaluatePolicyViolations } from "../packages/policy-engine/src/index.js";

const fixtureRoot = path.resolve("tests/fixtures/sample-repo");

test("context compiler returns relevant files and reuse candidates", async () => {
  const scanResult = await scanSourceTree(fixtureRoot);
  const documentIndex = await scanDocumentTree(fixtureRoot, {
    roots: ["docs"],
  });
  const graph = buildProjectGraph(scanResult, { repoName: "sample-repo" });
  const heartModel = buildHeartModel({
    scanResult,
    documentIndex,
  });
  const policyReport = evaluatePolicyViolations(scanResult);
  const pack = compileContextPack({
    task: "improve login audit flow",
    graph,
    documentIndex,
    heartModel,
    policyReport,
  });

  assert.equal(pack.task, "improve login audit flow");
  assert.ok(pack.relevant_files.length >= 1);
  assert.ok(pack.relevant_symbols.some((symbol) => symbol.name === "loginUser"));
  assert.ok(pack.relevant_symbols.some((symbol) => symbol.name === "buildAuditMessage"));
  assert.equal(pack.relevant_documents[0].path, "docs/requirements.md");
  assert.equal(pack.linked_context.modules[0].module, "auth");
  assert.ok(pack.reuse_candidates.some((candidate) => candidate.name === "recordLoginAudit"));
  assert.ok(pack.quality.relevance_score > 0.5);
  assert.ok(pack.quality.reuse_confidence > 0.4);
  assert.ok(pack.quality.architecture_confidence > 0.4);
});

test("context compiler uses linked modules when the task is document-heavy", () => {
  const graph = {
    scanResult: {
      files: [
        {
          relativePath: "src/auth/session.ts",
          symbols: [
            {
              id: "sym:function:src/auth/session.ts:recordLoginAudit",
              name: "recordLoginAudit",
              kind: "function",
              signature: "recordLoginAudit(username: string)",
              exported: true,
            },
          ],
        },
        {
          relativePath: "src/billing/invoice.ts",
          symbols: [
            {
              id: "sym:function:src/billing/invoice.ts:sendInvoice",
              name: "sendInvoice",
              kind: "function",
              signature: "sendInvoice(invoiceId: string)",
              exported: true,
            },
          ],
        },
      ],
    },
  };
  const documentIndex = {
    documents: [
      {
        path: "docs/requirements.md",
        category: "requirements",
        title: "Implementation Anchor Requirements",
        headings: ["Requirements"],
        summary: "Keep the auth module as the implementation anchor for this workflow.",
        score: 4,
      },
    ],
    totals: {
      document_count: 1,
      category_counts: {
        requirements: 1,
      },
    },
  };
  const heartModel = {
    domains: [
      {
        id: "domain:auth",
        name: "auth",
        file_paths: ["src/auth/session.ts"],
        symbol_ids: ["sym:function:src/auth/session.ts:recordLoginAudit"],
        symbol_names: ["recordLoginAudit"],
        document_paths: ["docs/requirements.md"],
      },
      {
        id: "domain:billing",
        name: "billing",
        file_paths: ["src/billing/invoice.ts"],
        symbol_ids: ["sym:function:src/billing/invoice.ts:sendInvoice"],
        symbol_names: ["sendInvoice"],
        document_paths: [],
      },
    ],
    links: [
      {
        id: "DOCUMENT_TO_MODULE:document:docs/requirements.md:domain:auth",
        type: "DOCUMENT_TO_MODULE",
        from: "document:docs/requirements.md",
        to: "domain:auth",
        score: 0.9,
        rationale: "Requirements document anchors auth.",
        metadata: {
          document_path: "docs/requirements.md",
          domain: "auth",
        },
      },
    ],
    summary: {
      domain_count: 2,
      relationship_count: 1,
    },
  };

  const pack = compileContextPack({
    task: "keep implementation anchor aligned with requirements",
    graph,
    documentIndex,
    heartModel,
    policyReport: { violations: [] },
  });

  assert.equal(pack.relevant_files[0].path, "src/auth/session.ts");
  assert.equal(pack.linked_context.modules[0].module, "auth");
  assert.equal(pack.missing_context_warnings.includes("No document-to-module links were available for the matched documents."), false);
});

test("context compiler surfaces missing context warnings when links and docs are absent", () => {
  const pack = compileContextPack({
    task: "add audit trail",
    graph: {
      scanResult: {
        files: [
          {
            relativePath: "src/auth/login.ts",
            symbols: [],
          },
        ],
      },
    },
    documentIndex: {
      documents: [],
      totals: {
        document_count: 0,
        category_counts: {},
      },
    },
    heartModel: {
      domains: [],
      links: [],
      summary: {
        domain_count: 0,
        relationship_count: 0,
      },
    },
    policyReport: { violations: [] },
  });

  assert.ok(pack.missing_context_warnings.includes("No relevant requirements or design document was found for this task."));
  assert.ok(pack.missing_context_warnings.includes("No document-to-module links were available for the matched documents."));
  assert.ok(pack.missing_context_warnings.includes("No strong reuse candidate surfaced from the current linked context."));
});
