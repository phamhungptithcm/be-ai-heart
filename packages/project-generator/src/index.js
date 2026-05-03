import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

import {
  detectDomainConflicts,
  explainEffectiveDomainRules,
  mergeDomainLayers,
} from "../../domain-pack-compiler/src/index.js";
import { selectDomainPack } from "../../domain-pack-registry/src/index.js";
import {
  createGenerationManifest,
  scanSecretLikeText,
  scanUnsafeDemoData,
  validateGenerationManifest,
} from "../../generation-manifest/src/index.js";
import {
  listStackPresets,
  selectStackPreset,
  validateStackPreset,
} from "../../stack-presets/src/index.js";

export const PROJECT_GENERATOR_SCHEMA_VERSION = 1;

const GENERATION_MODES = Object.freeze([
  "docs-only",
  "sales-demo",
  "product-starter",
  "service-starter",
  "ui-starter",
  "custom-domain-builder",
]);

const MODE_ALIASES = Object.freeze({
  docs: "docs-only",
  "docs-only": "docs-only",
  spec: "docs-only",
  plan: "docs-only",
  "sales-mvp": "sales-demo",
  "sales-demo": "sales-demo",
  demo: "sales-demo",
  "demo-kit": "sales-demo",
  starter: "product-starter",
  "full-starter": "product-starter",
  "product-starter": "product-starter",
  backend: "service-starter",
  api: "service-starter",
  service: "service-starter",
  "service-starter": "service-starter",
  frontend: "ui-starter",
  ui: "ui-starter",
  portal: "ui-starter",
  "ui-starter": "ui-starter",
  custom: "custom-domain-builder",
  "custom-domain": "custom-domain-builder",
  "custom-domain-builder": "custom-domain-builder",
});

const TOLLING_MODULES = Object.freeze([
  "account-360",
  "roadside-events",
  "trip-posting",
  "invoices-payments",
  "violations-disputes-cases",
  "inventory-fulfillment",
  "notifications",
  "reports",
  "audit-security",
  "benchmarks",
]);

export function listGenerationModes() {
  return [...GENERATION_MODES];
}

export function inferGenerationMode(userPrompt = "") {
  const prompt = String(userPrompt ?? "").toLowerCase();
  if (/\b(demo|sales|showcase|pitch|proposal|rfp)\b/.test(prompt)) {
    return "sales-demo";
  }
  if (/\b(plan|spec|docs|documentation|domain memory|no code)\b/.test(prompt)) {
    return "docs-only";
  }
  if (/\b(api|backend|service|worker|contract)\b/.test(prompt)) {
    return "service-starter";
  }
  if (/\b(ui|frontend|portal|customer app|self-service|back-office screen|prototype)\b/.test(prompt)) {
    return "ui-starter";
  }
  if (/\b(create|new)\b.*\b(domain pack|custom domain)\b/.test(prompt)) {
    return "custom-domain-builder";
  }
  return "product-starter";
}

