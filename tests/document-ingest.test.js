import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { findRelevantDocuments, scanDocumentTree } from "../packages/document-ingest/src/index.js";
import { prepareRepositoryDocumentArtifact } from "../packages/document-sync/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("document ingest supports docx/pdf plus lineage, freshness, and redacted previews", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const docsRoot = path.join(repoRoot, "docs");
  const importedRoot = path.join(repoRoot, ".heart", "imported-documents", "web");
  const docxPath = path.join(docsRoot, "customer-brief.docx");
  const pdfPath = path.join(docsRoot, "checkout-flow.pdf");
  const markdownPath = path.join(docsRoot, "ops-secret.md");
  const importedPath = path.join(importedRoot, "checkout-prd.json");

  await fs.mkdir(importedRoot, { recursive: true });
  await writeDocxFile(
    docxPath,
    "Customer Brief\nAcceptance criteria for the checkout rewrite\nProtect customer audit events.",
  );
  await fs.writeFile(
    pdfPath,
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 63 >>
stream
BT
/F1 12 Tf
72 96 Td
(Checkout Flow PDF) Tj
0 -16 Td
(Customer portal sequence) Tj
ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`,
    "latin1",
  );
  await fs.writeFile(
    markdownPath,
    "# Ops Secret\n\nAPI key: sk_test_hidden_secret\n\nCustomer rollout checklist.\n",
    "utf8",
  );
  await fs.writeFile(
    importedPath,
    `${JSON.stringify(
      {
        submission_id: "checkout-prd",
        title: "Checkout PRD",
        category: "requirements",
        summary: "Portal requirement upload for checkout flow.",
        body: "Customer acceptance criteria for checkout must stay visible to AI context.",
        profile_slug: "sample-repo",
        source: "portal-web-upload",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: ["docs", ".heart/imported-documents"],
  });
  const documentArtifact = prepareRepositoryDocumentArtifact({
    profileSlug: "sample-repo",
    repo: "sample-repo",
    documentIndex,
  });
  const documentsByPath = new Map(documentIndex.documents.map((document) => [document.path, document]));
  const docxDocument = documentsByPath.get("docs/customer-brief.docx");
  const pdfDocument = documentsByPath.get("docs/checkout-flow.pdf");
  const secretDocument = documentsByPath.get("docs/ops-secret.md");
  const importedDocument = documentsByPath.get(".heart/imported-documents/web/checkout-prd.json");

  assert.ok(docxDocument);
  assert.equal(docxDocument.source_type, "docx");
  assert.ok(docxDocument.document_id.startsWith("document:"));
  assert.deepEqual(docxDocument.source, {
    type: "docx",
    path: "docs/customer-brief.docx",
  });
  assert.equal(docxDocument.title, "Customer Brief");
  assert.match(docxDocument.summary, /Acceptance criteria/i);
  assert.ok(docxDocument.freshness.updated_at);
  assert.equal(docxDocument.version_ref.path, "docs/customer-brief.docx");
  assert.ok(docxDocument.citations.some((citation) => citation.type === "document_path"));

  assert.ok(pdfDocument);
  assert.equal(pdfDocument.source_type, "pdf");
  assert.match(pdfDocument.summary, /Checkout Flow PDF/i);
  assert.ok(pdfDocument.extraction);
  assert.equal(typeof pdfDocument.extraction.layout_aware, "boolean");
  assert.equal(pdfDocument.extraction.ocr_applied, false);

  assert.ok(secretDocument);
  assert.equal(secretDocument.sensitivity.level, "restricted");
  assert.match(secretDocument.content_preview, /\[REDACTED\]/);

  assert.ok(importedDocument);
  assert.equal(importedDocument.lineage.source_kind, "imported");
  assert.equal(importedDocument.lineage.source_system, "portal-web-upload");
  assert.equal(importedDocument.sensitivity.level, "customer");
  assert.ok(documentIndex.totals.sensitivity_counts.restricted >= 1);
  assert.ok(documentIndex.totals.sensitivity_counts.customer >= 1);

  const artifactDocument = documentArtifact.documents.find((document) => document.path === importedDocument.path);
  assert.equal(documentArtifact.schema_version, 2);
  assert.ok(artifactDocument.document_id.startsWith("document:"));
  assert.equal(artifactDocument.source.type, "json");
  assert.ok(artifactDocument.version_ref.lineage_id);
  assert.ok(artifactDocument.citations.some((citation) => citation.path === importedDocument.path));
  assert.equal(artifactDocument.source_type, "json");
  assert.equal(artifactDocument.lineage.source_system, "portal-web-upload");
  assert.equal(artifactDocument.sensitivity.level, "customer");
  assert.ok(artifactDocument.extraction);
  const artifactSecret = documentArtifact.documents.find((document) => document.path === secretDocument.path);
  assert.equal(artifactSecret.summary, "Restricted document. Summary redacted from synced artifact.");
});

