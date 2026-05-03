export const PORTAL_CHAT_SCHEMA_VERSION = 1;

export const STREAMING_EVENTS = Object.freeze({
  runStarted: "run_started",
  assistantDelta: "assistant_delta",
  toolCallStarted: "tool_call_started",
  toolCallCompleted: "tool_call_completed",
  usage: "usage",
  runCompleted: "run_completed",
  runFailed: "run_failed",
});

export const CONTEXT_ATTACHMENT_TYPES = Object.freeze({
  repo: "repo",
  contextPack: "context_pack",
  repoGraph: "repo_graph",
  docs: "docs",
  domainPack: "domain_pack",
  benchmark: "benchmark",
  salesDemoKit: "sales_demo_kit",
});

export function createChatSession({
  sessionId,
  workspaceSlug,
  repoSlug,
  providerId,
  modelId,
  mode = "code_context",
  actorSlug = "",
} = {}) {
  const now = new Date().toISOString();
  return {
    schema_version: PORTAL_CHAT_SCHEMA_VERSION,
    session_id: sessionId,
    workspace_slug: workspaceSlug,
    repo_slug: repoSlug,
    provider_id: providerId,
    model_id: modelId,
    mode,
    actor_slug: actorSlug,
    title: "BeHeart chat",
    status: "active",
    created_at: now,
    updated_at: now,
    messages: [],
    context_attachments: [],
  };
}

export function createChatMessage({ messageId, role, content, createdAt = new Date().toISOString(), metadata = {} } = {}) {
  return {
    schema_version: PORTAL_CHAT_SCHEMA_VERSION,
    message_id: messageId,
    role,
    content: String(content ?? ""),
    created_at: createdAt,
    citations: metadata.citations ?? [],
    artifact_cards: metadata.artifact_cards ?? [],
    tool_calls: metadata.tool_calls ?? [],
    usage: metadata.usage ?? null,
    cost: metadata.cost ?? null,
    safety_warnings: metadata.safety_warnings ?? [],
  };
}

export function createContextAttachment({
  attachmentId,
  type,
  label,
  summary = "",
  sourceRef = "",
  citations = [],
  tokenEstimate = 0,
  data = {},
} = {}) {
  return {
    schema_version: PORTAL_CHAT_SCHEMA_VERSION,
    attachment_id: attachmentId,
    type,
    label,
    summary,
    source_ref: sourceRef,
    citations,
    token_estimate: Number(tokenEstimate ?? 0),
    data,
  };
}

export function createCitation({ type, label, ref, source = "beheart" } = {}) {
  return {
    schema_version: PORTAL_CHAT_SCHEMA_VERSION,
    type,
    label,
    ref,
    source,
  };
}

export function createArtifactCard({ cardType, title, summary, status = "ready", href = "", data = {} } = {}) {
  return {
    schema_version: PORTAL_CHAT_SCHEMA_VERSION,
    card_type: cardType,
    title,
    summary,
    status,
    href,
    data,
  };
}
