export const TOOL_SAFETY_LEVELS = Object.freeze({
  readOnly: "read_only",
  confirmationRequired: "confirmation_required",
  denied: "denied",
});

export const ALLOWED_AGENT_TOOLS = Object.freeze([
  tool("scan_repo", "Scan repo", "Refresh local repo memory through the CLI runner.", TOOL_SAFETY_LEVELS.confirmationRequired),
  tool("create_context_pack", "Create context pack", "Create a task-focused beheart context pack.", TOOL_SAFETY_LEVELS.confirmationRequired),
  tool("search_docs", "Search docs/specs", "Search synced docs and specs.", TOOL_SAFETY_LEVELS.readOnly),
  tool("query_graph", "Query repo graph", "Read synced graph nodes, edges, and diagrams.", TOOL_SAFETY_LEVELS.readOnly),
  tool("show_diagrams", "Show diagrams", "Return existing diagram artifact links.", TOOL_SAFETY_LEVELS.readOnly),
  tool("validate_policy", "Validate policy", "Check policy warnings against current artifacts.", TOOL_SAFETY_LEVELS.readOnly),
  tool("list_domain_packs", "List domain packs", "List available domain packs.", TOOL_SAFETY_LEVELS.readOnly),
  tool("list_stack_presets", "List stack presets", "List supported domain-to-project tech stacks.", TOOL_SAFETY_LEVELS.readOnly),
  tool("preview_domain_project", "Preview domain project", "Create a domain-to-project generation plan without writing files.", TOOL_SAFETY_LEVELS.readOnly),
  tool("generate_domain_project", "Generate domain project", "Generate a project from a domain pack and stack preset.", TOOL_SAFETY_LEVELS.confirmationRequired),
  tool("build_domain_pack_artifact", "Build domain pack artifact", "Generate pack artifacts such as sales demo kits.", TOOL_SAFETY_LEVELS.confirmationRequired),
  tool("generate_sales_demo_kit", "Generate sales demo kit", "Generate source-backed sales demo kit artifacts.", TOOL_SAFETY_LEVELS.confirmationRequired),
  tool("run_benchmark_scenario", "Run benchmark scenario", "Run a benchmark scenario and capture evidence.", TOOL_SAFETY_LEVELS.confirmationRequired),
  tool("summarize_repo", "Summarize repo", "Summarize synced repo memory.", TOOL_SAFETY_LEVELS.readOnly),
  tool("create_implementation_plan", "Create implementation plan", "Create a source-backed implementation plan.", TOOL_SAFETY_LEVELS.readOnly),
  tool("propose_file_edit", "Propose scoped file edit", "Prepare a BeHeart artifact write proposal without modifying files.", TOOL_SAFETY_LEVELS.readOnly),
  tool("apply_scoped_file_edit", "Apply scoped file edit", "Write only confirmed BeHeart generated artifacts or docs/spec outputs.", TOOL_SAFETY_LEVELS.confirmationRequired),
]);

const TOOL_BY_ID = new Map(ALLOWED_AGENT_TOOLS.map((entry) => [entry.tool_id, entry]));

export function listAllowedTools() {
  return ALLOWED_AGENT_TOOLS.map((entry) => ({ ...entry }));
}

export async function executeAgentTool({
  toolId,
  input = {},
  confirmed = false,
  executors = {},
} = {}) {
  const safeToolId = String(toolId ?? "").trim();
  const definition = TOOL_BY_ID.get(safeToolId);
  if (!definition) {
    return {
      schema_version: 1,
      tool_id: safeToolId,
      status: "denied",
      safety_level: TOOL_SAFETY_LEVELS.denied,
      message: "Tool is not allowlisted for BeHeart chat.",
    };
  }
  if (definition.safety_level === TOOL_SAFETY_LEVELS.confirmationRequired && !confirmed) {
    return {
      schema_version: 1,
      tool_id: safeToolId,
      status: "needs_confirmation",
      safety_level: definition.safety_level,
      message: "This BeHeart action needs explicit confirmation before execution.",
      definition,
    };
  }

  const executor = executors[safeToolId];
  if (typeof executor === "function") {
    return executor(input, { definition });
  }

  return {
    schema_version: 1,
    tool_id: safeToolId,
    status: "prepared",
    safety_level: definition.safety_level,
    message: `${definition.label} is allowlisted. A runtime executor can handle it in CLI or portal context.`,
    definition,
    input: sanitizeToolInput(input),
  };
}

export function isRiskyTool(toolId) {
  return TOOL_BY_ID.get(String(toolId ?? "").trim())?.safety_level === TOOL_SAFETY_LEVELS.confirmationRequired;
}

export function isToolAllowed(toolId) {
  return TOOL_BY_ID.has(String(toolId ?? "").trim());
}

function tool(toolId, label, description, safetyLevel) {
  return {
    schema_version: 1,
    tool_id: toolId,
    name: toolId,
    label,
    description,
    safety_level: safetyLevel,
    requires_confirmation: safetyLevel === TOOL_SAFETY_LEVELS.confirmationRequired,
  };
}

function sanitizeToolInput(input) {
  if (!input || typeof input !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (/api[_-]?key|secret|password|^token$|(?:access|refresh|id|session|auth)[_-]?token/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, typeof value === "string" ? value.slice(0, 500) : value];
    }),
  );
}