test("document retrieval prefers latest lineage version and redacts restricted summaries", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const docsRoot = path.join(repoRoot, "docs", "versions");

  await fs.mkdir(docsRoot, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(docsRoot, "checkout-prd-v1.md"),
      "# Checkout PRD\n\nVersion 1 flow for checkout retries.\n",
      "utf8",
    ),
    fs.writeFile(
      path.join(docsRoot, "checkout-prd-v2.md"),
      "# Checkout PRD\n\nVersion 2 flow for checkout retries and portal approvals.\n",
      "utf8",
    ),
    fs.writeFile(
      path.join(docsRoot, "billing-secret.md"),
      "# Billing Secret\n\nPassword: super-secret-token\n\nRetry rollback details.\n",
      "utf8",
    ),
  ]);

  const olderTime = new Date("2026-04-18T00:00:00.000Z");
  const newerTime = new Date("2026-04-19T00:00:00.000Z");
  await Promise.all([
    fs.utimes(path.join(docsRoot, "checkout-prd-v1.md"), olderTime, olderTime),
    fs.utimes(path.join(docsRoot, "checkout-prd-v2.md"), newerTime, newerTime),
  ]);

  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: ["docs"],
  });
  const byPath = new Map(documentIndex.documents.map((document) => [document.path, document]));
  const latestDoc = byPath.get("docs/versions/checkout-prd-v2.md");
  const olderDoc = byPath.get("docs/versions/checkout-prd-v1.md");
  const matches = findRelevantDocuments(documentIndex, "update checkout portal approvals", 5);
  const secretMatch = findRelevantDocuments(documentIndex, "billing rollback secret", 5).find((document) =>
    document.path.endsWith("billing-secret.md"),
  );

  assert.ok(latestDoc.lineage.is_latest);
  assert.equal(olderDoc.lineage.is_latest, false);
  assert.equal(latestDoc.lineage.latest_path, "docs/versions/checkout-prd-v2.md");
  assert.equal(documentIndex.totals.lineage_count >= 2, true);
  assert.equal(matches.filter((document) => document.lineage?.lineage_id === latestDoc.lineage.lineage_id).length, 1);
  assert.equal(matches.some((document) => document.path === "docs/versions/checkout-prd-v2.md"), true);
  assert.equal(matches.some((document) => document.path === "docs/versions/checkout-prd-v1.md"), false);
  assert.equal(secretMatch.summary_redacted, true);
  assert.match(secretMatch.summary, /Summary redacted/);
  assert.ok(typeof matches[0].semantic_score === "number");
  assert.ok(matches[0].extraction);
});

test("document retrieval uses local semantic vectors for synonym-heavy queries", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const docsRoot = path.join(repoRoot, "docs", "semantic");

  await fs.mkdir(docsRoot, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(docsRoot, "customer-auth-guide.md"),
      "# Authentication Guide\n\nIdentity workflow and session guardrails for customer access.\n",
      "utf8",
    ),
    fs.writeFile(
      path.join(docsRoot, "billing-ledger.md"),
      "# Billing Ledger\n\nInvoice reconciliation and payment settlement notes.\n",
      "utf8",
    ),
  ]);

  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: ["docs"],
  });
  const matches = findRelevantDocuments(documentIndex, "signin rules", 3);

  assert.equal(matches[0].path, "docs/semantic/customer-auth-guide.md");
  assert.equal(matches[0].lexical_score, 0);
  assert.ok(matches[0].semantic_score > 0);
  assert.ok(matches[0].score > matches[0].semantic_score);
});

test("document ingest does not redact product docs that only mention token budgets or token savings", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const docsRoot = path.join(repoRoot, "docs", "benchmark-proof");

  await fs.mkdir(docsRoot, { recursive: true });
  await fs.writeFile(
    path.join(docsRoot, "roi-proof.md"),
    [
      "# Benchmark Proof",
      "",
      "Track token savings, token budget targets, and follow-up memory retention for the customer rollout.",
      "",
    ].join("\n"),
    "utf8",
  );

  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: ["docs"],
  });
  const document = documentIndex.documents.find((entry) => entry.path === "docs/benchmark-proof/roi-proof.md");
  const match = findRelevantDocuments(documentIndex, "token savings benchmark proof", 3).find(
    (entry) => entry.path === "docs/benchmark-proof/roi-proof.md",
  );

  assert.ok(document);
  assert.notEqual(document.sensitivity.level, "restricted");
  assert.ok(match);
  assert.equal(match.summary_redacted, false);
  assert.doesNotMatch(match.summary, /Summary redacted/i);
});

