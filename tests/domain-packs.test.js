import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  detectPackLayerConflicts,
  getDomainPack,
  getPackBenchmarks,
  listDomainPacks,
  mergePackLayers,
  validateDomainPack,
  writePackArtifact,
} from "../packages/core/src/index.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");

function runCli(args) {
  return spawnSync("node", [cliPath, ...args], {
    encoding: "utf8",
  });
}

test("domain pack registry exposes tolling management metadata and build options", async () => {
  const packs = await listDomainPacks({ repoRoot: process.cwd() });
  const tolling = packs.find((pack) => pack.pack_id === "tolling-management");

  assert.ok(tolling);
  assert.equal(tolling.name, "Tolling Management");
  assert.ok(tolling.layers_available.some((layer) => layer.id === "core"));
  assert.ok(tolling.layers_available.some((layer) => layer.id === "regional:texas"));
  assert.ok(tolling.artifacts_available.some((artifact) => artifact.id === "sales-demo-kit"));
  assert.ok(tolling.security_warnings.some((warning) => /PII|plates|payment/i.test(warning)));

  const detail = await getDomainPack("tolling-management", { repoRoot: process.cwd() });
  assert.equal(detail.pack_id, "tolling-management");
  assert.ok(detail.required_inputs.includes("output_type"));
  assert.ok(detail.build_options.outputs.some((output) => output.id === "context-pack"));

  const validation = await validateDomainPack("tolling-management", { repoRoot: process.cwd() });
  assert.equal(validation.status, "valid");
  assert.equal(validation.errors.length, 0);

  const benchmarks = await getPackBenchmarks("tolling-management", { repoRoot: process.cwd() });
  assert.ok(benchmarks.scenarios.some((scenario) => scenario.id === "tolling-trip-posting-dedupe"));
});

test("domain pack registry falls back when source pack files are not bundled", async () => {
  const packRoot = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-no-pack-root-"));
  const packs = await listDomainPacks({ repoRoot: packRoot, packRoot: path.join(packRoot, "missing-packs") });

  assert.equal(packs[0].pack_id, "tolling-management");
  const detail = await getDomainPack("tolling-management", {
    repoRoot: packRoot,
    packRoot: path.join(packRoot, "missing-packs"),
  });
  assert.equal(detail.name, "Tolling Management");

  const benchmarks = await getPackBenchmarks("tolling-management", {
    repoRoot: packRoot,
    packRoot: path.join(packRoot, "missing-packs"),
  });
  assert.ok(benchmarks.scenarios.some((scenario) => scenario.id === "tolling-support-smishing-guidance"));
});

test("domain pack layers merge with customer override conflicts surfaced", async () => {
  const selection = {
    pack_id: "tolling-management",
    regional_layer: "texas",
    agency_overlay: "hctra-example",
    customer_overlay: {
      overlay_id: "customer-demo",
      rules: [
        {
          rule_id: "notification.official-payment-link",
          title: "Customer SMS link exception",
          summary: "Customer wants SMS payment links for demo-only discovery.",
          source_ref: "customer-demo-spec",
        },
      ],
    },
  };

  const merged = await mergePackLayers(selection, { repoRoot: process.cwd() });
  assert.equal(merged.pack_id, "tolling-management");
  assert.deepEqual(merged.layer_priority, ["core", "regional", "agency", "customer", "accepted_customer_docs"]);
  assert.ok(merged.effective_rules.some((rule) => rule.rule_id === "notification.official-payment-link"));
  assert.ok(merged.conflicts.some((conflict) => conflict.rule_id === "notification.official-payment-link"));
  assert.ok(merged.citations.some((citation) => citation.source_ref.includes("FTC")));

  const conflicts = await detectPackLayerConflicts(selection, { repoRoot: process.cwd() });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].severity, "high");
});

test("pack artifact writer creates safe manifest and predictable generated files", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-pack-artifacts-"));

  const artifact = await writePackArtifact({
    repoRoot: outputRoot,
    sourceRepoRoot: process.cwd(),
    packId: "tolling-management",
    outputType: "sales-demo-kit",
    regionalLayer: "texas",
    agencyOverlay: "hctra-example",
    customerRequirements: "Use fake demo accounts only. Do not include real plates or card data.",
    now: "2026-05-03T00:00:00.000Z",
  });

  assert.equal(artifact.manifest.pack_id, "tolling-management");
  assert.equal(artifact.manifest.output_type, "sales-demo-kit");
  assert.equal(artifact.manifest.schema_version, 1);
  assert.ok(artifact.manifest.warnings.some((warning) => /No real PII/i.test(warning)));
  assert.ok(artifact.generated_files.some((file) => file.endsWith("sales-demo-kit.md")));

  const manifestRaw = await fs.readFile(artifact.manifest_path, "utf8");
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.artifact_id, artifact.manifest.artifact_id);
  assert.doesNotMatch(manifestRaw, /4111\s?1111|4242\s?4242|AKIA|sk-/i);
});

test("CLI packs commands expose deterministic JSON and build artifacts", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-cli-packs-"));

  const list = runCli(["packs", "list", "--json", "--root", outputRoot]);
  assert.equal(list.status, 0, list.stderr);
  const listPayload = JSON.parse(list.stdout);
  assert.ok(listPayload.packs.some((pack) => pack.pack_id === "tolling-management"));

  const show = runCli(["packs", "show", "tolling-management", "--json", "--root", outputRoot]);
  assert.equal(show.status, 0, show.stderr);
  const showPayload = JSON.parse(show.stdout);
  assert.equal(showPayload.pack_id, "tolling-management");
  assert.ok(showPayload.build_options.outputs.some((output) => output.id === "sales-demo-kit"));

  const build = runCli([
    "packs",
    "build",
    "tolling-management",
    "--output",
    "sales-demo-kit",
    "--regional",
    "texas",
    "--agency",
    "hctra-example",
    "--json",
    "--root",
    outputRoot,
  ]);
  assert.equal(build.status, 0, build.stderr);
  const buildPayload = JSON.parse(build.stdout);
  assert.equal(buildPayload.status, "generated");
  assert.equal(buildPayload.manifest.output_type, "sales-demo-kit");
  assert.equal(buildPayload.next_actions[0], "Open generated artifact in the portal or sync it to the pack source tree.");

  const validation = runCli(["packs", "validate", "tolling-management", "--json", "--root", outputRoot]);
  assert.equal(validation.status, 0, validation.stderr);
  assert.equal(JSON.parse(validation.stdout).status, "valid");
});
