import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  compareBenchmarkRuns,
  prepareBenchmarkReportArtifact,
  writeBenchmarkEvidenceBundle,
} from "../packages/benchmark/src/index.js";
import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import {
  resolveRequestAuthContext,
  writeBenchmarkReportForActor,
} from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("service host benchmark detail returns sanitized evidence manifest and mirrors public artifact", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
  });
  const adminRequest = new Request("http://127.0.0.1:4010/api/admin/session", {
    headers: {
      "x-be-ai-heart-session": "admin-owner-session",
    },
  });
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface: "admin",
    request: adminRequest,
    localDemoAuth: config.localDemoAuth,
  });
  const report = compareBenchmarkRuns(
    {
      tokens: 2400,
      minutes: 31,
      duplicates: 3,
      review_edits: 7,
      memory_refreshes: 4,
      token_cost_usd: 0.48,
    },
    {
      tokens: 1400,
      minutes: 17,
      duplicates: 1,
      review_edits: 2,
      memory_refreshes: 1,
      token_cost_usd: 0.27,
    },
    {
      repo: "sample-repo",
      profile_slug: "alpha-workspace",
      scenario: "login-audit-flow",
      report_id: "alpha-benchmark-detail",
    },
  );
  const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, report, {
    baselineInput: {
      prompt: "Trace login audit flow without project memory",
      output_artifacts: [{ type: "patch", path: "patches/baseline.diff" }],
    },
    assistedInput: {
      prompt: "Use heart context pack for login audit flow",
      tool_outputs: [{ tool: "context_pack", status: "ok" }],
      output_artifacts: [{ type: "patch", path: "patches/assisted.diff" }],
      context_pack: {
        task: "login audit flow",
        estimated_tokens: 540,
        truncated: false,
        citations: [
          {
            type: "document",
            path: "docs/login-audit.md",
            title: "Login Audit",
            reason: "Matched requirement terms.",
          },
        ],
      },
    },
  });

  const persisted = await writeBenchmarkReportForActor({
    serviceStorageRoot: config.serviceStorageRoot,
    surface: "admin",
    authContext,
    report: prepareBenchmarkReportArtifact({
      ...report,
      evidence_bundle: evidenceBundle,
      workspace_slug: "alpha-workspace",
      customer_slug: "customer-alpha",
    }),
    portalRoot: config.portalRoot,
    adminRoot: config.adminRoot,
  });

  assert.equal(persisted.report.report_id, "alpha-benchmark-detail");

  const response = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/admin/benchmarks/alpha-benchmark-detail", {
      headers: {
        "x-be-ai-heart-session": "admin-owner-session",
      },
    }),
    config,
  );

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.report_id, "alpha-benchmark-detail");
  assert.equal(payload.evidence_bundle.local_manifest_path, undefined);
  assert.equal(payload.evidence_manifest.bundle_id, "alpha-benchmark-detail");
  assert.equal(payload.evidence_manifest.bundle_file_count, 3);
  assert.equal(payload.evidence_manifest.assisted.context_pack.top_citations[0].path, undefined);

  const publicManifest = JSON.parse(
    await fs.readFile(
      path.join(config.portalRoot, "public", "benchmarks", "evidence", "alpha-benchmark-detail.json"),
      "utf8",
    ),
  );
  assert.equal(publicManifest.bundle_id, "alpha-benchmark-detail");
  assert.equal(publicManifest.assisted.context_pack.top_citations[0].path, undefined);
});