test("document ingest applies OCR when pdf text is weak and ocrmypdf is available", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const docsRoot = path.join(repoRoot, "docs");
  const pdfPath = path.join(docsRoot, "scan-only.pdf");
  const toolRoot = path.join(repoRoot, ".tmp-tools");
  const ocrmypdfPath = path.join(toolRoot, "ocrmypdf");
  const previousPath = process.env.PATH;
  const previousPython = process.env.BE_AI_HEART_PYTHON;

  await fs.mkdir(toolRoot, { recursive: true });
  await fs.writeFile(
    pdfPath,
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 0 >>
stream
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`,
    "latin1",
  );
  await fs.writeFile(
    ocrmypdfPath,
    [
      "#!/bin/sh",
      "if [ \"$1\" = \"--version\" ]; then",
      "  echo 'ocrmypdf 0.0-test'",
      "  exit 0",
      "fi",
      "output=\"$4\"",
      "cat > \"$output\" <<'EOF'",
      "%PDF-1.4",
      "1 0 obj",
      "<< /Type /Catalog /Pages 2 0 R >>",
      "endobj",
      "2 0 obj",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "endobj",
      "3 0 obj",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>",
      "endobj",
      "4 0 obj",
      "<< /Length 74 >>",
      "stream",
      "BT",
      "/F1 12 Tf",
      "72 96 Td",
      "(Scanned contract approval workflow) Tj",
      "0 -16 Td",
      "(Customer portal OCR recovery) Tj",
      "ET",
      "endstream",
      "endobj",
      "trailer",
      "<< /Root 1 0 R >>",
      "%%EOF",
      "EOF",
    ].join("\n"),
    "utf8",
  );
  await fs.chmod(ocrmypdfPath, 0o755);

  process.env.PATH = `${toolRoot}:${previousPath ?? ""}`;
  process.env.BE_AI_HEART_PYTHON = resolveBundledPython();
  t.after(() => {
    process.env.PATH = previousPath;
    if (previousPython === undefined) {
      delete process.env.BE_AI_HEART_PYTHON;
      return;
    }
    process.env.BE_AI_HEART_PYTHON = previousPython;
  });

  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: ["docs"],
  });
  const pdfDocument = documentIndex.documents.find((document) => document.path === "docs/scan-only.pdf");

  assert.ok(pdfDocument);
  assert.match(pdfDocument.summary, /Scanned contract approval workflow/i);
  assert.equal(pdfDocument.extraction.ocr_available, true);
  assert.equal(pdfDocument.extraction.ocr_engine, "ocrmypdf");
  assert.equal(pdfDocument.extraction.ocr_applied, true);
  assert.equal(pdfDocument.extraction.ocr_recommended, false);
  assert.match(pdfDocument.extraction.extractor, /ocrmypdf/);
});

function writeDocxFile(targetPath, text) {
  const script = [
    "import pathlib, sys, zipfile",
    "target = pathlib.Path(sys.argv[1])",
    "target.parent.mkdir(parents=True, exist_ok=True)",
    "body = sys.argv[2].split('\\\\n')",
    "paragraphs = ''.join(f'<w:p><w:r><w:t>{line}</w:t></w:r></w:p>' for line in body)",
    "document = '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>'",
    "document += '<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>' + paragraphs + '</w:body></w:document>'",
    "content_types = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>'",
    "content_types += '<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">'",
    "content_types += '<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>'",
    "content_types += '<Default Extension=\"xml\" ContentType=\"application/xml\"/>'",
    "content_types += '<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>'",
    "content_types += '</Types>'",
    "rels = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>'",
    "rels += '<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"></Relationships>'",
    "with zipfile.ZipFile(target, 'w') as archive:",
    "    archive.writestr('[Content_Types].xml', content_types)",
    "    archive.writestr('_rels/.rels', rels)",
    "    archive.writestr('word/document.xml', document)",
  ].join("\n");

  execFileSync("python3", ["-c", script, targetPath, text], {
    stdio: "pipe",
  });
}

function resolveBundledPython() {
  return path.join(
    process.env.HOME,
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "python",
    "bin",
    "python3",
  );
}
