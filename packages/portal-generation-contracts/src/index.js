export const PORTAL_GENERATION_CONTRACT_SCHEMA_VERSION = 1;

export function createGenerationPlanContract(plan = {}) {
  return {
    schema_version: PORTAL_GENERATION_CONTRACT_SCHEMA_VERSION,
    plan_id: plan.plan_id,
    domain_pack_id: plan.domain_pack_id,
    mode: plan.mode,
    stack_preset_id: plan.stack_preset_id,
    output_dir: plan.output_dir,
    modules: plan.modules ?? [],
    generated_artifacts: (plan.generated_artifacts ?? []).map((artifact) => ({
      kind: artifact.kind,
      relative_path: artifact.relative_path,
      story_ids: artifact.story_ids ?? [],
      overwrite_policy: artifact.overwrite_policy,
    })),
    warnings: plan.warnings ?? [],
    blocking_questions: plan.blocking_questions ?? [],
    validation_commands: plan.validation_commands ?? [],
    status: plan.blocking_questions?.length ? "needs_input" : "ready_for_preview",
  };
}

export function createGeneratedArtifactViewerContract({ manifest, files = [] } = {}) {
  return {
    schema_version: PORTAL_GENERATION_CONTRACT_SCHEMA_VERSION,
    manifest,
    files: files.map((file) => ({
      relative_path: file.relative_path ?? file.path,
      kind: file.kind ?? "doc",
      content_preview: String(file.content ?? "").slice(0, 4000),
    })),
    warnings: manifest?.warnings ?? [],
    validation_results: manifest?.validation_results ?? [],
  };
}
