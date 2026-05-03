import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  METRIC_SOURCE_TYPES,
} from "../../../packages/shared-schema/src/enterprise.js";
import {
  getDomainPack,
  listDomainPacks,
  writePackArtifact,
} from "../../../packages/core/src/index.js";
import {
  getProviderDefinition,
  listProviderModels,
  listProviders,
  maskSecret,
  normalizeProviderId,
  redactProviderSecrets,
  resolveProviderCredential,
} from "../../../packages/model-registry/src/index.js";
import { validateProviderCredential } from "../../../packages/ai-gateway/src/index.js";
import {
  attachContextPack,
  buildContextAttachment,
  createChatSession as createRuntimeChatSession,
  sendChatMessage as runChatRuntimeMessage,
  streamChatMessage as runStreamingChatRuntimeMessage,
} from "../../../packages/chat-runtime/src/index.js";
import {
  executeAgentTool,
  listAllowedTools,
} from "../../../packages/agent-tools/src/index.js";
import { getServiceStoragePaths } from "./storage.js";

const CHAT_INTENTS = Object.freeze({
  scanRepo: "scan_repo",
  generateContextPack: "generate_context_pack",
  showGraph: "show_graph",
  explainArchitecture: "explain_architecture",
  searchDocs: "search_docs",
  compareBenchmark: "compare_benchmark",
  updateStoryStatus: "update_story_status",
  showPolicyViolations: "show_policy_violations",
  domainPackGet: "domain_pack_get",
  domainPackGenerate: "domain_pack_generate",
  domainPackConflicts: "domain_pack_conflicts",
  domainPackBenchmarks: "domain_pack_benchmarks",
});

const PURPOSE_PRESETS = Object.freeze([
  {
    preset_id: "planning",
    label: "Planning",
    description: "Architecture, implementation plans, and project sequencing.",
    default_context_budget: 8000,
  },
  {
    preset_id: "code_context",
    label: "Code context",
    description: "Repo-aware answers grounded in graph, docs, and context packs.",
    default_context_budget: 12000,
  },
  {
    preset_id: "docs_spec_sync",
    label: "Docs/spec sync",
    description: "Requirements, decisions, and stale document review.",
    default_context_budget: 10000,
  },
  {
    preset_id: "benchmark_eval",
    label: "Benchmark eval",
    description: "ROI and evidence bundle analysis.",
    default_context_budget: 6000,
  },
  {
    preset_id: "admin_analysis",
    label: "Admin analysis",
    description: "Founder and operator metrics review.",
    default_context_budget: 6000,
  },
]);

export function buildRepositorySyncStatusContract({
  profile,
  documents,
  benchmarkHistory,
  workspace,
  repositoryServices,
  contextPacks = [],
} = {}) {
  const profileGeneratedAt = safeIso(profile?.generated_at);
  const documentGeneratedAt = safeIso(documents?.generated_at);
  const latestBenchmarkAt = latestIso((benchmarkHistory?.reports ?? []).map((report) => report.generated_at));
  const latestContextPackAt = latestIso(contextPacks.map((pack) => pack.created_at));
  const lastCliSyncAt = latestIso([
    profileGeneratedAt,
    documentGeneratedAt,
    latestBenchmarkAt,
    safeIso(workspace?.latest_sync_at),
  ]);
  const cacheStatus = String(profile?.cache?.status ?? workspace?.sync_status ?? "unknown").toLowerCase();
  const graph = repositoryServices?.code_graph ?? {};
  const diagrams = repositoryServices?.diagrams ?? {};
  const docs = repositoryServices?.document_memory ?? {};
  const benchmark = repositoryServices?.benchmark_roi ?? {};
  const policy = repositoryServices?.policy_rails ?? {};

  const artifactVersions = [
    artifactVersion("profile", "Repository profile", profileGeneratedAt, Boolean(profile), profile?.schema_version),
    artifactVersion("graph", "Code graph", profileGeneratedAt, graph.state === "ready", graph.view?.schema_version),
    artifactVersion("diagrams", "Diagrams", profileGeneratedAt, diagrams.state === "ready", profile?.schema_version),
    artifactVersion("documents", "Docs/spec memory", documentGeneratedAt, docs.state === "ready", documents?.schema_version),
    artifactVersion("benchmarks", "Benchmark evidence", latestBenchmarkAt, benchmark.state === "ready", benchmarkHistory?.schema_version),
    artifactVersion("context_packs", "Context packs", latestContextPackAt, contextPacks.length > 0, 1),
  ];
  const stale = isStale(lastCliSyncAt) || ["stale", "rebuild"].includes(cacheStatus);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    profile_slug: String(profile?.profile_slug ?? workspace?.profile_slug ?? ""),
    workspace_slug: String(profile?.workspace_slug ?? workspace?.workspace_slug ?? ""),
    customer_slug: String(profile?.customer_slug ?? workspace?.customer_slug ?? ""),
    repo: String(profile?.repo ?? workspace?.repo ?? ""),
    scan_status: {
      state: profile ? (stale ? "stale" : "synced") : "missing",
      cache_status: cacheStatus || "unknown",
      last_scan_at: profileGeneratedAt,
      last_cli_sync_at: lastCliSyncAt,
      local_first_note:
        "The portal reflects synced artifacts. Run the CLI locally before trusting stale graph, docs, diagram, or benchmark data.",
    },
    last_cli_sync_at: lastCliSyncAt,
    graph_health: {
      state: graph.state ?? "missing",
      node_count: Number(graph.view?.node_count ?? 0),
      edge_count: Number(graph.view?.edge_count ?? 0),
      total_node_count: Number(graph.view?.total_node_count ?? 0),
      confidence_label: graph.view?.confidence_label ?? (graph.state === "ready" ? "medium" : "low"),
      source_type: graph.source_type ?? METRIC_SOURCE_TYPES.repoArtifact,
    },
    docs_freshness: {
      state: docs.state ?? "missing",
      document_count: Number(docs.totals?.document_count ?? docs.metrics?.[0]?.value ?? 0),
      requirement_count: Number(docs.totals?.requirement_count ?? 0),
      decision_count: Number(docs.totals?.decision_count ?? 0),
      last_sync_at: documentGeneratedAt,
      stale: isStale(documentGeneratedAt),
    },
    context_pack_history: contextPacks.slice(0, 12),
    benchmark_evidence: {
      state: benchmark.state ?? "missing",
      report_count: Number(benchmark.summary?.report_count ?? 0),
      evidence_label: normalizeEvidenceLabel(benchmark.summary?.latest_measurement_mode),
      latest_generated_at: latestBenchmarkAt,
      source_type: benchmark.source_type ?? METRIC_SOURCE_TYPES.benchmarkArtifact,
    },
    policy_warnings: {
      state: policy.state ?? "missing",
      warning_count: Number(policy.summary?.warning_count ?? profile?.overview?.policy_warnings ?? 0),
      cache_status: policy.summary?.cache_status ?? cacheStatus,
      source_type: policy.source_type ?? METRIC_SOURCE_TYPES.repoArtifact,
    },
    diagrams: {
      state: diagrams.state ?? "missing",
      count: Array.isArray(diagrams.items) ? diagrams.items.length : 0,
      validation: diagrams.metrics?.find((entry) => entry.label === "Validation")?.value ?? "unknown",
      items: summarizeDiagrams(diagrams.items),
    },
    next_recommended_action: resolveNextAction({
      profile,
      stale,
      docs,
      benchmark,
      policy,
      contextPacks,
    }),
    artifacts: artifactVersions,
    timeline: artifactVersions
      .filter((artifact) => artifact.synced_at)
      .sort((left, right) => String(right.synced_at).localeCompare(String(left.synced_at)))
      .map((artifact) => ({
        event_type: "artifact_synced",
        label: artifact.label,
        status: artifact.status,
        occurred_at: artifact.synced_at,
        artifact_key: artifact.key,
      })),
  };
}

export function buildGraphSummaryContract({ repositoryView, repositoryServices } = {}) {
  const graph = repositoryServices?.code_graph ?? {};
  const view = graph.view ?? repositoryView?.code_graph?.view ?? {};

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    profile_slug: String(repositoryView?.profile?.profile_slug ?? ""),
    repo: String(repositoryView?.profile?.repo ?? ""),
    mode: String(view.mode ?? repositoryView?.code_graph?.requested_mode ?? "focused"),
    state: graph.state ?? (view.node_count ? "ready" : "missing"),
    source_type: graph.source_type ?? METRIC_SOURCE_TYPES.repoArtifact,
    node_count: Number(view.node_count ?? 0),
    edge_count: Number(view.edge_count ?? 0),
    total_node_count: Number(view.total_node_count ?? 0),
    confidence_label: view.confidence_label ?? (view.node_count ? "medium" : "low"),
    inference_mode: view.inference_mode ?? "static-artifact",
    stale: isStale(repositoryView?.profile?.generated_at),
    source_files: summarizeSourceFiles(view.nodes),
    available_modes: repositoryView?.code_graph?.available_modes ?? ["focused", "full"],
    view,
  };
}