export function selectGenerationMode({ mode, prompt } = {}) {
  const normalized = String(mode ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (!normalized) {
    return inferGenerationMode(prompt);
  }
  const selected = MODE_ALIASES[normalized];
  if (!selected) {
    throw new Error(`Unknown generation mode "${mode}".`);
  }
  return selected;
}

export async function createDefaultGenerationPlan({
  repoRoot = process.cwd(),
  domainId = "tolling-management",
  stackId,
  mode,
  prompt = "",
  outputDir,
  regionalLayer,
  agencyOverlay,
  customerRequirements = "",
  tokenBudget,
  now = new Date().toISOString(),
} = {}) {
  const selectedMode = selectGenerationMode({ mode, prompt });
  const domainSelection = await selectDomainPack({ repoRoot, domainId, prompt });
  const selectedDomainId = domainSelection.selected_pack?.pack_id ?? domainId;
  const selectedStack = stackId ? selectStackPreset(stackId) : null;
  const normalizedStackId = selectedStack?.stack_id ?? "";
  const resolvedOutputDir = outputDir
    ? path.resolve(repoRoot, outputDir)
    : path.join(repoRoot, "generated", `${selectedDomainId}-${selectedMode}${normalizedStackId ? `-${normalizedStackId}` : ""}`);
  const effectiveRules = domainSelection.status === "selected"
    ? await explainEffectiveDomainRules({
      pack_id: selectedDomainId,
      regional_layer: regionalLayer,
      agency_overlay: agencyOverlay,
      customer_requirements: customerRequirements,
    }, { repoRoot })
    : null;
  const mergedLayers = domainSelection.status === "selected"
    ? await mergeDomainLayers({
      pack_id: selectedDomainId,
      regional_layer: regionalLayer,
      agency_overlay: agencyOverlay,
      customer_requirements: customerRequirements,
    }, { repoRoot })
    : null;
  const conflicts = domainSelection.status === "selected"
    ? await detectDomainConflicts({
      pack_id: selectedDomainId,
      regional_layer: regionalLayer,
      agency_overlay: agencyOverlay,
      customer_requirements: customerRequirements,
    }, { repoRoot })
    : [];
  const modules = resolveModulesForPlan({ domainId: selectedDomainId, mode: selectedMode });
  const planId = createStablePlanId({
    selectedDomainId,
    selectedMode,
    normalizedStackId,
    resolvedOutputDir,
    regionalLayer,
    agencyOverlay,
    customerRequirements,
    now,
  });
  const generatedArtifacts = createPlannedArtifacts({
    planId,
    domainId: selectedDomainId,
    mode: selectedMode,
    stackPreset: selectedStack,
    modules,
  });
  const plan = {
    schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
    plan_id: planId,
    status: "planned",
    domain_pack_id: selectedDomainId,
    domain_pack_status: domainSelection.status,
    mode: selectedMode,
    stack_preset_id: normalizedStackId,
    stack_preset: selectedStack,
    output_dir: resolvedOutputDir,
    layer_selection: {
      core: true,
      regional_layer: regionalLayer ?? "",
      agency_overlay: agencyOverlay ?? "",
      customer_overlay_id: "",
    },
    selected_layers: mergedLayers?.selected_layers ?? [],
    effective_rules_summary: effectiveRules?.summary ?? "",
    modules,
    generated_artifacts: generatedArtifacts,
    source_citations: mergedLayers?.citations ?? effectiveRules?.citations ?? [],
    warnings: [
      ...(conflicts ?? []),
      ...((effectiveRules?.warnings ?? []).map((warning, index) => ({
        warning_id: `domain-warning-${index + 1}`,
        severity: "warning",
        layers: [],
        message: warning,
        resolution_required: false,
      }))),
    ],
    blocking_questions: [],
    validation_commands: createValidationCommands(selectedStack, selectedMode),
    assumptions: createAssumptions({ mode: selectedMode, stackPreset: selectedStack, domainId: selectedDomainId }),
    token_budget: Number.isFinite(Number(tokenBudget)) ? Number(tokenBudget) : null,
    created_at: now,
  };
  plan.blocking_questions = await askOnlyBlockingQuestions(plan);
  plan.status = plan.blocking_questions.length > 0 ? "needs_input" : "ready_for_preview";
  return plan;
}

export async function askOnlyBlockingQuestions(plan = {}) {
  const questions = [];
  if (!plan.stack_preset_id) {
    questions.push({
      question_id: "stack-preset",
      reason: "blocking",
      prompt: "Which tech stack do you want?",
      answer_type: "single_select",
      options: listStackPresets().map((preset) => preset.stack_id),
      default_answer: "next-fullstack-postgres",
    });
  }
  if (plan.output_dir) {
    try {
      const entries = await fs.readdir(plan.output_dir);
      if (entries.length > 0) {
        questions.push({
          question_id: "output-dir-exists",
          reason: "blocking",
          prompt: "Output directory already exists and is not empty. Confirm overwrite or choose another path.",
          answer_type: "confirmation",
        });
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        questions.push({
          question_id: "output-dir-unreadable",
          reason: "blocking",
          prompt: `Output directory cannot be checked: ${error.message}`,
          answer_type: "path",
        });
      }
    }
  }
  for (const warning of plan.warnings ?? []) {
    if (warning.severity === "blocking" && warning.resolution_required) {
      questions.push({
        question_id: `resolve-${warning.warning_id}`,
        reason: "blocking",
        prompt: warning.suggested_question ?? warning.message,
        answer_type: "text",
      });
    }
  }
  return questions;
}

export function previewGenerationPlan(plan = {}) {
  return {
    schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
    status: plan.blocking_questions?.length ? "needs_input" : "preview",
    plan_id: plan.plan_id,
    domain_pack_id: plan.domain_pack_id,
    mode: plan.mode,
    stack_preset_id: plan.stack_preset_id,
    stack: plan.stack_preset
      ? {
        display_name: plan.stack_preset.display_name,
        dev_command: plan.stack_preset.dev_command,
        build_command: plan.stack_preset.build_command,
        deploy_target: plan.stack_preset.deploy_target,
      }
      : null,
    output_dir: plan.output_dir,
    modules: plan.modules ?? [],
    estimated_file_count: plan.generated_artifacts?.length ?? 0,
    generated_files: (plan.generated_artifacts ?? []).map((artifact) => artifact.relative_path),
    warnings: plan.warnings ?? [],
    blocking_questions: plan.blocking_questions ?? [],
    validation_commands: plan.validation_commands ?? [],
    next_action: plan.blocking_questions?.length
      ? "Answer blocking questions before generation."
      : "Run the same command with --confirm to write generated files.",
  };
}

export function confirmGeneration(plan = {}, { confirmed = false } = {}) {
  if (!confirmed) {
    return {
      schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
      status: "needs_confirmation",
      plan_id: plan.plan_id,
      message: "Preview generation plan and rerun with --confirm before file writes.",
    };
  }
  if (plan.blocking_questions?.length) {
    return {
      schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
      status: "blocked",
      plan_id: plan.plan_id,
      blocking_questions: plan.blocking_questions,
    };
  }
  return {
    schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
    status: "confirmed",
    plan_id: plan.plan_id,
    confirmation_token: `confirm-${randomUUID()}`,
  };
}

export async function generateProjectFromDomainAndStack(options = {}) {
  const plan = options.plan ?? await createDefaultGenerationPlan(options);
  const confirmation = confirmGeneration(plan, { confirmed: Boolean(options.confirmed ?? options.confirm) });
  if (confirmation.status !== "confirmed") {
    return {
      schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
      status: confirmation.status,
      plan,
      preview: previewGenerationPlan(plan),
      confirmation,
    };
  }

  const artifacts = generateArtifactsForPlan(plan);
  const writeResult = await writeGeneratedFiles({
    outputDir: plan.output_dir,
    artifacts,
    confirmed: true,
  });
  const validationResults = await validateGeneratedProject({
    projectRoot: plan.output_dir,
    artifacts,
  });
  const manifest = createGenerationManifest({
    plan,
    artifacts,
    prompts: [options.prompt ?? ""].filter(Boolean),
    assumptions: plan.assumptions ?? [],
    warnings: plan.warnings ?? [],
    validationResults,
    rollbackToken: writeResult.rollback_token,
    now: options.now,
  });
  const manifestValidation = validateGenerationManifest(manifest);
  const manifestArtifact = {
    artifact_id: "generation-manifest",
    kind: "manifest",
    relative_path: ".heart/generation-manifest.json",
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    source_refs: manifest.source_citations,
    story_ids: [],
    overwrite_policy: "confirm_overwrite",
  };
  await writeGeneratedFiles({
    outputDir: plan.output_dir,
    artifacts: [manifestArtifact],
    confirmed: true,
  });

  return {
    schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
    status: manifestValidation.status === "valid" && validationResults.every((result) => result.status !== "failed")
      ? "generated"
      : "generated_with_warnings",
    project: {
      project_id: plan.plan_id,
      root: plan.output_dir,
      domain_pack_id: plan.domain_pack_id,
      stack_preset_id: plan.stack_preset_id,
      manifest_path: path.join(plan.output_dir, manifestArtifact.relative_path),
      readme_path: path.join(plan.output_dir, "README.md"),
      next_story_id: "D2P-NEXT-1",
      validation_summary: validationResults,
    },
    plan,
    manifest,
    manifest_validation: manifestValidation,
    generated_files: writeResult.written_files,
    validation_results: validationResults,
    next_actions: [
      `heart ide --root ${plan.output_dir}`,
      `cd ${plan.output_dir} && ${plan.stack_preset?.dev_command ?? "npm run dev"}`,
      "Review .heart/generation-manifest.json before committing generated files.",
    ],
  };
}

export function generateDomainDocs(plan = {}) {
  return createSharedDocs(plan);
}

export function generateSalesDemoKit(plan = {}) {
  return [
    ...createSharedDocs(plan),
    artifact("docs/demo-kit/README.md", "doc", renderSalesDemoReadme(plan), ["D2P-GEN-2"]),
    artifact("docs/demo-kit/buyer-personas.md", "doc", renderBuyerPersonas(plan), ["D2P-GEN-2"]),
    artifact("docs/demo-kit/demo-script.md", "doc", renderDemoScript(plan), ["D2P-GEN-2"]),
    artifact("docs/demo-kit/proposal-starter.md", "doc", renderProposalStarter(plan), ["D2P-GEN-2"]),
    artifact("fixtures/tolling-demo-data.json", "fixture", renderDemoDataJson(), ["D2P-SEC-2"]),
    artifact("benchmarks/tolling-sales-demo-kit.json", "benchmark", renderBenchmarkScenarioJson(plan, "sales-demo"), ["D2P-GEN-2"]),
  ];
}

export function generateProjectStarter(plan = {}) {
  return [
    ...createSharedDocs(plan),
    ...createStackArtifacts(plan),
    artifact("fixtures/tolling-demo-data.json", "fixture", renderDemoDataJson(), ["D2P-GEN-4"]),
    artifact("benchmarks/tolling-product-starter.json", "benchmark", renderBenchmarkScenarioJson(plan, "product-starter"), ["D2P-GEN-4"]),
  ];
}

export function generateFrontendStarter(plan = {}) {
  return [
    ...createSharedDocs(plan),
    ...createStackArtifacts({ ...plan, mode: "ui-starter" }).filter((entry) => ["source", "test", "fixture"].includes(entry.kind)),
  ];
}

export function generateBackendStarter(plan = {}) {
  return [
    ...createSharedDocs(plan),
    ...createStackArtifacts({ ...plan, mode: "service-starter" }).filter((entry) =>
      entry.relative_path.includes("api") ||
      entry.relative_path.includes("server") ||
      entry.relative_path.includes("db") ||
      entry.relative_path.includes("test") ||
      entry.relative_path.includes("contracts")
    ),
  ];
}

export function generateDbSchema(plan = {}) {
  return [artifact(resolveDbSchemaPath(plan), "migration", renderSchemaSql(), ["D2P-GEN-4"])];
}

export function generateApiContracts(plan = {}) {
  return [artifact("docs/api-contracts.md", "doc", renderApiDoc(plan), ["D2P-GEN-4"])];
}

export function generateUiPrototype(plan = {}) {
  return [artifact("docs/ui-prototype.md", "doc", renderUiDoc(plan), ["D2P-GEN-4"])];
}

export function generateTests(plan = {}) {
  return createStackArtifacts(plan).filter((entry) => entry.kind === "test");
}

export function generateDemoData() {
  return [artifact("fixtures/tolling-demo-data.json", "fixture", renderDemoDataJson(), ["D2P-SEC-2"])];
}

export function generateBenchmarkScenarios(plan = {}) {
  return [artifact("benchmarks/tolling-product-starter.json", "benchmark", renderBenchmarkScenarioJson(plan, plan.mode), ["D2P-GEN-4"])];
}

export async function writeGeneratedFiles({ outputDir, artifacts = [], confirmed = false } = {}) {
  if (!confirmed) {
    return {
      schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
      status: "needs_confirmation",
      message: "Generated file writes require confirmation.",
    };
  }
  const root = path.resolve(outputDir);
  const rollbackToken = `rollback-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const written = [];
  const existing = [];

  for (const item of artifacts) {
    const relativePath = normalizeRelativeArtifactPath(item.relative_path);
    const targetPath = path.join(root, relativePath);
    assertInside(root, targetPath);
    try {
      await fs.access(targetPath);
      existing.push(relativePath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  await fs.mkdir(path.join(root, ".heart", "rollback", rollbackToken), { recursive: true });

  for (const item of artifacts) {
    const relativePath = normalizeRelativeArtifactPath(item.relative_path);
    const targetPath = path.join(root, relativePath);
    assertInside(root, targetPath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    let prior = null;
    try {
      prior = await fs.readFile(targetPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (prior) {
      const rollbackPath = path.join(root, ".heart", "rollback", rollbackToken, relativePath);
      assertInside(path.join(root, ".heart", "rollback", rollbackToken), rollbackPath);
      await fs.mkdir(path.dirname(rollbackPath), { recursive: true });
      await fs.writeFile(rollbackPath, prior);
    }
    await fs.writeFile(targetPath, item.content ?? "", "utf8");
    written.push(targetPath);
  }

  return {
    schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
    status: "written",
    output_dir: root,
    written_files: written,
    overwritten_files: existing,
    rollback_token: rollbackToken,
  };
}

export async function validateGeneratedProject({ projectRoot, artifacts = [] } = {}) {
  const results = [];
  const serialized = artifacts.map((entry) => `${entry.relative_path}\n${entry.content ?? ""}`).join("\n");
  const secretFindings = scanSecretLikeText(serialized);
  const unsafeDemoFindings = scanUnsafeDemoData(serialized);
  results.push({
    check_id: "secret-scan",
    status: secretFindings.length ? "failed" : "passed",
    message: secretFindings.length ? `Secret-like content found: ${secretFindings.map((entry) => entry.id).join(", ")}` : "No secret-like generated content found.",
  });
  results.push({
    check_id: "fake-demo-data",
    status: unsafeDemoFindings.length ? "failed" : "passed",
    message: unsafeDemoFindings.length ? `Unsafe demo data found: ${unsafeDemoFindings.map((entry) => entry.id).join(", ")}` : "Generated demo data uses obvious fake placeholders.",
  });
  results.push({
    check_id: "path-safety",
    status: artifacts.every((entry) => isSafeRelativeArtifactPath(entry.relative_path)) ? "passed" : "failed",
    message: "Generated artifact paths stay relative to output directory.",
  });
  try {
    await fs.access(path.join(projectRoot, "README.md"));
    results.push({ check_id: "readme", status: "passed", message: "README.md generated." });
  } catch {
    results.push({ check_id: "readme", status: "warning", message: "README.md not found in generated project." });
  }
  return results;
}

export function openGeneratedProjectInIde(project = {}) {
  return {
    schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
    status: "ready",
    repo_root: project.root,
    domain_pack_id: project.domain_pack_id,
    stack_preset_id: project.stack_preset_id,
    manifest_path: project.manifest_path,
    next_story_id: project.next_story_id,
  };
}

export function attachDomainContextToChat({ plan, domainPack } = {}) {
  return {
    schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
    type: "domain_pack",
    label: domainPack?.name ?? plan?.domain_pack_id ?? "Domain pack",
    summary: plan?.effective_rules_summary ?? domainPack?.description ?? "",
    source_ref: plan?.domain_pack_id ?? domainPack?.pack_id ?? "",
    data: {
      plan_id: plan?.plan_id,
      mode: plan?.mode,
      stack_preset_id: plan?.stack_preset_id,
      modules: plan?.modules ?? [],
      warnings: plan?.warnings ?? [],
    },
  };
}

export function updateDocsAfterCodeChange({ diffSummary = "", docs = [] } = {}) {
  return {
    schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
    status: "proposal",
    summary: "Review generated docs against accepted code changes.",
    diff_summary: String(diffSummary).slice(0, 2000),
    docs_to_review: docs,
    next_action: "Run heart ide docs and accept a scoped docs/spec patch.",
  };
}

export async function continueFromStory({ projectRoot, storyId = "D2P-NEXT-1" } = {}) {
  const manifestPath = path.join(projectRoot, ".heart", "generation-manifest.json");
  let manifest = null;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    manifest = null;
  }
  return {
    schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
    status: manifest ? "ready" : "missing_manifest",
    story_id: storyId,
    manifest_path: manifestPath,
    domain_pack_id: manifest?.domain_pack_id,
    stack_preset_id: manifest?.stack_preset_id,
    context_files: (manifest?.generated_files ?? [])
      .filter((file) => (file.story_ids ?? []).includes(storyId) || file.kind === "doc")
      .map((file) => file.relative_path),
    next_action: manifest ? "Attach this story context to chat or patch generation." : "Open a generated project with a generation manifest.",
  };
}

export { listStackPresets, selectStackPreset, validateStackPreset };

function generateArtifactsForPlan(plan) {
  if (plan.mode === "docs-only") return generateDomainDocs(plan);
  if (plan.mode === "sales-demo") return generateSalesDemoKit(plan);
  if (plan.mode === "service-starter") return generateBackendStarter(plan);
  if (plan.mode === "ui-starter") return generateFrontendStarter(plan);
  return generateProjectStarter(plan);
}

function createSharedDocs(plan) {
  return [
    artifact("README.md", "doc", renderReadme(plan), ["D2P-GEN-3"]),
    artifact("docs/domain-summary.md", "doc", renderDomainSummary(plan), ["D2P-COMP-4"]),
    artifact("docs/architecture.md", "doc", renderArchitectureDoc(plan), ["D2P-GEN-1"]),
    artifact("docs/data-model.md", "doc", renderDataModelDoc(), ["D2P-GEN-1"]),
    artifact("docs/api.md", "doc", renderApiDoc(plan), ["D2P-GEN-1"]),
    artifact("docs/ui.md", "doc", renderUiDoc(plan), ["D2P-GEN-1"]),
    artifact("docs/security.md", "doc", renderSecurityDoc(plan), ["D2P-SEC-2", "D2P-SEC-3"]),
    artifact("docs/implementation-backlog.md", "doc", renderBacklog(plan), ["D2P-CLI-5"]),
    artifact("docs/benchmarks.md", "doc", renderBenchmarkDoc(plan), ["D2P-GEN-4"]),
    artifact(".heart/context/domain-context.json", "manifest", `${JSON.stringify(createDomainContext(plan), null, 2)}\n`, ["D2P-COMP-4"]),
  ];
}

function createStackArtifacts(plan) {
  if (plan.stack_preset_id === "react-node-postgres") return createReactNodeArtifacts(plan);
  if (plan.stack_preset_id === "spring-react-postgres") return createSpringReactArtifacts(plan);
  return createNextFullstackArtifacts(plan);
}

function createNextFullstackArtifacts(plan) {
  return [
    artifact("package.json", "source", JSON.stringify({
      name: `${plan.domain_pack_id}-${plan.mode}`,
      private: true,
      type: "module",
      scripts: {
        dev: "next dev",
        build: "next build",
        test: "node --test",
      },
      dependencies: {
        next: "latest",
        react: "latest",
        "react-dom": "latest",
      },
      devDependencies: {},
    }, null, 2) + "\n", ["D2P-GEN-3"]),
    artifact(".env.example", "doc", "DATABASE_URL=postgres://user:password@localhost:5432/tolling_demo\nPAYMENT_PROVIDER=hosted-payment-placeholder\n", ["D2P-SEC-3"]),
    artifact("app/page.tsx", "source", renderNextPage(plan), ["D2P-GEN-4"]),
    artifact("app/api/accounts/route.ts", "source", renderNextApiRoute(), ["D2P-GEN-4"]),
    artifact("lib/domain/tolling.ts", "source", renderDomainModuleTs(), ["D2P-GEN-4"]),
    artifact("db/schema.sql", "migration", renderSchemaSql(), ["D2P-GEN-4"]),
    artifact("tests/domain.test.js", "test", renderNodeTest(), ["D2P-QA-1"]),
  ];
}

function createReactNodeArtifacts(plan) {
  return [
    artifact("package.json", "source", JSON.stringify({
      name: `${plan.domain_pack_id}-${plan.mode}`,
      private: true,
      type: "module",
      workspaces: ["apps/*", "services/*", "packages/*"],
      scripts: {
        dev: "node services/api/src/server.js",
        build: "node --check services/api/src/server.js",
        test: "node --test",
      },
    }, null, 2) + "\n", ["D2P-GEN-3"]),
    artifact("apps/web/src/App.jsx", "source", renderReactApp(plan), ["D2P-GEN-4"]),
    artifact("services/api/src/server.js", "source", renderNodeServer(), ["D2P-GEN-4"]),
    artifact("packages/contracts/src/tolling.js", "source", renderContractsJs(), ["D2P-GEN-4"]),
    artifact("db/schema.sql", "migration", renderSchemaSql(), ["D2P-GEN-4"]),
    artifact("tests/domain.test.js", "test", renderNodeTest(), ["D2P-QA-1"]),
  ];
}

function createSpringReactArtifacts(plan) {
  return [
    artifact("services/api-spring/pom.xml", "source", renderPomXml(plan), ["D2P-GEN-3"]),
    artifact("services/api-spring/src/main/java/dev/beheart/tolling/TollingApplication.java", "source", renderSpringApplication(), ["D2P-GEN-4"]),
    artifact("services/api-spring/src/test/java/dev/beheart/tolling/TollingApplicationTests.java", "test", renderSpringTest(), ["D2P-QA-1"]),
    artifact("apps/web/src/App.jsx", "source", renderReactApp(plan), ["D2P-GEN-4"]),
    artifact("db/migrations/V1__tolling_starter.sql", "migration", renderSchemaSql(), ["D2P-GEN-4"]),
  ];
}

function createPlannedArtifacts({ planId, domainId, mode, stackPreset, modules }) {
  const plan = { plan_id: planId, domain_pack_id: domainId, mode, stack_preset_id: stackPreset?.stack_id, stack_preset: stackPreset, modules };
  return generateArtifactsForPlan(plan).map(({ content: _content, ...entry }) => entry);
}

function resolveModulesForPlan({ domainId, mode }) {
  if (domainId !== "tolling-management") return ["domain-core", "docs", "benchmarks"];
  if (mode === "sales-demo") return ["sales-demo-kit", "account-360", "customer-portal", "architecture", "roi-story"];
  if (mode === "docs-only") return ["domain-docs", "architecture", "data-model", "api", "ui", "security", "benchmarks"];
  if (mode === "service-starter") return TOLLING_MODULES.filter((moduleName) => !["reports"].includes(moduleName));
  if (mode === "ui-starter") return ["account-360", "customer-portal", "case-workspace", "payment-placeholder", "reports"];
  return [...TOLLING_MODULES];
}

function createValidationCommands(stackPreset, mode) {
  if (!stackPreset || mode === "docs-only") return ["Review generated docs and .heart/generation-manifest.json"];
  return [stackPreset.build_command, "node --test"];
}

function createAssumptions({ mode, stackPreset, domainId }) {
  return [
    `${domainId} generated output uses fake demo data only.`,
    "Payment flows use hosted/tokenized placeholders; no raw card handling is generated.",
    "Toll rates, fee amounts, notice windows, collections policy, and legal outcomes require customer-approved sources.",
    stackPreset ? `${stackPreset.display_name} is selected as implementation stack.` : "Stack preset must be selected before write.",
    `${mode} output is starter/demo code, not production runtime approval.`,
  ];
}

function artifact(relativePath, kind, content, storyIds = []) {
  return {
    artifact_id: createHash("sha256").update(`${relativePath}:${kind}`).digest("hex").slice(0, 12),
    kind,
    relative_path: relativePath,
    content,
    source_refs: [{ source_ref: "tolling-management", label: "Tolling Management Domain Pack", path_or_url: "packs/tolling-management" }],
    story_ids: storyIds,
    overwrite_policy: "confirm_overwrite",
  };
}

function renderReadme(plan) {
  return `# ${titleCase(plan.domain_pack_id)} Starter

Generated by beheart Domain-to-Project.

## Stack

- ${plan.stack_preset?.display_name ?? "Docs only"}
- Mode: ${plan.mode}
- Domain pack: ${plan.domain_pack_id}

## Run

${plan.stack_preset ? `\`\`\`bash\n${plan.stack_preset.dev_command}\n${plan.stack_preset.build_command}\n\`\`\`` : "Review generated docs and manifest."}

## Safety

- Demo data is fake.
- Payment flow is a hosted/tokenized placeholder.
- Customer-specific toll rates, fees, deadlines, legal text, and collections policy are not generated.
- Review \`.heart/generation-manifest.json\` before committing.
`;
}

function renderDomainSummary(plan) {
  return `# Domain Summary

Domain pack: \`${plan.domain_pack_id}\`

${plan.effective_rules_summary || "Effective domain rules are attached through the generation manifest."}

## Modules

${(plan.modules ?? []).map((moduleName) => `- ${moduleName}`).join("\n")}

## Assumptions

${(plan.assumptions ?? []).map((assumption) => `- ${assumption}`).join("\n")}
`;
}

function renderArchitectureDoc(plan) {
  return `# Architecture

## Boundary

This starter separates domain rules, UI routes, API/service handlers, database schema, fixtures, tests, and benchmark scenarios.

## Stack

${plan.stack_preset?.display_name ?? "Docs-only output"}

## Tolling Modules

${(plan.modules ?? []).map((moduleName) => `- ${moduleName}`).join("\n")}

## Runtime Boundaries

- Hosted payment capture is a placeholder.
- OCR/image review is a placeholder.
- Agency integrations are placeholders.
- Audit events are required before money, evidence, account, or dispute state changes.
`;
}

function renderDataModelDoc() {
  return `# Data Model

Core tables:

- accounts
- vehicles
- transponders
- toll_events
- trips
- toll_charges
- invoices
- payments
- ledger_entries
- disputes
- cases
- inventory_items
- notifications
- audit_logs

Use Postgres constraints, idempotency keys, append-only ledger entries, and audit logs before production implementation.
`;
}

function renderApiDoc() {
  return `# API And Service Structure

Suggested service boundaries:

- account-service
- trip-posting-service
- invoice-service
- payment-placeholder-service
- case-service
- inventory-service
- notification-service
- reporting-service
- audit-service

All money-changing and evidence-changing actions require audit.
`;
}

function renderUiDoc() {
  return `# UI Screens

Back-office:

- Customer search
- Agent Account 360
- Trips/tolls/invoices
- Funds/payment placeholder
- Cases/disputes
- Inventory/fulfillment
- Notification center
- Reports

Customer portal:

- Account home
- Pay bill placeholder
- Trips and invoices
- Dispute flow
- Vehicles and tags
- Notification preferences
`;
}

function renderSecurityDoc() {
  return `# Security Notes

- No real PII, plates, plate images, trip histories, support transcripts, raw card data, bank data, credentials, or production endpoints in generated output.
- Payment flow uses hosted/tokenized placeholders only.
- Plate, owner, account, image, payment status, and trip fields are sensitive by default.
- Risky actions require authorization, reason, policy citation, and audit.
- Generated ROI language is hypothesis unless observed benchmark evidence exists.
`;
}

function renderBacklog(plan) {
  return `# Implementation Backlog

## D2P-NEXT-1: Validate Generated Starter

- Run generated validation commands.
- Review manifest warnings.
- Confirm fake data and payment placeholders.

## D2P-NEXT-2: Implement Account 360 Read Model

- Build read-only account view.
- Add fixtures and tests.
- Keep risky actions disabled.

## D2P-NEXT-3: Implement Trip Posting Idempotency

- Add idempotency key for toll events and trips.
- Add duplicate replay tests.
- Add audit notes for financial posting.

## D2P-NEXT-4: Update Docs After First Code Change

- Sync README, architecture, API, and data model docs with accepted code changes.

Mode: ${plan.mode}
`;
}

function renderBenchmarkDoc(plan) {
  return `# Benchmark Scenarios

Use generated benchmark manifests to compare baseline AI work against pack-assisted work.

Measurement labels:

- observed: captured through BeHeart telemetry
- estimated: scenario or fixture input
- hypothesis: sales/demo story only

Starter scenario:

- tolling-trip-posting-dedupe
- tolling-support-smishing-guidance
- tolling-low-confidence-image-review

Generated mode: ${plan.mode}
`;
}

function renderSalesDemoReadme() {
  return `# Tolling Sales Demo Kit

This kit is for discovery, sales, proposal, and design-partner conversations. It is not a production tolling runtime.

Show first:

1. Agent Account 360.
2. Roadside-to-back-office flow.
3. Payment/security posture.
4. Customer portal self-service.
5. Benchmark hypothesis.
`;
}

function renderBuyerPersonas() {
  return `# Buyer Personas

- Agency CTO: architecture, integrations, security, uptime.
- Operations director: queues, exceptions, SLA, case throughput.
- Finance leader: ledger safety, PCI scope, reconciliation.
- Customer service director: Account 360, safe actions, support deflection.
- Vendor founder: credible demo, proposal starter, implementation roadmap.
`;
}

function renderDemoScript() {
  return `# Demo Script

## 5 minutes

Show problem, Account 360, security posture, and benchmark plan.

## 15 minutes

Walk account search, trips, invoice, payment placeholder, dispute, and fulfillment.

## 30 minutes

Add architecture, DB/API map, implementation backlog, and validation path.
`;
}

function renderProposalStarter() {
  return `# Proposal Starter

## Scope

- Back-office Account 360
- Customer portal
- Trip posting and invoice workflows
- Case/dispute workflow
- Payment placeholder with hosted provider handoff
- Benchmark plan

## Assumptions

- All operational values require customer-approved source documents.
- Demo data is fake.
- Production integrations are deferred.
`;
}

function renderDemoDataJson() {
  return `${JSON.stringify({
    schema_version: 1,
    demo_only: true,
    accounts: [
      {
        account_id: "ACCT-DEMO-1001",
        display_name: "Demo Account Holder",
        plate_masked: "DEMO-PLATE-01",
        tag_ref: "TAG-DEMO-7001",
        balance_label: "Demo balance",
      },
    ],
    trips: [
      {
        trip_id: "TRIP-DEMO-3001",
        facility_label: "Demo Tollway",
        status: "posted-demo",
      },
    ],
    payments: [
      {
        payment_id: "PAY-DEMO-5001",
        method: "hosted-payment-placeholder",
        status: "demo-only",
      },
    ],
  }, null, 2)}\n`;
}

function renderBenchmarkScenarioJson(plan, scenarioType) {
  return `${JSON.stringify({
    schema_version: 1,
    id: `tolling-${scenarioType}`,
    title: `Tolling ${titleCase(scenarioType)} Pack-Assisted Scenario`,
    measurement_mode: "hypothesis",
    domain_pack_id: plan.domain_pack_id,
    stack_preset_id: plan.stack_preset_id,
    task_prompt: "Implement a tolling workflow with source-cited domain rules, fake data, tests, and security notes.",
    guardrails: [
      "No real PII or payment data.",
      "Payment capture remains hosted/tokenized placeholder.",
      "Money-changing actions require audit.",
      "Do not invent toll rates, fees, legal deadlines, or collections outcomes.",
    ],
  }, null, 2)}\n`;
}

function renderNextPage(plan) {
  return `export default function Page() {
  const modules = ${JSON.stringify(plan.modules ?? [], null, 2)};
  return (
    <main>
      <h1>Tolling Management Starter</h1>
      <p>Domain-aware starter generated by beheart. Demo data only.</p>
      <ul>{modules.map((moduleName) => <li key={moduleName}>{moduleName}</li>)}</ul>
    </main>
  );
}
`;
}

function renderNextApiRoute() {
  return `import { listDemoAccounts } from "../../../lib/domain/tolling";

export async function GET() {
  return Response.json({ accounts: listDemoAccounts(), demo_only: true });
}
`;
}

function renderDomainModuleTs() {
  return `export function listDemoAccounts() {
  return [
    {
      accountId: "ACCT-DEMO-1001",
      displayName: "Demo Account Holder",
      plateMasked: "DEMO-PLATE-01",
      paymentBoundary: "hosted-payment-placeholder",
    },
  ];
}

export function requiresAudit(action: string) {
  return ["money-change", "evidence-change", "account-status-change", "dispute-resolution"].includes(action);
}
`;
}

function renderReactApp(plan) {
  return `export function App() {
  const modules = ${JSON.stringify(plan.modules ?? [], null, 2)};
  return (
    <main>
      <h1>Tolling Management Workbench</h1>
      <p>Generated starter. Demo data only.</p>
      <ul>{modules.map((moduleName) => <li key={moduleName}>{moduleName}</li>)}</ul>
    </main>
  );
}
`;
}

function renderNodeServer() {
  return `import http from "node:http";

const demoAccounts = [{ account_id: "ACCT-DEMO-1001", plate_masked: "DEMO-PLATE-01" }];

const server = http.createServer((request, response) => {
  if (request.url === "/api/accounts") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ demo_only: true, accounts: demoAccounts }));
    return;
  }
  response.statusCode = 404;
  response.end("not found");
});

server.listen(process.env.PORT || 3001);
`;
}

function renderContractsJs() {
  return `export const TOLLING_MODULES = [
  "account-360",
  "trip-posting",
  "invoices-payments",
  "cases-disputes",
  "inventory-fulfillment",
  "audit-security",
];
`;
}

function renderPomXml(plan) {
  return `<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>dev.beheart</groupId>
  <artifactId>${plan.domain_pack_id}-starter</artifactId>
  <version>0.1.0</version>
  <properties>
    <java.version>21</java.version>
  </properties>
</project>
`;
}

function renderSpringApplication() {
  return `package dev.beheart.tolling;

public class TollingApplication {
  public static void main(String[] args) {
    System.out.println("Tolling starter uses demo data only.");
  }
}
`;
}

function renderSpringTest() {
  return `package dev.beheart.tolling;

class TollingApplicationTests {
  void generatedStarterKeepsDemoBoundary() {
    assert true;
  }
}
`;
}

function renderSchemaSql() {
  return `create table accounts (
  id text primary key,
  account_no text not null unique,
  status text not null,
  balance_snapshot_label text not null
);

create table toll_events (
  id text primary key,
  source_ref text not null,
  payload_hash text not null unique,
  event_time timestamptz not null
);

create table trips (
  id text primary key,
  account_id text references accounts(id),
  dedupe_key text not null unique,
  status text not null
);

create table ledger_entries (
  id text primary key,
  account_id text references accounts(id),
  amount_label text not null,
  entry_type text not null,
  reason_code text not null,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id text primary key,
  actor_ref text not null,
  action text not null,
  resource_ref text not null,
  reason_code text,
  created_at timestamptz not null default now()
);
`;
}

function renderNodeTest() {
  return `import test from "node:test";
import assert from "node:assert/strict";

test("generated starter keeps payment boundary explicit", () => {
  assert.match("hosted-payment-placeholder", /hosted-payment/);
});
`;
}

function createDomainContext(plan) {
  return {
    schema_version: PROJECT_GENERATOR_SCHEMA_VERSION,
    domain_pack_id: plan.domain_pack_id,
    mode: plan.mode,
    stack_preset_id: plan.stack_preset_id,
    modules: plan.modules,
    assumptions: plan.assumptions,
    warnings: plan.warnings,
  };
}

function resolveDbSchemaPath(plan) {
  return plan.stack_preset_id === "spring-react-postgres" ? "db/migrations/V1__tolling_starter.sql" : "db/schema.sql";
}

function createStablePlanId(input) {
  return `plan-${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 12)}`;
}

function createStableId(input) {
  return createHash("sha256").update(String(input)).digest("hex").slice(0, 12);
}

function normalizeRelativeArtifactPath(relativePath) {
  const normalized = path.posix.normalize(String(relativePath ?? "").replace(/\\/g, "/"));
  if (!isSafeRelativeArtifactPath(normalized)) {
    throw new Error(`Unsafe generated artifact path: ${relativePath}`);
  }
  return normalized;
}

function isSafeRelativeArtifactPath(relativePath) {
  const value = String(relativePath ?? "");
  const normalized = path.posix.normalize(value.replace(/\\/g, "/"));
  return Boolean(normalized) && normalized !== "." && !normalized.startsWith("../") && !path.isAbsolute(normalized);
}

function assertInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Refusing to write outside the selected output directory.");
  }
}

function titleCase(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
