import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { evaluatePolicyViolations, loadPolicyRules } from "../packages/policy-engine/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

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

test("policy engine loads repo-local policy rules from yaml", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const policyRoot = path.join(repoRoot, ".heart");
  const policyPath = path.join(policyRoot, "policies.yaml");

  await fs.mkdir(policyRoot, { recursive: true });
  await fs.writeFile(
    policyPath,
    `rules:
  - id: auth-no-billing-imports
    from_prefix: src/auth/
    blocked_prefix: src/billing/
    description: auth code must not depend on billing code
`,
    "utf8",
  );

  const policyState = await loadPolicyRules(repoRoot);
  const report = evaluatePolicyViolations(
    {
      files: [
        {
          relativePath: "src/auth/login.ts",
          imports: ["../billing/invoice.ts"],
          symbols: [],
        },
      ],
    },
    policyState.rules,
  );

  assert.equal(policyState.exists, true);
  assert.equal(policyState.path, policyPath);
  assert.equal(policyState.rules.length, 1);
  assert.equal(policyState.rules[0].id, "auth-no-billing-imports");
  assert.equal(report.violations.length, 1);
  assert.equal(report.violations[0].rule_id, "auth-no-billing-imports");
});

test("policy engine reports strict schema errors for invalid rule shapes", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const policyRoot = path.join(repoRoot, ".heart");
  const policyPath = path.join(policyRoot, "policies.yaml");

  await fs.mkdir(policyRoot, { recursive: true });
  await fs.writeFile(
    policyPath,
    `rules:
  - id: auth-no-billing-imports
    from_prefix: src/auth/
    blocked_prefix: src/billing/
    severity: high
  - blocked_prefix: src/apps/
metadata:
  owner: platform
`,
    "utf8",
  );

  const policyState = await loadPolicyRules(repoRoot);

  assert.equal(policyState.exists, true);
  assert.equal(policyState.status, "invalid");
  assert.ok(policyState.errors.some((error) => error.includes("Unknown policy top-level key: metadata")));
  assert.ok(policyState.errors.some((error) => error.includes("Unknown policy rule key: severity")));
  assert.ok(policyState.errors.some((error) => error.includes("policy rule at index 1 must include a non-empty id")));
  assert.equal(policyState.rules[0].id, "auth-no-billing-imports");
});
