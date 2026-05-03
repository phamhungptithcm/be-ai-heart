import test from "node:test";
import assert from "node:assert/strict";

import {
  createPlanningChangeRequestId,
  normalizePlanningChangeRequest,
  renderPlanningChangeRequestMarkdown,
  validatePlanningChangeRequest,
} from "../packages/core/src/index.js";

test("planning change requests normalize deterministic latest-agreed records", () => {
  assert.equal(
    createPlanningChangeRequestId({ date: "2026-05-03T12:00:00.000Z", sequence: 2 }),
    "CR-20260503-02",
  );

  const request = normalizePlanningChangeRequest({
    now: "2026-05-03T12:00:00.000Z",
    sequence: 2,
    status: "accepted",
    title: "Add buyer pricing caveats",
    actor: "Product owner",
    trigger: "pricing page update",
    problem: "Pricing copy could imply guaranteed savings.",
    proposed_change: "Require benchmark report citations before ROI claims.",
    latest_agreed_summary: "Use local-first proof before paid expansion.",
    affected_story_ids: ["CADP-02", "BRP-04"],
    code_areas: ["apps/website/app/pricing/page.jsx"],
    docs_required: ["docs/07-go-to-market-pricing.md"],
    acceptance_criteria: [
      "Pricing labels current MVP, design partner pilot, and future enterprise scope.",
      "Savings claims cite measurement mode and confidence label.",
    ],
    validation_plan: ["npm run website:build"],
    security_considerations: ["Do not include customer names or raw benchmark prompts."],
  });

  assert.equal(request.id, "CR-20260503-02");
  assert.equal(request.schema_version, 1);
  assert.equal(request.status, "accepted");
  assert.deepEqual(request.affected_story_ids, ["CADP-02", "BRP-04"]);
  assert.equal(validatePlanningChangeRequest(request).valid, true);
});

test("planning change request markdown redacts sensitive values and reports gaps", () => {
  const markdown = renderPlanningChangeRequestMarkdown({
    id: "CR-20260503-03",
    title: "Sync private customer doc",
    actor: "customer@example.com",
    problem: "password=super-secret should never appear in planning docs.",
    proposed_change: "",
    affected_story_ids: [],
    acceptance_criteria: [],
  });

  assert.match(markdown, /CR-20260503-03/);
  assert.match(markdown, /\[redacted-email\]/);
  assert.match(markdown, /\[redacted-secret\]/);
  assert.match(markdown, /proposed_change: Proposed change is required/);
  assert.match(markdown, /affected_story_ids: At least one story ID is required/);
  assert.match(markdown, /acceptance_criteria: At least one acceptance criterion is required/);
});
