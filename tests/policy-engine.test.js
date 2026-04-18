import test from "node:test";
import assert from "node:assert/strict";

import { evaluatePolicyViolations } from "../packages/policy-engine/src/index.js";

test("policy engine flags package imports into apps", () => {
  const scanResult = {
    files: [
      {
        relativePath: "packages/core/src/index.ts",
        imports: ["../../../apps/website/src/index.js"],
        symbols: [],
      },
    ],
  };

  const report = evaluatePolicyViolations(scanResult);
  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0].rule_id, "packages-no-app-imports");
});