export function buildDiagramContract({ repositoryView, repositoryServices } = {}) {
  const diagrams = repositoryServices?.diagrams?.items ?? repositoryView?.profile?.diagrams ?? [];
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    profile_slug: String(repositoryView?.profile?.profile_slug ?? ""),
    repo: String(repositoryView?.profile?.repo ?? ""),
    state: diagrams.length > 0 ? "ready" : "missing",
    source_type: METRIC_SOURCE_TYPES.repoArtifact,
    stale: isStale(repositoryView?.profile?.generated_at),
    diagrams: summarizeDiagrams(diagrams, { includeMermaid: true }),
  };
}

export async function listRepositoryContextPacks({ serviceStorageRoot, profileSlug } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const safeSlug = sanitizeToken(profileSlug, "repository");
  const repositoryRoot = path.join(paths.contextPackRepositoryFilesRoot, safeSlug);
  let entries = [];

  try {
    entries = await fs.readdir(repositoryRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const packs = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const pack = await readJsonOrDefault(path.join(repositoryRoot, entry.name), null);
    if (pack) {
      packs.push(pack);
    }
  }

  return packs.sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")));
}

export async function createRepositoryContextPack({
  serviceStorageRoot,
  profile,
  repositoryServices,
  request,
  actor,
} = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const safeSlug = sanitizeToken(profile?.profile_slug ?? request?.profile_slug, "repository");
  const repositoryRoot = path.join(paths.contextPackRepositoryFilesRoot, safeSlug);
  await fs.mkdir(repositoryRoot, { recursive: true });

  const task = sanitizeText(request?.task ?? request?.goal ?? "prepare AI context", 180);
  const tokenBudget = clampNumber(request?.token_budget ?? request?.context_budget ?? 1200, 400, 32000);
  const basePreview = repositoryServices?.context_pack_preview?.preview ?? {};
  const createdAt = new Date().toISOString();
  const packId = `ctx-${safeSlug}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const pack = {
    schema_version: 1,
    pack_id: packId,
    profile_slug: safeSlug,
    workspace_slug: String(profile?.workspace_slug ?? safeSlug),
    customer_slug: String(profile?.customer_slug ?? ""),
    repo: String(profile?.repo ?? ""),
    task,
    status: "ready",
    source_type: METRIC_SOURCE_TYPES.repoArtifact,
    created_at: createdAt,
    created_by: String(actor?.actor_slug ?? "unknown"),
    token_budget: tokenBudget,
    estimated_tokens: Math.min(
      tokenBudget,
      Number(basePreview.estimated_tokens ?? tokenBudget),
    ),
    confidence_label: basePreview.confidence_label ?? "medium",
    cli_command: `heart pack "${task.replaceAll("\"", "\\\"")}"`,
    mcp_tool: "context_pack",
    files: normalizePackItems(basePreview.files, 8),
    symbols: normalizePackItems(basePreview.symbols, 8),
    documents: normalizePackItems(basePreview.documents, 8),
    citations: normalizePackItems(basePreview.citations, 10),
    risks: Array.isArray(basePreview.risks) ? basePreview.risks.slice(0, 8) : [],
    next_actions: [
      "Review citations before using this pack for implementation.",
      "Run heart pack locally if source code changed after the latest sync.",
      "Use the MCP context_pack tool for agent handoff when available.",
    ],
  };

  await fs.writeFile(path.join(repositoryRoot, `${packId}.json`), `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  return pack;
}

export function buildContextPackIndexContract({
  profile,
  repositoryServices,
  packs = [],
} = {}) {
  const preview = repositoryServices?.context_pack_preview?.preview ?? null;
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    profile_slug: String(profile?.profile_slug ?? ""),
    repo: String(profile?.repo ?? ""),
    packs,
    suggested_preview: preview
      ? {
          task: preview.task,
          token_budget: preview.token_budget,
          estimated_tokens: preview.estimated_tokens,
          confidence_label: preview.confidence_label,
          citations: normalizePackItems(preview.citations, 8),
          risks: normalizePackItems(preview.risks, 8),
          cli_command: repositoryServices?.context_pack_preview?.cli_command ?? "",
          mcp_tool: repositoryServices?.context_pack_preview?.mcp_tool ?? "context_pack",
        }
      : null,
    empty_state:
      packs.length === 0
        ? "No hosted context packs have been generated yet. Use the portal create action or run heart pack locally."
        : "",
  };
}

export async function writeChatCommandRecord({ serviceStorageRoot, command } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.mkdir(paths.chatCommandsRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.chatCommandsRoot, `${sanitizeToken(command.command_id, "command")}.json`),
    `${JSON.stringify(command, null, 2)}\n`,
    "utf8",
  );
  return command;
}

export async function loadChatCommandRecord({ serviceStorageRoot, commandId } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  return readJsonOrDefault(
    path.join(paths.chatCommandsRoot, `${sanitizeToken(commandId, "command")}.json`),
    null,
  );
}

export function buildChatCommandRecord({ request, actor, workspaces = [] } = {}) {
  const input = sanitizeText(request?.input ?? request?.command ?? "", 2000);
  const intent = classifyChatCommand(input);
  const workspaceSlug = sanitizeToken(
    request?.workspace_slug ??
      request?.workspace_id ??
      workspaces[0]?.workspace_slug ??
      "workspace",
    "workspace",
  );
  const repoSlug = sanitizeToken(request?.repo_id ?? request?.profile_slug ?? request?.repo_slug ?? "", "");
  const safety = classifyIntentSafety(intent, input);
  const now = new Date().toISOString();
  const commandId = `cmd-${workspaceSlug}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

  return {
    schema_version: 1,
    command_id: commandId,
    workspace_slug: workspaceSlug,
    repo_slug: repoSlug,
    actor_slug: String(actor?.actor_slug ?? ""),
    input,
    intent,
    mode: normalizeMode(request?.mode),
    model_preset_id: sanitizeText(request?.model_preset_id ?? request?.preset ?? "planning", 80),
    context_budget: normalizeContextBudget(request?.context_budget),
    safety,
    status: safety.denied
      ? "denied"
      : safety.requires_confirmation
        ? "needs_confirmation"
        : "completed",
    created_at: now,
    updated_at: now,
    result_cards: buildCommandResultCards({ intent, safety, repoSlug, input }),
    citations: buildCommandCitations({ intent, repoSlug }),
    next_actions: buildCommandNextActions({ intent, safety, repoSlug }),
    pack_context: buildPackCommandContext({ request, intent }),
  };
}

export async function loadModelSettings({ serviceStorageRoot } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const settingsPath = path.join(paths.root, "model-settings", "settings.json");
  const persisted = await readJsonOrDefault(settingsPath, {});
  const credentialState = await loadProviderCredentialState({ serviceStorageRoot });
  const providers = await Promise.all(listProviders({
    credentialState,
    env: process.env,
  }).map(async (provider) => {
    const modelList = await listProviderModels({
      providerId: provider.provider_id,
      credential: credentialState[provider.provider_id],
      dynamic: false,
      env: process.env,
    });
    const persistedProvider = persisted.providers?.[provider.provider_id] ?? {};
    return {
      ...provider,
      configured: Boolean(provider.configured || persistedProvider.enabled),
      disabled_reason: provider.configured || persistedProvider.enabled ? "" : provider.disabled_reason,
      key_status: provider.configured || persistedProvider.enabled ? "configured_masked" : "missing",
      models: modelList.models.map((entry) => entry.model_id).slice(0, 40),
      model_metadata: modelList.models.slice(0, 40),
      cost_visibility: normalizeCostVisibility(persistedProvider.costs ?? {}),
      local: false,
    };
  }));
  const presets = PURPOSE_PRESETS.map((preset) => {
    const persistedPreset = persisted.presets?.[preset.preset_id] ?? {};
    const providerId = normalizeProviderId(persistedPreset.provider_id ?? "openai");
    const provider = providers.find((entry) => entry.provider_id === providerId) ?? providers[0];
    return {
      ...preset,
      provider_id: provider.provider_id,
      model: sanitizeText(persistedPreset.model ?? provider.default_model ?? "provider-default", 120),
      token_budget: clampNumber(
        persistedPreset.token_budget ?? preset.default_context_budget,
        500,
        128000,
      ),
      disabled: !provider.configured,
      disabled_reason: provider.configured ? "" : provider.disabled_reason,
      cost_visibility: provider.cost_visibility,
    };
  });

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    providers,
    presets,
    security: {
      secrets_exposed: false,
      secret_storage_note:
        "Provider secrets are resolved server-side from environment or encrypted portal storage. Client responses only expose masked presence.",
      encrypted_storage_available: Boolean(resolvePortalSecretKey(process.env)),
      encrypted_storage_note: resolvePortalSecretKey(process.env)
        ? "Portal BYOK keys can be stored encrypted with AES-256-GCM."
        : "Set BE_AI_HEART_PORTAL_SECRET_KEY before storing portal BYOK keys. Environment variable keys still work.",
    },
  };
}

