import test from "node:test";
import assert from "node:assert/strict";

import { buildDocumentStatusSummary } from "../services/api/src/document-status.js";

test("document status summary reports queued docs/spec drift and safe next actions", () => {
  const summary = buildDocumentStatusSummary(
    [
      {
        profile_slug: "sample-repo",
        workspace_slug: "sample-repo",
        repo: "sample-repo",
        generated_at: "2026-04-01T00:00:00.000Z",
        documents: [
          {
            title: "Billing PRD",
            category: "requirements",
            freshness: { status: "fresh" },
            citations: [{ type: "module", target: "packages/billing" }],
            sensitivity: { level: "internal" },
          },
          {
            title: "Security Exception",
            category: "technical",
            freshness: { status: "stale" },
            sensitivity: { level: "restricted" },
          },
        ],
      },
    ],
    [
      {
        profile_slug: "sample-repo",
        title: "Updated checkout requirements",
        updated_at: "2026-04-02T00:00:00.000Z",
      },
    ],
  );

  assert.equal(summary.status, "queued_updates");
  assert.equal(summary.document_count, 2);
  assert.equal(summary.requirement_document_count, 1);
  assert.equal(summary.stale_document_count, 1);
  assert.equal(summary.restricted_document_count, 1);
  assert.equal(summary.linked_document_count, 1);
  assert.deepEqual(summary.queued_profile_slugs, ["sample-repo"]);
  assert.equal(summary.latest_synced_at, "2026-04-01T00:00:00.000Z");
  assert.equal(summary.latest_submission_at, "2026-04-02T00:00:00.000Z");
  assert.match(summary.next_actions.join("\n"), /heart docs sync-web --slug sample-repo/);
});

test("document status summary explains missing and ready states", () => {
  const missing = buildDocumentStatusSummary([], []);
  assert.equal(missing.status, "missing");
  assert.match(missing.next_actions.join("\n"), /heart docs import/);

  const ready = buildDocumentStatusSummary(
    [
      {
        profile_slug: "sample-repo",
        documents: [
          {
            title: "Business Brief",
            category: "business",
            freshness: { status: "fresh" },
            version_ref: { hash: "abc123" },
          },
        ],
      },
    ],
    [],
  );
  assert.equal(ready.status, "ready");
  assert.equal(ready.linked_document_count, 1);
  assert.match(ready.next_actions.join("\n"), /heart pack/);
});
