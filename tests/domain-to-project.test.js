import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  createDefaultGenerationPlan,
  generateProjectFromDomainAndStack,
  inferGenerationMode,
  listStackPresets,
  previewGenerationPlan,
  validateStackPreset,
  writeGeneratedFiles,
} from "../packages/project-generator/src/index.js";
import {
  scanSecretLikeText,
  validateGenerationManifest,
} from "../packages/generation-manifest/src/index.js";
import { createGenerationPlanContract } from "../packages/portal-generation-contracts/src/index.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");

function runCli(args) {
  return spawnSync("node", [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, CI: "true", NO_COLOR: "1" },
  });
}

test("stack presets expose MVP stacks with valid contracts", () => {
  const presets = listStackPresets();
  assert.deepEqual(
    presets.map((preset) => preset.stack_id),
    ["next-fullstack-postgres", "react-node-postgres", "spring-react-postgres"],
  );
  for (const preset of presets) {
    const validation = validateStackPreset(preset.stack_id);
    assert.equal(validation.status, "valid", `${preset.stack_id}: ${validation.errors.join(", ")}`);
    assert.ok(preset.dev_command);
    assert.ok(preset.build_command);
    assert.ok(preset.security_notes.some((note) => /payment|secret|credential/i.test(note)));
  }
});

test("generation mode inference uses smart defaults", () => {
  assert.equal(inferGenerationMode("generate a sales demo kit"), "sales-demo");
  assert.equal(inferGenerationMode("create docs and specs only"), "docs-only");
  assert.equal(inferGenerationMode("build backend API service"), "service-starter");
  assert.equal(inferGenerationMode("generate customer portal only"), "ui-starter");
  assert.equal(inferGenerationMode("start a tolling management project"), "product-starter");
});

test("generation plan asks only blocking questions and previews file writes", async () => {
  const repoRoot = process.cwd();
  const needsStack = await createDefaultGenerationPlan({
    repoRoot,
    domainId: "tolling-management",
    prompt: "start tolling project",
  });
  assert.equal(needsStack.status, "needs_input");
  assert.equal(needsStack.blocking_questions[0].question_id, "stack-preset");

  const plan = await createDefaultGenerationPlan({
    repoRoot,
    domainId: "tolling-management",
    stackId: "next-fullstack-postgres",
    mode: "product-starter",
    outputDir: path.join(os.tmpdir(), `beheart-d2p-plan-${Date.now()}`),
  });
  const preview = previewGenerationPlan(plan);
  assert.equal(preview.status, "preview");
  assert.equal(preview.stack_preset_id, "next-fullstack-postgres");
  assert.ok(plan.selected_layers.some((layer) => layer.layer === "core"));
  assert.ok(plan.source_citations.length >= 1);
  assert.ok(preview.generated_files.includes("README.md"));
  assert.ok(preview.generated_files.includes(".heart/context/domain-context.json"));

  const portalContract = createGenerationPlanContract(plan);
  assert.equal(portalContract.status, "ready_for_preview");
  assert.equal(portalContract.domain_pack_id, "tolling-management");
});

test("safe writer rejects generated paths outside output directory", async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-d2p-safe-"));
  await assert.rejects(
    () => writeGeneratedFiles({
      outputDir,
      confirmed: true,
      artifacts: [{ relative_path: "../escape.txt", content: "bad" }],
    }),
    /Unsafe generated artifact path|outside/,
  );
});

test("project generation writes manifest, fake data, tests, and docs", async () => {
  const outputDir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "beheart-d2p-generate-")), "starter");
  const result = await generateProjectFromDomainAndStack({
    repoRoot: process.cwd(),
    domainId: "tolling-management",
    stackId: "next-fullstack-postgres",
    mode: "product-starter",
    outputDir,
    confirmed: true,
    prompt: "start a tolling management project",
  });

  assert.equal(result.status, "generated");
  assert.ok(result.generated_files.some((file) => file.endsWith("README.md")));
  assert.ok(result.generated_files.some((file) => file.endsWith("tests/domain.test.js")));
  assert.equal(result.validation_results.find((entry) => entry.check_id === "secret-scan").status, "passed");

  const manifestRaw = await fs.readFile(path.join(outputDir, ".heart", "generation-manifest.json"), "utf8");
  const manifest = JSON.parse(manifestRaw);
  assert.equal(validateGenerationManifest(manifest).status, "valid");
  assert.equal(manifest.domain_pack_id, "tolling-management");
  assert.equal(manifest.stack_preset_id, "next-fullstack-postgres");
  assert.equal(scanSecretLikeText(manifestRaw).length, 0);
});

test("CLI generate previews by default and writes only with confirm", async () => {
  const outputDir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "beheart-d2p-cli-")), "starter");

  const preview = runCli([
    "generate",
    "tolling-management",
    "--stack",
    "react-node-postgres",
    "--output-dir",
    outputDir,
    "--json",
  ]);
  assert.equal(preview.status, 0, preview.stderr);
  const previewPayload = JSON.parse(preview.stdout);
  assert.equal(previewPayload.preview.status, "preview");
  await assert.rejects(() => fs.access(path.join(outputDir, "README.md")), /ENOENT/);

  const generated = runCli([
    "generate",
    "tolling-management",
    "--stack",
    "react-node-postgres",
    "--output-dir",
    outputDir,
    "--confirm",
    "--json",
  ]);
  assert.equal(generated.status, 0, generated.stderr);
  const generatedPayload = JSON.parse(generated.stdout);
  assert.equal(generatedPayload.status, "generated");
  assert.equal(generatedPayload.manifest.stack_preset_id, "react-node-postgres");
  await fs.access(path.join(outputDir, "README.md"));
  await fs.access(path.join(outputDir, ".heart", "generation-manifest.json"));
});