export async function updateModelSettings({ serviceStorageRoot, payload } = {}) {
  assertNoRawSecrets(payload);
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const settingsRoot = path.join(paths.root, "model-settings");
  await fs.mkdir(settingsRoot, { recursive: true });
  const current = await readJsonOrDefault(path.join(settingsRoot, "settings.json"), {});
  const next = {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    providers: sanitizeProviderSettings({
      ...(current.providers ?? {}),
      ...(payload?.providers ?? {}),
    }),
    presets: sanitizePresetSettings({
      ...(current.presets ?? {}),
      ...(payload?.presets ?? {}),
    }),
  };
  await fs.writeFile(path.join(settingsRoot, "settings.json"), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return loadModelSettings({ serviceStorageRoot });
}

export function containsRawModelSecret(payload = {}) {
  const serialized = JSON.stringify(payload ?? {});
  return /"(?:api[_-]?key|secret|token|password)"\s*:/i.test(serialized);
}

export async function addProviderKey({ serviceStorageRoot, payload, actor, env = process.env } = {}) {
  const provider = getProviderDefinition(payload?.provider_id ?? payload?.provider);
  const apiKey = normalizeApiKey(payload?.api_key ?? payload?.apiKey);
  if (!apiKey) {
    throw createPortalContractError(400, "Provider API key is required.");
  }
  const secretKey = resolvePortalSecretKey(env);
  if (!secretKey) {
    throw createPortalContractError(
      400,
      "Portal encrypted key storage is not configured. Set BE_AI_HEART_PORTAL_SECRET_KEY or use server-side environment variables.",
    );
  }
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const store = await loadProviderCredentialStore({ serviceStorageRoot });
  const encrypted = encryptProviderSecret(apiKey, secretKey);
  const savedAt = new Date().toISOString();
  const record = {
    schema_version: 1,
    provider_id: provider.provider_id,
    enabled: payload?.enabled !== false,
    source: "encrypted_portal_storage",
    masked_key: maskSecret(apiKey),
    key_fingerprint: createHash("sha256").update(apiKey).digest("hex").slice(0, 16),
    encrypted_secret: encrypted,
    saved_at: savedAt,
    saved_by: String(actor?.actor_slug ?? ""),
  };
  const next = {
    schema_version: 1,
    updated_at: savedAt,
    providers: {
      ...(store.providers ?? {}),
      [provider.provider_id]: record,
    },
  };
  await fs.mkdir(paths.modelProviderCredentialsRoot, { recursive: true });
  await fs.writeFile(paths.modelProviderCredentialsPath, `${JSON.stringify(next, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(paths.modelProviderCredentialsPath, 0o600).catch(() => {});
  return {
    schema_version: 1,
    provider_id: provider.provider_id,
    key_status: "configured_masked",
    masked_key: record.masked_key,
    saved_at: savedAt,
  };
}

export async function deleteProviderKey({ serviceStorageRoot, providerId } = {}) {
  const provider = getProviderDefinition(providerId);
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const store = await loadProviderCredentialStore({ serviceStorageRoot });
  const providers = { ...(store.providers ?? {}) };
  delete providers[provider.provider_id];
  await fs.mkdir(paths.modelProviderCredentialsRoot, { recursive: true });
  await fs.writeFile(
    paths.modelProviderCredentialsPath,
    `${JSON.stringify({ schema_version: 1, updated_at: new Date().toISOString(), providers }, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );
  await fs.chmod(paths.modelProviderCredentialsPath, 0o600).catch(() => {});
  return {
    schema_version: 1,
    provider_id: provider.provider_id,
    key_status: "removed",
  };
}

export async function testProviderKey({ serviceStorageRoot, providerId, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const provider = getProviderDefinition(providerId);
  const credential = await loadDecryptedProviderCredential({ serviceStorageRoot, providerId: provider.provider_id, env });
  return validateProviderCredential({
    providerId: provider.provider_id,
    credential,
    env,
    fetchImpl,
  });
}

export async function refreshProviderModels({ serviceStorageRoot, providerId, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const provider = getProviderDefinition(providerId);
  const credential = await loadDecryptedProviderCredential({ serviceStorageRoot, providerId: provider.provider_id, env });
  return listProviderModels({
    providerId: provider.provider_id,
    credential,
    env,
    fetchImpl,
    dynamic: Boolean(resolveProviderCredential({ providerId: provider.provider_id, credential, env }).api_key),
  });
}

export async function listChatSessions({ serviceStorageRoot, workspaceSlug } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const entries = await safeReaddir(paths.chatSessionsRoot);
  const sessions = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const session = await readJsonOrDefault(path.join(paths.chatSessionsRoot, entry.name), null);
    if (!session) {
      continue;
    }
    if (workspaceSlug && session.workspace_slug !== workspaceSlug) {
      continue;
    }
    sessions.push(summarizeChatSession(session));
  }
  sessions.sort((left, right) => String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? "")));
  return {
    schema_version: 1,
    sessions,
  };
}

export async function createChatSessionRecord({ serviceStorageRoot, request, actor, workspaces = [] } = {}) {
  const settings = await loadModelSettings({ serviceStorageRoot });
  const preset = settings.presets.find((entry) => entry.preset_id === request?.preset_id || entry.preset_id === request?.mode)
    ?? settings.presets[0];
  const workspaceSlug = sanitizeToken(
    request?.workspace_slug ?? request?.workspace_id ?? workspaces[0]?.workspace_slug ?? "workspace",
    "workspace",
  );
  const repoSlug = sanitizeToken(request?.repo_slug ?? request?.repo_id ?? request?.profile_slug ?? "", "");
  const providerId = normalizeProviderId(request?.provider_id ?? preset?.provider_id ?? "openai");
  const modelId = sanitizeText(request?.model_id ?? preset?.model ?? getProviderDefinition(providerId).fallback_models?.[0]?.model_id, 160);
  const session = createRuntimeChatSession({
    workspaceSlug,
    repoSlug,
    providerId,
    modelId,
    mode: normalizeMode(request?.mode ?? preset?.preset_id),
    actorSlug: actor?.actor_slug ?? "",
  });
  session.title = sanitizeText(request?.title ?? "BeHeart AI chat", 120);
  await writeChatSessionRecord({ serviceStorageRoot, session });
  return session;
}

export async function loadChatSession({ serviceStorageRoot, sessionId } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  return readJsonOrDefault(
    path.join(paths.chatSessionsRoot, `${sanitizeToken(sessionId, "session")}.json`),
    null,
  );
}

export async function deleteChatSession({ serviceStorageRoot, sessionId } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.rm(path.join(paths.chatSessionsRoot, `${sanitizeToken(sessionId, "session")}.json`), { force: true });
  return {
    schema_version: 1,
    session_id: sanitizeToken(sessionId, "session"),
    status: "deleted",
  };
}

export async function sendPortalChatMessage({
  serviceStorageRoot,
  sessionId,
  request,
  actor,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const session = await loadChatSession({ serviceStorageRoot, sessionId });
  if (!session) {
    throw createPortalContractError(404, "Chat session not found.");
  }
  const providerId = normalizeProviderId(request?.provider_id ?? session.provider_id);
  const modelId = sanitizeText(request?.model_id ?? session.model_id, 160);
  const credential = await loadDecryptedProviderCredential({ serviceStorageRoot, providerId, env });
  const resolvedCredential = resolveProviderCredential({ providerId, credential, env });
  if (!resolvedCredential.api_key) {
    throw createPortalContractError(400, `No provider key configured for ${providerId}.`);
  }
  const message = sanitizeText(request?.message ?? request?.input ?? "", 8000);
  if (!message) {
    throw createPortalContractError(400, "Chat message is required.");
  }
  const contextAttachments = await buildPortalContextAttachments({
    request,
    session,
    serviceStorageRoot,
  });
  const result = await runChatRuntimeMessage({
    session: {
      ...session,
      provider_id: providerId,
      model_id: modelId,
    },
    message,
    providerId,
    modelId,
    credential: resolvedCredential,
    contextAttachments,
    fetchImpl,
    env,
    maxOutputTokens: clampNumber(request?.max_output_tokens ?? 2000, 250, 8192),
  });
  const nextSession = {
    ...result.session,
    actor_slug: String(actor?.actor_slug ?? session.actor_slug ?? ""),
    safety_warnings: [
      {
        warning_id: "provider-data-exposure",
        level: "notice",
        message: "Selected context and chat messages are sent to the configured model provider.",
      },
    ],
  };
  await writeChatSessionRecord({ serviceStorageRoot, session: nextSession });
  return {
    schema_version: 1,
    session: nextSession,
    user_message: result.user_message,
    assistant_message: result.assistant_message,
    context_attachments: contextAttachments,
    usage: result.response.usage,
    cost: result.response.cost,
  };
}

export async function* streamPortalChatMessage({
  serviceStorageRoot,
  sessionId,
  request,
  actor,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const session = await loadChatSession({ serviceStorageRoot, sessionId });
  if (!session) {
    throw createPortalContractError(404, "Chat session not found.");
  }
  const providerId = normalizeProviderId(request?.provider_id ?? session.provider_id);
  const modelId = sanitizeText(request?.model_id ?? session.model_id, 160);
  const credential = await loadDecryptedProviderCredential({ serviceStorageRoot, providerId, env });
  const resolvedCredential = resolveProviderCredential({ providerId, credential, env });
  if (!resolvedCredential.api_key) {
    throw createPortalContractError(400, `No provider key configured for ${providerId}.`);
  }
  const message = sanitizeText(request?.message ?? request?.input ?? "", 8000);
  if (!message) {
    throw createPortalContractError(400, "Chat message is required.");
  }
  const contextAttachments = await buildPortalContextAttachments({
    request,
    session,
    serviceStorageRoot,
  });

  for await (const event of runStreamingChatRuntimeMessage({
    session: {
      ...session,
      provider_id: providerId,
      model_id: modelId,
    },
    message,
    providerId,
    modelId,
    credential: resolvedCredential,
    contextAttachments,
    fetchImpl,
    env,
    maxOutputTokens: clampNumber(request?.max_output_tokens ?? 2000, 250, 8192),
  })) {
    if (event.event === "run_completed" && event.session) {
      const nextSession = {
        ...event.session,
        actor_slug: String(actor?.actor_slug ?? session.actor_slug ?? ""),
        safety_warnings: [
          {
            warning_id: "provider-data-exposure",
            level: "notice",
            message: "Selected context and chat messages are sent to the configured model provider.",
          },
        ],
      };
      await writeChatSessionRecord({ serviceStorageRoot, session: nextSession });
      yield {
        schema_version: 1,
        ...event,
        session: nextSession,
      };
      continue;
    }
    yield {
      schema_version: 1,
      ...event,
    };
  }
}

export function listChatAllowedTools() {
  return {
    schema_version: 1,
    tools: listAllowedTools(),
  };
}

export async function executePortalAgentTool({
  serviceStorageRoot,
  monorepoRoot = process.cwd(),
  actor,
  toolId,
  input,
  confirmed,
} = {}) {
  return executeAgentTool({
    toolId,
    input,
    confirmed,
    executors: createPortalToolExecutors({
      serviceStorageRoot,
      monorepoRoot,
      actor,
    }),
  });
}

function createPortalToolExecutors({ serviceStorageRoot, monorepoRoot, actor } = {}) {
  return {
    scan_repo: async (input, context) => portalToolResult({
      definition: context.definition,
      status: "prepared",
      message: "Repo scan is approved. Run it through the CLI or a configured worker so portal chat never executes arbitrary shell commands.",
      artifactCards: [artifactCard("cli_action", "Approved repo scan", `heart scan ${input?.repo_slug ? `--repo ${sanitizeToken(input.repo_slug, "repo")}` : ""}`.trim(), "prepared")],
      nextActions: ["Run heart scan locally", "Sync the updated profile to the portal", "Re-open chat with refreshed repo memory"],
    }),
    create_context_pack: async (input, context) => {
      const paths = getServiceStoragePaths({ serviceStorageRoot });
      const profile = await loadPortalProfileArtifact(paths, input);
      return portalToolResult({
        definition: context.definition,
        status: "prepared",
        message: "Context pack request is approved and grounded in the current synced profile.",
        artifactCards: [
          artifactCard(
            "context_pack",
            sanitizeText(input?.title ?? input?.task ?? "Chat context pack", 80),
            profile?.overview?.summary ?? "No synced profile summary is available yet.",
            "prepared",
          ),
        ],
        citations: profile ? [citation("repo_profile", profile.profile_slug, `${profile.profile_slug}.json`)] : [],
        nextActions: ["Run heart pack from the CLI with the approved task", "Attach the generated pack to this chat"],
      });
    },
    search_docs: async (input, context) => {
      const paths = getServiceStoragePaths({ serviceStorageRoot });
      const docsArtifact = await loadPortalDocumentArtifact(paths, input);
      const query = sanitizeText(input?.query ?? input?.q ?? input?.message ?? "", 120).toLowerCase();
      const documents = flattenPortalDocuments(docsArtifact);
      const matches = documents
        .map((document) => ({
          document,
          score: scoreDocumentMatch(document, query),
        }))
        .filter((entry) => entry.score > 0 || !query)
        .sort((left, right) => right.score - left.score)
        .slice(0, 8);
      return portalToolResult({
        definition: context.definition,
        status: "completed",
        message: matches.length
          ? `Found ${matches.length} synced document match(es).`
          : "No synced docs matched the query.",
        artifactCards: matches.map((entry) => artifactCard(
          "doc_match",
          entry.document.title ?? entry.document.path ?? "Document",
          entry.document.summary ?? entry.document.content_preview ?? "",
          "ready",
        )),
        citations: matches.map((entry) => citation("doc", entry.document.title ?? entry.document.path, entry.document.path)),
      });
    },
    query_graph: async (input, context) => {
      const paths = getServiceStoragePaths({ serviceStorageRoot });
      const profile = await loadPortalProfileArtifact(paths, input);
      return portalToolResult({
        definition: context.definition,
        status: profile ? "completed" : "missing_context",
        message: profile?.overview?.summary ?? "No synced repo graph profile is available.",
        artifactCards: profile ? [artifactCard("repo_graph", "Repo graph summary", summarizePortalGraph(profile), "ready")] : [],
        citations: profile ? [citation("repo_profile", profile.profile_slug, `${profile.profile_slug}.json`)] : [],
        data: profile ? {
          file_count: profile.overview?.file_count ?? 0,
          symbol_count: profile.overview?.symbol_count ?? 0,
          relationship_count: profile.overview?.relationship_count ?? 0,
          domain_count: profile.overview?.domain_count ?? 0,
        } : {},
      });
    },
    show_diagrams: async (input, context) => {
      const paths = getServiceStoragePaths({ serviceStorageRoot });
      const profile = await loadPortalProfileArtifact(paths, input);
      const diagrams = (profile?.diagrams ?? []).slice(0, 6);
      return portalToolResult({
        definition: context.definition,
        status: diagrams.length ? "completed" : "missing_context",
        message: diagrams.length ? `Returned ${diagrams.length} synced diagram(s).` : "No synced diagrams are available.",
        artifactCards: diagrams.map((diagram) => ({
          ...artifactCard("diagram", diagram.title ?? diagram.type ?? "Diagram", diagram.summary ?? "", "ready"),
          format: diagram.format ?? "",
          content_preview: String(diagram.content ?? "").slice(0, 1200),
        })),
        citations: profile ? [citation("repo_profile", profile.profile_slug, `${profile.profile_slug}.json`)] : [],
      });
    },
    validate_policy: async (input, context) => {
      const paths = getServiceStoragePaths({ serviceStorageRoot });
      const profile = await loadPortalProfileArtifact(paths, input);
      const warnings = Number(profile?.overview?.policy_warnings ?? 0);
      return portalToolResult({
        definition: context.definition,
        status: warnings > 0 ? "warning" : "completed",
        message: profile ? `Policy validation found ${warnings} warning(s) in synced repo memory.` : "No synced profile is available for policy validation.",
        artifactCards: [artifactCard("policy", "Policy validation", warnings > 0 ? `${warnings} warning(s) require review.` : "No policy warnings in the latest synced profile.", warnings > 0 ? "warning" : "ready")],
        citations: profile ? [citation("repo_profile", profile.profile_slug, `${profile.profile_slug}.json`)] : [],
      });
    },
    list_domain_packs: async (input, context) => {
      const packs = await listDomainPacks({ repoRoot: monorepoRoot });
      return portalToolResult({
        definition: context.definition,
        status: "completed",
        message: `Found ${packs.length} domain pack(s).`,
        artifactCards: packs.map((pack) => artifactCard("domain_pack", pack.name ?? pack.pack_id, pack.description ?? "", "ready")),
        data: { packs },
      });
    },
    build_domain_pack_artifact: async (input, context) => buildPackPortalArtifact(input, context.definition, {
      monorepoRoot,
      outputType: input?.output_type ?? "domain-pack",
    }),
    generate_sales_demo_kit: async (input, context) => buildPackPortalArtifact(input, context.definition, {
      monorepoRoot,
      outputType: "sales-demo-kit",
    }),
    run_benchmark_scenario: async (input, context) => portalToolResult({
      definition: context.definition,
      status: "prepared",
      message: "Benchmark run is approved. Portal chat records the request; execution should happen through the benchmark runner.",
      artifactCards: [artifactCard("benchmark", sanitizeText(input?.scenario_id ?? "benchmark scenario", 80), "Approved benchmark launch request.", "prepared")],
      nextActions: [`heart benchmark run ${sanitizeText(input?.scenario_id ?? "", 80)}`.trim(), "Attach the benchmark evidence bundle to chat"],
    }),
    summarize_repo: async (input, context) => {
      const paths = getServiceStoragePaths({ serviceStorageRoot });
      const profile = await loadPortalProfileArtifact(paths, input);
      return portalToolResult({
        definition: context.definition,
        status: profile ? "completed" : "missing_context",
        message: profile?.overview?.summary ?? "No synced repository profile is available.",
        artifactCards: profile ? [artifactCard("repo_summary", profile.repo ?? profile.profile_slug, profile.overview?.summary ?? "", "ready")] : [],
        citations: profile ? [citation("repo_profile", profile.profile_slug, `${profile.profile_slug}.json`)] : [],
      });
    },
    create_implementation_plan: async (input, context) => {
      const paths = getServiceStoragePaths({ serviceStorageRoot });
      const profile = await loadPortalProfileArtifact(paths, input);
      const docsArtifact = await loadPortalDocumentArtifact(paths, input);
      const matches = flattenPortalDocuments(docsArtifact).slice(0, 5);
      return portalToolResult({
        definition: context.definition,
        status: "completed",
        message: "Created a source-backed implementation plan starter.",
        artifactCards: [artifactCard(
          "implementation_plan",
          sanitizeText(input?.title ?? input?.task ?? "Implementation plan", 90),
          createPlanSummary({ input, profile, documents: matches }),
          "ready",
        )],
        citations: [
          ...(profile ? [citation("repo_profile", profile.profile_slug, `${profile.profile_slug}.json`)] : []),
          ...matches.map((document) => citation("doc", document.title ?? document.path, document.path)),
        ],
      });
    },
    propose_file_edit: async (input, context) => buildScopedFileEditProposal(input, context.definition, {
      monorepoRoot,
      write: false,
    }),
    apply_scoped_file_edit: async (input, context) => buildScopedFileEditProposal(input, context.definition, {
      monorepoRoot,
      write: true,
    }),
  };
}

async function buildScopedFileEditProposal(input, definition, { monorepoRoot, write = false } = {}) {
  const target = resolveScopedEditTarget(monorepoRoot, input);
  const operation = sanitizeToken(input?.operation ?? "create", "create");
  const content = String(input?.content ?? input?.markdown ?? "");
  const title = sanitizeText(input?.title ?? input?.target_path ?? input?.path ?? "Scoped BeHeart artifact", 120);

  if (!target.allowed) {
    return portalToolResult({
      definition,
      status: "denied",
      message: target.reason,
      artifactCards: [artifactCard("file_edit", title, target.reason, "denied")],
      data: {
        target_path: target.relative_path,
        allowed_prefixes: SCOPED_EDIT_ALLOWED_PREFIXES,
      },
    });
  }

  if (!content.trim()) {
    return portalToolResult({
      definition,
      status: "denied",
      message: "Scoped file edit requires non-empty artifact content.",
      artifactCards: [artifactCard("file_edit", title, "No content was provided for the artifact write.", "denied")],
      data: {
        target_path: target.relative_path,
      },
    });
  }

  if (content.length > 64_000) {
    return portalToolResult({
      definition,
      status: "denied",
      message: "Scoped file edit content exceeds the 64 KB portal-chat limit.",
      artifactCards: [artifactCard("file_edit", title, "Reduce the generated artifact size or write through the CLI.", "denied")],
      data: {
        target_path: target.relative_path,
        content_length: content.length,
      },
    });
  }

  const existing = await fileExists(target.absolute_path);
  if (write) {
    if (!["create", "replace"].includes(operation)) {
      return portalToolResult({
        definition,
        status: "denied",
        message: "Scoped file edits support only create or replace operations.",
        artifactCards: [artifactCard("file_edit", title, `Unsupported operation: ${operation}`, "denied")],
        data: {
          target_path: target.relative_path,
          operation,
        },
      });
    }
    if (existing && (operation !== "replace" || input?.allow_overwrite !== true)) {
      return portalToolResult({
        definition,
        status: "needs_confirmation",
        message: "The target artifact already exists. Re-run with operation=replace and allow_overwrite=true after review.",
        artifactCards: [artifactCard("file_edit", title, target.relative_path, "needs_confirmation")],
        data: {
          target_path: target.relative_path,
          existing: true,
        },
      });
    }
    await fs.mkdir(path.dirname(target.absolute_path), { recursive: true });
    await fs.writeFile(target.absolute_path, ensureTrailingNewline(content), "utf8");
  }

  return portalToolResult({
    definition,
    status: write ? "generated" : "prepared",
    message: write
      ? `Wrote confirmed BeHeart artifact ${target.relative_path}.`
      : `Prepared scoped BeHeart artifact write for ${target.relative_path}.`,
    artifactCards: [artifactCard(
      "file_edit",
      title,
      write
        ? `${target.relative_path} written as a confirmed generated artifact.`
        : `${target.relative_path} is allowed. Confirmation is required before writing.`,
      write ? "generated" : "prepared",
    )],
    nextActions: write ? ["Review generated artifact diff", "Attach artifact to chat if needed"] : ["Review proposed content", "Confirm apply_scoped_file_edit if the target and content are correct"],
    data: {
      target_path: target.relative_path,
      operation,
      existing,
      content_length: content.length,
      wrote_file: write,
    },
  });
}

const SCOPED_EDIT_ALLOWED_PREFIXES = Object.freeze([
  "docs/generated/",
  "docs/specs/generated/",
  "docs/templates/generated/",
  ".heart/packs/generated/",
]);

function resolveScopedEditTarget(monorepoRoot, input = {}) {
  const root = path.resolve(monorepoRoot ?? process.cwd());
  const relativePath = sanitizeArtifactPath(input.target_path ?? input.path ?? input.file_path ?? "");
  if (!relativePath) {
    return {
      allowed: false,
      reason: "Scoped file edit requires a relative target_path.",
      relative_path: "",
      absolute_path: root,
    };
  }
  if (relativePath.split("/").includes("..")) {
    return {
      allowed: false,
      reason: "Scoped file edit target cannot traverse outside the workspace.",
      relative_path: relativePath,
      absolute_path: root,
    };
  }
  const lowered = relativePath.toLowerCase();
  if (/(^|\/)(\.env|credentials?|secrets?|id_rsa|id_dsa|id_ed25519)(\.|\/|$)|\.(?:pem|key|p12|pfx)$/i.test(lowered)) {
    return {
      allowed: false,
      reason: "Scoped file edit target cannot write secret-bearing files.",
      relative_path: relativePath,
      absolute_path: path.join(root, relativePath),
    };
  }
  if (!SCOPED_EDIT_ALLOWED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
    return {
      allowed: false,
      reason: "Portal chat may write only confirmed BeHeart generated docs/spec/template outputs or generated pack artifacts.",
      relative_path: relativePath,
      absolute_path: path.join(root, relativePath),
    };
  }
  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    return {
      allowed: false,
      reason: "Scoped file edit target resolved outside the workspace.",
      relative_path: relativePath,
      absolute_path: absolutePath,
    };
  }
  return {
    allowed: true,
    reason: "",
    relative_path: relativePath,
    absolute_path: absolutePath,
  };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function ensureTrailingNewline(value) {
  const text = String(value ?? "");
  return text.endsWith("\n") ? text : `${text}\n`;
}

async function buildPackPortalArtifact(input, definition, { monorepoRoot, outputType }) {
  const packId = sanitizeToken(input?.pack_id ?? input?.domain_pack_id ?? "tolling-management", "tolling-management");
  const pack = await getDomainPack(packId, { repoRoot: monorepoRoot });
  const result = await writePackArtifact({
    repoRoot: monorepoRoot,
    packId,
    outputType,
    regionalLayer: sanitizeText(input?.regional_layer, 80),
    agencyOverlay: sanitizeText(input?.agency_overlay, 80),
    customerRequirements: sanitizeText(input?.customer_requirements ?? input?.requirements ?? "", 1200),
    customerOverlay: sanitizeText(input?.customer_overlay, 1200),
    tokenBudget: input?.token_budget,
  });
  return portalToolResult({
    definition,
    status: "generated",
    message: `${pack.name ?? pack.pack_id} generated ${outputType}.`,
    artifactCards: [artifactCard(
      outputType,
      result.manifest?.title ?? `${packId} ${outputType}`,
      `${result.generated_files.length} file(s) written under ${relativePortalPath(monorepoRoot, result.output_dir)}.`,
      "generated",
    )],
    citations: (pack.source_notes ?? []).slice(0, 5).map((note) => citation("domain_pack", note.title ?? packId, note.path ?? packId)),
    nextActions: result.next_actions ?? [],
    data: {
      artifact_id: result.artifact_id,
      output_dir: relativePortalPath(monorepoRoot, result.output_dir),
      manifest_path: relativePortalPath(monorepoRoot, result.manifest_path),
      generated_files: result.generated_files.map((filePath) => relativePortalPath(monorepoRoot, filePath)),
    },
  });
}

function portalToolResult({
  definition,
  status = "completed",
  message = "",
  artifactCards = [],
  citations = [],
  nextActions = [],
  data = {},
} = {}) {
  return {
    schema_version: 1,
    tool_id: definition?.tool_id ?? "",
    status,
    safety_level: definition?.safety_level ?? "read_only",
    message,
    definition,
    artifact_cards: artifactCards,
    citations,
    next_actions: nextActions,
    data: redactProviderSecrets(data),
    executed_at: new Date().toISOString(),
  };
}

async function loadPortalProfileArtifact(paths, input = {}) {
  const preferred = sanitizeToken(input.profile_slug ?? input.repo_slug ?? input.repository_slug, "");
  return readFirstMatchingJson(paths.profileRepositoryFilesRoot, preferred);
}

async function loadPortalDocumentArtifact(paths, input = {}) {
  const preferred = sanitizeToken(input.profile_slug ?? input.repo_slug ?? input.repository_slug, "");
  return readFirstMatchingJson(paths.documentRepositoryFilesRoot, preferred);
}

async function readFirstMatchingJson(root, preferredName) {
  if (preferredName) {
    const direct = await readJsonOrDefault(path.join(root, `${preferredName}.json`), null);
    if (direct) {
      return direct;
    }
  }
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const payload = await readJsonOrDefault(path.join(root, entry.name), null);
        if (payload) {
          return payload;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

function flattenPortalDocuments(artifact) {
  return (artifact?.documents ?? [])
    .map((document) => ({
      title: sanitizeText(document.title ?? document.path ?? "Document", 120),
      path: sanitizeArtifactPath(document.path ?? ""),
      category: sanitizeText(document.category ?? "", 80),
      summary: sanitizeText(document.summary ?? document.content_preview ?? "", 500),
      content_preview: sanitizeText(document.content_preview ?? "", 900),
      headings: Array.isArray(document.headings) ? document.headings.slice(0, 8) : [],
    }));
}

function scoreDocumentMatch(document, query) {
  if (!query) {
    return 1;
  }
  const haystack = [
    document.title,
    document.path,
    document.category,
    document.summary,
    document.content_preview,
    ...(document.headings ?? []),
  ].join(" ").toLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function summarizePortalGraph(profile) {
  const overview = profile.overview ?? {};
  return [
    overview.summary,
    `Files: ${overview.file_count ?? 0}`,
    `Symbols: ${overview.symbol_count ?? 0}`,
    `Relationships: ${overview.relationship_count ?? 0}`,
    `Domains: ${overview.domain_count ?? 0}`,
  ].filter(Boolean).join(" / ");
}

function createPlanSummary({ input, profile, documents }) {
  const task = sanitizeText(input?.task ?? input?.message ?? input?.title ?? "requested change", 160);
  const repoSummary = profile?.overview?.summary ?? "No synced repo summary was available.";
  const docRefs = documents.map((document) => document.title ?? document.path).filter(Boolean).join(", ");
  return [
    `Goal: ${task}.`,
    `Repo basis: ${repoSummary}`,
    docRefs ? `Docs to verify first: ${docRefs}.` : "Docs to verify first: run docs sync or attach docs context.",
    "Next steps: confirm scope, inspect graph hotspots, draft acceptance criteria, then implement with targeted tests.",
  ].join(" ");
}

function artifactCard(cardType, title, summary, status) {
  return {
    schema_version: 1,
    card_type: cardType,
    title: sanitizeText(title, 140),
    summary: sanitizeText(summary, 900),
    status,
  };
}

function citation(type, label, ref) {
  return {
    schema_version: 1,
    type,
    label: sanitizeText(label, 140),
    ref: sanitizeArtifactPath(ref) || sanitizeText(ref, 180),
  };
}

function relativePortalPath(root, filePath) {
  const relative = path.relative(path.resolve(root), path.resolve(filePath));
  return sanitizeArtifactPath(relative) || sanitizeArtifactPath(filePath);
}

async function loadProviderCredentialState({ serviceStorageRoot } = {}) {
  const store = await loadProviderCredentialStore({ serviceStorageRoot });
  return Object.fromEntries(
    Object.entries(store.providers ?? {}).map(([providerId, record]) => [
      providerId,
      {
        provider_id: normalizeProviderId(record.provider_id ?? providerId),
        configured: true,
        enabled: record.enabled !== false,
        masked_key: String(record.masked_key ?? ""),
        source: record.source ?? "encrypted_portal_storage",
      },
    ]),
  );
}

async function loadProviderCredentialStore({ serviceStorageRoot } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  return readJsonOrDefault(paths.modelProviderCredentialsPath, {
    schema_version: 1,
    providers: {},
  });
}

async function loadDecryptedProviderCredential({ serviceStorageRoot, providerId, env = process.env } = {}) {
  const provider = getProviderDefinition(providerId);
  const envCredential = resolveProviderCredential({ providerId: provider.provider_id, env });
  if (envCredential.api_key) {
    return envCredential;
  }
  const store = await loadProviderCredentialStore({ serviceStorageRoot });
  const record = store.providers?.[provider.provider_id];
  if (!record?.encrypted_secret) {
    return {
      provider_id: provider.provider_id,
      source: "missing",
      api_key: "",
      masked_key: "",
      enabled: false,
    };
  }
  const secretKey = resolvePortalSecretKey(env);
  if (!secretKey) {
    return {
      provider_id: provider.provider_id,
      source: "encrypted_portal_storage_unavailable",
      api_key: "",
      masked_key: record.masked_key ?? "",
      enabled: false,
    };
  }
  const apiKey = decryptProviderSecret(record.encrypted_secret, secretKey);
  return {
    provider_id: provider.provider_id,
    source: "encrypted_portal_storage",
    api_key: apiKey,
    masked_key: record.masked_key ?? maskSecret(apiKey),
    enabled: record.enabled !== false,
  };
}

async function writeChatSessionRecord({ serviceStorageRoot, session } = {}) {
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  await fs.mkdir(paths.chatSessionsRoot, { recursive: true });
  await fs.writeFile(
    path.join(paths.chatSessionsRoot, `${sanitizeToken(session.session_id, "session")}.json`),
    `${JSON.stringify(session, null, 2)}\n`,
    "utf8",
  );
  return session;
}

function summarizeChatSession(session) {
  return {
    schema_version: 1,
    session_id: session.session_id,
    title: session.title ?? "BeHeart AI chat",
    workspace_slug: session.workspace_slug,
    repo_slug: session.repo_slug,
    provider_id: session.provider_id,
    model_id: session.model_id,
    mode: session.mode,
    status: session.status,
    message_count: session.messages?.length ?? 0,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

async function buildPortalContextAttachments({ request, session, serviceStorageRoot } = {}) {
  const attachments = [];
  const repoSlug = sanitizeToken(request?.repo_slug ?? session?.repo_slug ?? "", "");
  const contextSources = Array.isArray(request?.context_sources)
    ? request.context_sources
    : ["repo", "docs", "graph"];
  if (repoSlug && contextSources.includes("repo")) {
    attachments.push(buildContextAttachment("repo", {
      label: repoSlug,
      summary: "Synced portal repository memory is attached. Local files are not read from the browser.",
      sourceRef: repoSlug,
    }));
  }
  if (repoSlug && contextSources.includes("docs")) {
    attachments.push(buildContextAttachment("docs", {
      label: "Docs/specs",
      summary: "Use synced docs/spec metadata and citations where available.",
      sourceRef: `${repoSlug}/docs`,
    }));
  }
  if (repoSlug && contextSources.includes("graph")) {
    attachments.push(buildContextAttachment("repo_graph", {
      label: "Repo graph",
      summary: "Use synced graph and diagram artifacts where available.",
      sourceRef: `${repoSlug}/graph`,
    }));
  }
  const contextPackId = sanitizeText(
    request?.context_pack_id ?? request?.contextPackId ?? request?.selected_context_pack_id ?? "",
    160,
  );
  if (contextPackId) {
    const contextPack = await loadRepositoryContextPackRecord({
      serviceStorageRoot,
      profileSlug: repoSlug,
      packId: contextPackId,
    });
    attachments.push(
      contextPack
        ? attachContextPack(contextPack)
        : buildContextAttachment("context_pack", {
            label: contextPackId,
            summary: "Requested context pack was not found in synced portal storage.",
            sourceRef: contextPackId,
          }),
    );
  }
  const domainPack = sanitizeText(request?.domain_pack_id ?? request?.pack_id ?? "", 120);
  if (domainPack) {
    attachments.push(buildContextAttachment("domain_pack", {
      label: domainPack,
      summary: "Domain pack guidance is attached for source-backed workflow and artifact generation.",
      sourceRef: domainPack,
    }));
  }
  return attachments;
}

async function loadRepositoryContextPackRecord({ serviceStorageRoot, profileSlug, packId } = {}) {
  const safeSlug = sanitizeToken(profileSlug, "");
  const safePackId = sanitizeToken(packId, "");
  if (!serviceStorageRoot || !safeSlug || !safePackId) {
    return null;
  }
  const paths = getServiceStoragePaths({ serviceStorageRoot });
  const repositoryRoot = path.join(paths.contextPackRepositoryFilesRoot, safeSlug);
  if (safePackId === "latest") {
    return (await listRepositoryContextPacks({ serviceStorageRoot, profileSlug: safeSlug }))[0] ?? null;
  }
  return readJsonOrDefault(path.join(repositoryRoot, `${safePackId}.json`), null);
}

function resolvePortalSecretKey(env = process.env) {
  const raw = String(env.BE_AI_HEART_PORTAL_SECRET_KEY ?? "").trim();
  if (!raw) {
    return null;
  }
  return createHash("sha256").update(raw).digest();
}

function encryptProviderSecret(secret, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    auth_tag: authTag.toString("base64"),
  };
}

function decryptProviderSecret(encrypted, key) {
  if (encrypted?.alg !== "aes-256-gcm") {
    throw createPortalContractError(400, "Unsupported provider key encryption format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.auth_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function normalizeApiKey(value) {
  const raw = String(value ?? "").trim();
  return raw.length > 0 && raw.length <= 4096 ? raw : "";
}

function createPortalContractError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function classifyChatCommand(input) {
  const normalized = input.toLowerCase();
  if (/tolling|domain pack|demo kit|agency overlay|hctra|txdot|ntta|rfp|proposal starter/.test(normalized)) {
    if (/conflict|overlay/.test(normalized)) {
      return CHAT_INTENTS.domainPackConflicts;
    }
    if (/benchmark|scenario|roi/.test(normalized)) {
      return CHAT_INTENTS.domainPackBenchmarks;
    }
    if (/build|generate|create|proposal|website|demo kit|context pack/.test(normalized)) {
      return CHAT_INTENTS.domainPackGenerate;
    }
    return CHAT_INTENTS.domainPackGet;
  }
  if (/\b(scan|rescan)\b/.test(normalized) && /\brepo|repository\b/.test(normalized)) {
    return CHAT_INTENTS.scanRepo;
  }
  if (/context\s+pack|heart\s+pack/.test(normalized)) {
    return CHAT_INTENTS.generateContextPack;
  }
  if (/\bgraph\b/.test(normalized)) {
    return CHAT_INTENTS.showGraph;
  }
  if (/architecture|how\s+.*works|explain/.test(normalized)) {
    return CHAT_INTENTS.explainArchitecture;
  }
  if (/search\s+docs|docs?\s+for|spec/.test(normalized)) {
    return CHAT_INTENTS.searchDocs;
  }
  if (/benchmark|roi|compare/.test(normalized)) {
    return CHAT_INTENTS.compareBenchmark;
  }
  if (/story\s+status|update\s+story/.test(normalized)) {
    return CHAT_INTENTS.updateStoryStatus;
  }
  if (/policy|violation|governance/.test(normalized)) {
    return CHAT_INTENTS.showPolicyViolations;
  }
  return CHAT_INTENTS.explainArchitecture;
}

function classifyIntentSafety(intent, input) {
  const normalized = input.toLowerCase();
  const denied = /\b(rm\s+-rf|sudo|bash|shell|curl\s+|wget\s+|chmod|chown|delete\s+repo|drop\s+table)\b/.test(normalized);
  const requiresConfirmation = [
    CHAT_INTENTS.scanRepo,
    CHAT_INTENTS.generateContextPack,
    CHAT_INTENTS.updateStoryStatus,
    CHAT_INTENTS.domainPackGenerate,
  ].includes(intent);
  return {
    level: denied
      ? "denied"
      : requiresConfirmation
        ? "confirmation_required"
        : "read_only",
    denied,
    requires_confirmation: !denied && requiresConfirmation,
    reason: denied
      ? "Portal chat cannot run arbitrary shell or destructive commands."
      : requiresConfirmation
        ? "This action can create artifacts or require a local runner, so confirmation is required."
        : "Read-only command resolved through synced artifacts.",
  };
}

function buildCommandResultCards({ intent, safety, repoSlug, input }) {
  if (safety.denied) {
    return [{
      card_type: "policy_warning",
      title: "Command blocked",
      summary: safety.reason,
      status: "blocked",
    }];
  }
  const repoPath = repoSlug ? `/repositories/${repoSlug}` : "/repositories";
  const cardsByIntent = {
    [CHAT_INTENTS.scanRepo]: {
      card_type: "sync_action",
      title: "Scan request prepared",
      summary: "Run the scan through the local CLI or connected runner, then sync artifacts back to the portal.",
      status: "needs_confirmation",
      href: `${repoPath}/sync`,
    },
    [CHAT_INTENTS.generateContextPack]: {
      card_type: "context_pack",
      title: "Context pack request prepared",
      summary: `The portal can generate a hosted pack preview for: ${input.slice(0, 120)}`,
      status: "needs_confirmation",
      href: `${repoPath}/context-packs`,
    },
    [CHAT_INTENTS.showGraph]: {
      card_type: "graph",
      title: "Open graph view",
      summary: "Graph answers are grounded in the latest synced repository artifact.",
      status: "ready",
      href: `${repoPath}/graph`,
    },
    [CHAT_INTENTS.explainArchitecture]: {
      card_type: "architecture",
      title: "Architecture explanation",
      summary: "Use synced graph, diagrams, and docs as cited context before creating implementation work.",
      status: "ready",
      href: repoPath,
    },
    [CHAT_INTENTS.searchDocs]: {
      card_type: "documents",
      title: "Search docs/spec memory",
      summary: "Document search should cite PRD, architecture, user stories, decisions, and business requirements.",
      status: "ready",
      href: repoSlug ? `${repoPath}/docs` : "/documents",
    },
    [CHAT_INTENTS.compareBenchmark]: {
      card_type: "benchmark",
      title: "Compare benchmark evidence",
      summary: "ROI answers must separate observed, estimated, designed-to-measure, and unknown metrics.",
      status: "ready",
      href: repoSlug ? `${repoPath}/benchmarks` : "/benchmarks",
    },
    [CHAT_INTENTS.updateStoryStatus]: {
      card_type: "docs_proposal",
      title: "Story update requires confirmation",
      summary: "Story changes are handled as document proposals. The portal does not write directly to the local repo.",
      status: "needs_confirmation",
      href: repoSlug ? `${repoPath}/docs` : "/documents",
    },
    [CHAT_INTENTS.showPolicyViolations]: {
      card_type: "policy",
      title: "Show policy violations",
      summary: "Policy answers are scoped to synced warnings and active governance rules.",
      status: "ready",
      href: repoSlug ? `${repoPath}/policies` : "/policies",
    },
    [CHAT_INTENTS.domainPackGet]: {
      card_type: "domain_pack",
      title: "Open Tolling Management pack",
      summary: "Review source-backed overview, outputs, layers, overlays, warnings, and benchmark scenarios.",
      status: "ready",
      href: "/domain-packs/tolling-management",
    },
    [CHAT_INTENTS.domainPackGenerate]: {
      card_type: "domain_pack_artifact",
      title: "Pack build request prepared",
      summary: "Generate a demo-safe tolling artifact through the allowlisted pack builder.",
      status: "needs_confirmation",
      href: "/domain-packs/tolling-management",
    },
    [CHAT_INTENTS.domainPackConflicts]: {
      card_type: "domain_pack_conflicts",
      title: "Review tolling layer conflicts",
      summary: "Conflict checks compare core, regional, agency, and customer overlay rules before generation.",
      status: "ready",
      href: "/domain-packs/tolling-management",
    },
    [CHAT_INTENTS.domainPackBenchmarks]: {
      card_type: "domain_pack_benchmarks",
      title: "Open tolling benchmark scenarios",
      summary: "Benchmark answers must stay scenario-backed and avoid unsupported ROI claims.",
      status: "ready",
      href: "/domain-packs/tolling-management",
    },
  };
  return [cardsByIntent[intent] ?? cardsByIntent[CHAT_INTENTS.explainArchitecture]];
}

function buildCommandCitations({ intent, repoSlug }) {
  const scope = repoSlug ? `repositories/${repoSlug}` : "workspace";
  if (intent === CHAT_INTENTS.searchDocs || intent === CHAT_INTENTS.updateStoryStatus) {
    return [{ type: "document_index", label: "Docs/spec memory", ref: `${scope}/documents` }];
  }
  if (intent === CHAT_INTENTS.showGraph || intent === CHAT_INTENTS.explainArchitecture) {
    return [{ type: "graph_artifact", label: "Synced graph", ref: `${scope}/graph` }];
  }
  if (intent === CHAT_INTENTS.compareBenchmark) {
    return [{ type: "benchmark_artifact", label: "Benchmark evidence", ref: `${scope}/benchmarks` }];
  }
  if ([
    CHAT_INTENTS.domainPackGet,
    CHAT_INTENTS.domainPackGenerate,
    CHAT_INTENTS.domainPackConflicts,
    CHAT_INTENTS.domainPackBenchmarks,
  ].includes(intent)) {
    return [
      { type: "domain_pack_source", label: "Tolling Management source notes", ref: "packs/tolling-management/source-notes.md" },
      { type: "domain_pack_spec", label: "Tolling domain pack plan", ref: "docs/specs/tolling-management-domain-pack-plan.md" },
    ];
  }
  return [{ type: "repo_artifact", label: "Repository profile", ref: scope }];
}

function buildCommandNextActions({ intent, safety, repoSlug }) {
  if (safety.denied) {
    return ["Use an allowlisted product command such as show graph, search docs, or generate context pack."];
  }
  if (safety.requires_confirmation) {
    return ["Review the action scope.", "Confirm before creating artifacts or requesting local runner work."];
  }
  if ([
    CHAT_INTENTS.domainPackGet,
    CHAT_INTENTS.domainPackConflicts,
    CHAT_INTENTS.domainPackBenchmarks,
  ].includes(intent)) {
    return ["Open the Tolling Management pack detail.", "Review citations and security warnings before generating artifacts."];
  }
  const prefix = repoSlug ? "Open the cited repo page" : "Open the cited workspace page";
  return [prefix, "Use cited files/docs before asking an agent to implement changes."];
}

function buildPackCommandContext({ request, intent } = {}) {
  if (![
    CHAT_INTENTS.domainPackGet,
    CHAT_INTENTS.domainPackGenerate,
    CHAT_INTENTS.domainPackConflicts,
    CHAT_INTENTS.domainPackBenchmarks,
  ].includes(intent)) {
    return null;
  }
  return {
    selected_pack_id: sanitizeText(request?.selected_pack_id ?? request?.pack_id ?? "tolling-management", 80),
    output_type: sanitizeText(request?.output ?? request?.output_type ?? inferPackOutputFromInput(request?.input ?? ""), 80),
    regional_layer: sanitizeText(request?.regional_layer ?? "", 80),
    agency_overlay: sanitizeText(request?.agency_overlay ?? inferAgencyOverlayFromInput(request?.input ?? ""), 80),
    token_budget: clampNumber(request?.token_budget ?? request?.context_budget?.max_input_tokens ?? 4000, 500, 32000),
    allowlisted_actions: [
      "domain_pack_get",
      "domain_pack_generate",
      "domain_pack_conflicts",
      "domain_pack_benchmark_scenarios",
    ],
  };
}

function inferPackOutputFromInput(input) {
  const normalized = String(input ?? "").toLowerCase();
  if (/website|microsite/.test(normalized)) return "website";
  if (/proposal|rfp/.test(normalized)) return "proposal";
  if (/benchmark|scenario/.test(normalized)) return "benchmarks";
  if (/context pack|implementation/.test(normalized)) return "context-pack";
  if (/prototype|ui/.test(normalized)) return "ui-prototype";
  return /demo kit|sales/.test(normalized) ? "sales-demo-kit" : "domain-pack";
}

function inferAgencyOverlayFromInput(input) {
  const normalized = String(input ?? "").toLowerCase();
  if (normalized.includes("hctra")) return "hctra-example";
  if (normalized.includes("txdot")) return "txdot-example";
  if (normalized.includes("ntta")) return "ntta-example";
  return "";
}

function normalizeMode(value) {
  const mode = String(value ?? "planning").trim();
  return ["planning", "code_context", "docs_spec_sync", "benchmark_eval", "admin_analysis"].includes(mode)
    ? mode
    : "planning";
}

function normalizeContextBudget(value) {
  if (value && typeof value === "object") {
    return {
      preset: ["compact", "standard", "deep", "custom"].includes(value.preset) ? value.preset : "standard",
      max_input_tokens: clampNumber(value.max_input_tokens ?? 8000, 500, 128000),
      max_output_tokens: clampNumber(value.max_output_tokens ?? 2000, 250, 32000),
    };
  }
  return {
    preset: "standard",
    max_input_tokens: 8000,
    max_output_tokens: 2000,
  };
}

function buildProviderOptions(persistedProviders = {}) {
  const providerDefinitions = [
    {
      provider_id: "openai_compatible",
      label: "OpenAI-compatible",
      default_model: "provider-default",
      configured: hasEnv("OPENAI_API_KEY") || hasEnv("BE_AI_HEART_OPENAI_API_KEY"),
    },
    {
      provider_id: "anthropic_compatible",
      label: "Anthropic-compatible",
      default_model: "provider-default",
      configured: hasEnv("ANTHROPIC_API_KEY") || hasEnv("BE_AI_HEART_ANTHROPIC_API_KEY"),
    },
    {
      provider_id: "google_compatible",
      label: "Google-compatible",
      default_model: "provider-default",
      configured: hasEnv("GOOGLE_API_KEY") || hasEnv("GEMINI_API_KEY") || hasEnv("BE_AI_HEART_GOOGLE_API_KEY"),
    },
    {
      provider_id: "local_openai_compatible",
      label: "Local OpenAI-compatible",
      default_model: "local-default",
      configured: Boolean(process.env.BE_AI_HEART_LOCAL_MODEL_BASE_URL),
      local: true,
    },
  ];

  return providerDefinitions.map((definition) => {
    const persisted = persistedProviders[definition.provider_id] ?? {};
    const configured = Boolean(definition.configured || persisted.configured);
    return {
      ...definition,
      configured,
      disabled_reason: configured
        ? ""
        : definition.local
          ? "Local model endpoint is not configured."
          : "Provider key is missing on the server.",
      key_status: configured ? "configured_masked" : "missing",
      masked_key: configured ? "********" : "",
      base_url_configured: Boolean(persisted.base_url || (definition.local && process.env.BE_AI_HEART_LOCAL_MODEL_BASE_URL)),
      models: normalizeModels(persisted.models, definition.default_model),
      cost_visibility: normalizeCostVisibility(persisted.costs),
    };
  });
}

function sanitizeProviderSettings(providers = {}) {
  return Object.fromEntries(
    Object.entries(providers).map(([providerId, config]) => [
      sanitizeText(providerId, 80),
      {
        enabled: Boolean(config?.enabled ?? true),
        configured: Boolean(config?.configured),
        default_model: sanitizeText(config?.default_model ?? "provider-default", 120),
        base_url: sanitizeBaseUrl(config?.base_url),
        models: normalizeModels(config?.models, config?.default_model ?? "provider-default"),
        costs: normalizeCostVisibility(config?.costs),
      },
    ]),
  );
}

function sanitizePresetSettings(presets = {}) {
  return Object.fromEntries(
    Object.entries(presets).map(([presetId, config]) => [
      sanitizeText(presetId, 80),
      {
        provider_id: normalizeProviderId(config?.provider_id ?? "openai"),
        model: sanitizeText(config?.model ?? "provider-default", 120),
        token_budget: clampNumber(config?.token_budget ?? 8000, 500, 128000),
      },
    ]),
  );
}

function assertNoRawSecrets(payload = {}) {
  if (containsRawModelSecret(payload)) {
    const error = new Error("Raw model provider secrets are not accepted by this endpoint. Configure secrets server-side and store only masked provider state.");
    error.statusCode = 400;
    throw error;
  }
}

function normalizeModels(models, fallback) {
  const values = Array.isArray(models) ? models : [fallback].filter(Boolean);
  return [...new Set(values.map((model) => sanitizeText(model, 120)).filter(Boolean))].slice(0, 20);
}

function normalizeCostVisibility(costs = {}) {
  return {
    source: costs?.source ? sanitizeText(costs.source, 80) : "not_configured",
    input_per_1m_usd: normalizeOptionalNumber(costs?.input_per_1m_usd),
    cached_input_per_1m_usd: normalizeOptionalNumber(costs?.cached_input_per_1m_usd),
    output_per_1m_usd: normalizeOptionalNumber(costs?.output_per_1m_usd),
  };
}

function normalizeOptionalNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 1000000) / 1000000 : null;
}

function sanitizeBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function hasEnv(name) {
  return Boolean(String(process.env[name] ?? "").trim());
}

function resolveNextAction({
  profile,
  stale,
  docs,
  benchmark,
  policy,
  contextPacks,
} = {}) {
  if (!profile) {
    return {
      action_id: "sync_profile",
      label: "Sync repository profile",
      command: "heart sync profile --url <api> --session <token>",
    };
  }
  if (stale) {
    return {
      action_id: "rescan",
      label: "Run local scan and sync fresh artifacts",
      command: "heart scan && heart sync profile --url <api> --session <token>",
    };
  }
  if ((docs?.state ?? "missing") !== "ready") {
    return {
      action_id: "sync_docs",
      label: "Sync docs/spec/business requirements",
      command: "heart docs sync-web && heart sync docs --url <api> --session <token>",
    };
  }
  if (contextPacks.length === 0) {
    return {
      action_id: "create_context_pack",
      label: "Create first task context pack",
      command: "heart pack \"next implementation task\"",
    };
  }
  if ((benchmark?.state ?? "missing") !== "ready") {
    return {
      action_id: "run_benchmark",
      label: "Publish benchmark evidence",
      command: "heart benchmark run <scenario>",
    };
  }
  if ((policy?.summary?.warning_count ?? 0) > 0) {
    return {
      action_id: "review_policy",
      label: "Review policy warnings",
      command: "heart policy check",
    };
  }
  return {
    action_id: "ready",
    label: "Repo memory is ready for agent handoff",
    command: "heart pack \"next implementation task\"",
  };
}

function artifactVersion(key, label, syncedAt, exists, version) {
  return {
    key,
    label,
    status: exists ? "synced" : "missing",
    synced_at: exists ? syncedAt : "",
    schema_version: version ?? null,
  };
}

function summarizeDiagrams(diagrams = [], { includeMermaid = false } = {}) {
  return (Array.isArray(diagrams) ? diagrams : []).slice(0, 20).map((diagram) => ({
    id: String(diagram.id ?? diagram.slug ?? diagram.title ?? "diagram").slice(0, 120),
    title: String(diagram.title ?? diagram.type ?? "Diagram").slice(0, 140),
    type: String(diagram.type ?? "diagram").slice(0, 80),
    trust_label: diagram.trust?.label ?? diagram.confidence_label ?? "generated",
    confidence_label: diagram.confidence_label ?? diagram.trust?.label ?? "medium",
    inference_mode: diagram.inference_mode ?? "generated",
    source_files: summarizeSourceFiles(diagram.source_files ?? diagram.files),
    validation: diagram.validation ?? null,
    ...(includeMermaid ? { mermaid: String(diagram.mermaid ?? diagram.source ?? diagram.content ?? "").slice(0, 20000) } : {}),
  }));
}

function summarizeSourceFiles(values = []) {
  const files = Array.isArray(values)
    ? values
    : Array.isArray(values?.nodes)
      ? values.nodes.map((node) => node.path)
      : [];
  return [...new Set(files.map((value) => sanitizeArtifactPath(value)).filter(Boolean))].slice(0, 20);
}

function normalizePackItems(items, limit) {
  return Array.isArray(items) ? items.slice(0, limit) : [];
}

function normalizeEvidenceLabel(value) {
  const mode = String(value ?? "").toLowerCase();
  if (mode.includes("observed")) {
    return "observed";
  }
  if (mode.includes("estimated")) {
    return "estimated";
  }
  if (!mode) {
    return "unknown";
  }
  return "designed_to_measure";
}

function isStale(value) {
  const safeValue = safeIso(value);
  if (!safeValue) {
    return true;
  }
  return new Date(safeValue).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function latestIso(values = []) {
  return values
    .map(safeIso)
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";
}

function safeIso(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function sanitizeArtifactPath(value) {
  const pathValue = String(value ?? "").replace(/\\/g, "/");
  if (!pathValue || pathValue.startsWith("/") || /^[A-Za-z]:\//.test(pathValue)) {
    return "";
  }
  return pathValue.split("/").filter(Boolean).join("/").slice(0, 180);
}

function sanitizeToken(value, fallback) {
  return String(value ?? fallback ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function sanitizeText(value, limit) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

async function readJsonOrDefault(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}
