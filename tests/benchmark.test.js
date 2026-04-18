import test from "node:test";
import assert from "node:assert/strict";

import { compareBenchmarkRuns } from "../packages/benchmark/src/index.js";

test("benchmark comparison calculates reductions", () => {
  const report = compareBenchmarkRuns(
    {
      tokens: 1000,
      minutes: 20,
      duplicates: 2,
      policy_violations: 4,
      review_edits: 5,
    },
    {
      tokens: 650,
      minutes: 15,
      duplicates: 1,
      policy_violations: 1,
      review_edits: 2,
    },
  );

  assert.equal(report.token_savings_pct, 35);
  assert.equal(report.review_edit_reduction_pct, 60);
  assert.equal(report.policy_violation_reduction_pct, 75);
});
