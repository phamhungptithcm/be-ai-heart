const FALLBACK_MANIFEST_VERSION = "2026-05-03";
const FALLBACK_SOURCE = "versioned_fallback";
const DEFAULT_TIMEOUT_MS = 10_000;
const PRICING_CATALOG_VERSION = "2026-05-03";
const PRICING_CATALOG_SOURCE = "versioned_static_catalog";

export const MODEL_CAPABILITIES = Object.freeze({
  text: "text",
  streaming: "streaming",
  toolCalling: "tool_calling",
  vision: "vision",
  embeddings: "embeddings",
});

const STATIC_PRICING_CATALOG = Object.freeze({
  openai: {
    source_url: "https://platform.openai.com/docs/pricing/",
    models: {
      "gpt-5.2": pricing(1.75, 14, { cached_input_per_1m: 0.175 }),
      "gpt-5.1": pricing(1.25, 10, { cached_input_per_1m: 0.125 }),
      "gpt-5": pricing(1.25, 10, { cached_input_per_1m: 0.125 }),
      "gpt-5-mini": pricing(0.25, 2, { cached_input_per_1m: 0.025 }),
      "gpt-5-nano": pricing(0.05, 0.4, { cached_input_per_1m: 0.005 }),
      "gpt-4.1": pricing(2, 8, { cached_input_per_1m: 0.5 }),
      "gpt-4.1-mini": pricing(0.4, 1.6, { cached_input_per_1m: 0.1 }),
      "gpt-4.1-nano": pricing(0.1, 0.4, { cached_input_per_1m: 0.025 }),
    },
  },
  anthropic: {
    source_url: "https://docs.anthropic.com/en/docs/about-claude/pricing",
    models: {
      "claude-opus-4-1-20250805": pricing(15, 75, { cached_input_per_1m: 1.5 }),
      "claude-sonnet-4-5-20250929": pricing(3, 15, { cached_input_per_1m: 0.3 }),
      "claude-sonnet-4-20250514": pricing(3, 15, { cached_input_per_1m: 0.3 }),
      "claude-3-5-haiku-latest": pricing(0.8, 4, { cached_input_per_1m: 0.08 }),
    },
  },
  gemini: {
    source_url: "https://ai.google.dev/gemini-api/docs/pricing",
    models: {
      "gemini-2.5-pro": pricing(1.25, 10, { cached_input_per_1m: 0.125, note: "Standard text prompts <= 200k tokens." }),
      "gemini-2.5-flash": pricing(0.15, 1.25, { cached_input_per_1m: 0.03 }),
      "gemini-2.5-flash-lite": pricing(0.18, 0.72, { cached_input_per_1m: 0.018 }),
      "gemini-2.0-flash": pricing(0.1, 0.4, { cached_input_per_1m: 0.025, note: "Google marks Gemini 2.0 Flash deprecated with shutdown on 2026-06-01." }),
      "gemini-2.0-flash-lite": pricing(0.075, 0.3),
    },
  },
  groq: {
    source_url: "https://console.groq.com/docs/models",
    models: {
      "llama-3.1-8b-instant": pricing(0.05, 0.08),
      "llama-3.3-70b-versatile": pricing(0.59, 0.79),
      "openai/gpt-oss-120b": pricing(0.15, 0.6),
      "openai/gpt-oss-20b": pricing(0.075, 0.3),
      "meta-llama/llama-4-scout-17b-16e-instruct": pricing(0.11, 0.34),
    },
  },
  openrouter: {
    source_url: "https://openrouter.ai/docs/guides/overview/models",
    models: {},
    dynamic_pricing: true,
  },
  mistral: {
    source_url: "https://docs.mistral.ai/deployment/ai-studio/pricing",
    models: {},
    external_pricing_page: true,
  },
  bedrock: {
    source_url: "https://aws.amazon.com/bedrock/pricing/",
    models: {},
    region_variant_pricing: true,
  },
  ollama: {
    source_url: "https://github.com/ollama/ollama/blob/main/docs/api.md",
    models: {},
    local_runtime: true,
  },
  lmstudio: {
    source_url: "https://lmstudio.ai/docs/app/api",
    models: {},
    local_runtime: true,
  },
});

const PROVIDERS = Object.freeze({
  openai: createProvider({
    provider_id: "openai",
    label: "OpenAI",
    auth_method: "bearer_api_key",
    default_base_url: "https://api.openai.com/v1",
    env_keys: ["OPENAI_API_KEY", "BE_AI_HEART_OPENAI_API_KEY"],
    model_list_path: "/models",
    chat_method: "responses",
    docs_url: "https://platform.openai.com/docs/api-reference/responses",
    models_docs_url: "https://platform.openai.com/docs/api-reference/models",
    supports: {
      dynamic_models: true,
      streaming: true,
      tool_calling: true,
      vision: true,
      embeddings: true,
    },
    fallback_models: [
      model("gpt-5.1", { context_length: 272000, tool_calling: true, vision: true }),
      model("gpt-5-mini", { context_length: 272000, tool_calling: true, vision: true }),
      model("gpt-4.1", { context_length: 1047576, tool_calling: true, vision: true }),
      model("text-embedding-3-large", { text: false, streaming: false, embeddings: true, context_length: 8191 }),
    ],
  }),
  anthropic: createProvider({
    provider_id: "anthropic",
    label: "Anthropic",
    auth_method: "x-api-key",
    default_base_url: "https://api.anthropic.com/v1",
    env_keys: ["ANTHROPIC_API_KEY", "BE_AI_HEART_ANTHROPIC_API_KEY"],
    model_list_path: "/models",
    chat_method: "messages",
    docs_url: "https://docs.anthropic.com/en/api/messages",
    models_docs_url: "https://docs.anthropic.com/en/docs/about-claude/models/all-models",
    supports: {
      dynamic_models: true,
      streaming: true,
      tool_calling: true,
      vision: true,
      embeddings: false,
    },
    fallback_models: [
      model("claude-sonnet-4-5-20250929", { context_length: 200000, tool_calling: true, vision: true }),
      model("claude-opus-4-1-20250805", { context_length: 200000, tool_calling: true, vision: true }),
      model("claude-haiku-4-5-20251001", { context_length: 200000, tool_calling: true, vision: true }),
    ],
  }),
  gemini: createProvider({
    provider_id: "gemini",
    label: "Google Gemini",
    auth_method: "api_key_query",
    default_base_url: "https://generativelanguage.googleapis.com/v1beta",
    env_keys: [
      "GEMINI_API_KEY",
      "GOOGLE_API_KEY",
      "BE_AI_HEART_GEMINI_API_KEY",
      "BE_AI_HEART_GOOGLE_API_KEY",
    ],
    model_list_path: "/models",
    chat_method: "generate_content",
    docs_url: "https://ai.google.dev/api/generate-content",
    models_docs_url: "https://ai.google.dev/gemini-api/docs/models",
    supports: {
      dynamic_models: true,
      streaming: true,
      tool_calling: true,
      vision: true,
      embeddings: true,
    },
    fallback_models: [
      model("gemini-2.5-pro", { context_length: 1048576, tool_calling: true, vision: true }),
      model("gemini-2.5-flash", { context_length: 1048576, tool_calling: true, vision: true }),
      model("gemini-2.0-flash", { context_length: 1048576, tool_calling: true, vision: true }),
      model("text-embedding-004", { text: false, streaming: false, embeddings: true, context_length: 2048 }),
    ],
  }),
  openrouter: createProvider({
    provider_id: "openrouter",
    label: "OpenRouter",
    auth_method: "bearer_api_key",
    default_base_url: "https://openrouter.ai/api/v1",
    env_keys: ["OPENROUTER_API_KEY", "BE_AI_HEART_OPENROUTER_API_KEY"],
    model_list_path: "/models",
    chat_method: "openai_chat_completions",
    docs_url: "https://openrouter.ai/docs/api-reference/chat-completion",
    models_docs_url: "https://openrouter.ai/docs/guides/overview/models",
    supports: {
      dynamic_models: true,
      streaming: true,
      tool_calling: true,
      vision: true,
      embeddings: false,
    },
    fallback_models: [
      model("openai/gpt-4.1", { context_length: 1047576, tool_calling: true, vision: true }),
      model("anthropic/claude-sonnet-4.5", { context_length: 200000, tool_calling: true, vision: true }),
      model("google/gemini-2.5-pro", { context_length: 1048576, tool_calling: true, vision: true }),
    ],
  }),
  mistral: createProvider({
    provider_id: "mistral",
    label: "Mistral AI",
    auth_method: "bearer_api_key",
    default_base_url: "https://api.mistral.ai/v1",
    env_keys: ["MISTRAL_API_KEY", "BE_AI_HEART_MISTRAL_API_KEY"],
    model_list_path: "/models",
    chat_method: "openai_chat_completions",
    docs_url: "https://docs.mistral.ai/api/endpoint/chat/",
    models_docs_url: "https://docs.mistral.ai/models/",
    supports: {
      dynamic_models: true,
      streaming: true,
      tool_calling: true,
      vision: true,
      embeddings: true,
    },
    fallback_models: [
      model("mistral-large-latest", { context_length: 128000, tool_calling: true }),
      model("mistral-small-latest", { context_length: 128000, tool_calling: true }),
      model("codestral-latest", { context_length: 256000, tool_calling: true }),
      model("mistral-embed", { text: false, streaming: false, embeddings: true, context_length: 8192 }),
    ],
  }),
  groq: createProvider({
    provider_id: "groq",
    label: "Groq",
    auth_method: "bearer_api_key",
    default_base_url: "https://api.groq.com/openai/v1",
    env_keys: ["GROQ_API_KEY", "BE_AI_HEART_GROQ_API_KEY"],
    model_list_path: "/models",
    chat_method: "openai_chat_completions",
    docs_url: "https://console.groq.com/docs/api-reference",
    models_docs_url: "https://console.groq.com/docs/models",
    supports: {
      dynamic_models: true,
      streaming: true,
      tool_calling: true,
      vision: true,
      embeddings: false,
    },
    fallback_models: [
      model("llama-3.3-70b-versatile", { context_length: 128000, tool_calling: true }),
      model("openai/gpt-oss-120b", { context_length: 128000, tool_calling: true }),
      model("meta-llama/llama-4-scout-17b-16e-instruct", { context_length: 131072, tool_calling: true, vision: true }),
    ],
  }),
  bedrock: createProvider({
    provider_id: "bedrock",
    label: "AWS Bedrock",
    auth_method: "aws_sigv4",
    default_base_url: "https://bedrock-runtime.us-east-1.amazonaws.com",
    base_url_env_keys: ["BE_AI_HEART_BEDROCK_BASE_URL"],
    env_keys: ["AWS_ACCESS_KEY_ID", "AWS_PROFILE", "BE_AI_HEART_BEDROCK_PROFILE"],
    model_list_path: "/foundation-models",
    chat_method: "bedrock_converse",
    docs_url: "https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html",
    models_docs_url: "https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html",
    supports: {
      dynamic_models: false,
      streaming: true,
      tool_calling: true,
      vision: true,
      embeddings: true,
    },
    fallback_models: [
      model("anthropic.claude-sonnet-4-5-20250929-v1:0", { context_length: 200000, tool_calling: true, vision: true }),
      model("amazon.nova-pro-v1:0", { context_length: 300000, tool_calling: true, vision: true }),
      model("cohere.embed-english-v3", { text: false, streaming: false, embeddings: true, context_length: 512 }),
    ],
  }),
  ollama: createProvider({
    provider_id: "ollama",
    label: "Ollama",
    auth_method: "none",
    local: true,
    requires_api_key: false,
    default_base_url: "http://127.0.0.1:11434/api",
    base_url_env_keys: ["BE_AI_HEART_OLLAMA_BASE_URL", "OLLAMA_HOST"],
    env_keys: [],
    model_list_path: "/tags",
    chat_method: "ollama_chat",
    docs_url: "https://github.com/ollama/ollama/blob/main/docs/api.md",
    models_docs_url: "https://ollama.com/library",
    supports: {
      dynamic_models: true,
      streaming: true,
      tool_calling: false,
      vision: true,
      embeddings: true,
    },
    fallback_models: [
      model("llama3.2", { context_length: 128000, pricing: localPricing() }),
      model("qwen2.5-coder", { context_length: 128000, pricing: localPricing() }),
      model("nomic-embed-text", { text: false, streaming: false, embeddings: true, context_length: 8192, pricing: localPricing() }),
    ],
  }),
  lmstudio: createProvider({
    provider_id: "lmstudio",
    label: "LM Studio",
    auth_method: "none",
    local: true,
    requires_api_key: false,
    default_base_url: "http://127.0.0.1:1234/v1",
    base_url_env_keys: ["BE_AI_HEART_LMSTUDIO_BASE_URL", "LMSTUDIO_BASE_URL"],
    env_keys: [],
    model_list_path: "/models",
    chat_method: "openai_chat_completions",
    docs_url: "https://lmstudio.ai/docs/app/api",
    models_docs_url: "https://lmstudio.ai/models",
    supports: {
      dynamic_models: true,
      streaming: true,
      tool_calling: true,
      vision: true,
      embeddings: true,
    },
    fallback_models: [
      model("local-model", { context_length: 0, tool_calling: true, vision: true, pricing: localPricing() }),
    ],
  }),
});

export function listProviders({ env = process.env, credentialState = {}, includeDisabled = true } = {}) {
  return Object.values(PROVIDERS)
    .map((provider) => toPublicProvider(provider, { env, credentialState }))
    .filter((provider) => includeDisabled || provider.configured);
}

export function getProviderDefinition(providerId) {
  const safeProviderId = normalizeProviderId(providerId);
  const provider = PROVIDERS[safeProviderId];
  if (!provider) {
    throw createRegistryError("unknown_provider", `Unknown model provider: ${providerId}`);
  }
  return provider;
}

export async function listProviderModels({
  providerId,
  credential,
  env = process.env,
  fetchImpl = globalThis.fetch,
  dynamic = true,
  includeFallbackOnError = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const provider = getProviderDefinition(providerId);
  const resolvedCredential = resolveProviderCredential({
    providerId: provider.provider_id,
    credential,
    env,
  });

  if (!dynamic || (!resolvedCredential.api_key && provider.requires_api_key) || !provider.supports.dynamic_models) {
    return fallbackModelList(provider, {
      warning: resolvedCredential.api_key
        ? "Dynamic model discovery was not requested."
        : provider.requires_api_key
          ? `No API key found. Set ${provider.env_keys[0]} or add a BeHeart provider key.`
          : "Dynamic model discovery was not requested or the local endpoint is unavailable.",
    });
  }

  if (typeof fetchImpl !== "function") {
    return fallbackModelList(provider, {
      warning: "No fetch implementation is available for dynamic model discovery.",
    });
  }

  try {
    const discovered = await fetchProviderModels(provider, {
      apiKey: resolvedCredential.api_key,
      env,
      fetchImpl,
      timeoutMs,
    });
    return {
      schema_version: 1,
      provider: toPublicProvider(provider, { env, credentialState: { [provider.provider_id]: resolvedCredential } }),
      provider_id: provider.provider_id,
      source: "dynamic",
      dynamic: true,
      refreshed_at: new Date().toISOString(),
      fallback_manifest_version: "",
      warnings: [],
      models: discovered.map((entry) => normalizeDiscoveredModel(provider, entry)),
    };
  } catch (error) {
    if (!includeFallbackOnError) {
      throw error;
    }
    return fallbackModelList(provider, {
      warning: `Dynamic model discovery failed: ${safeErrorMessage(error)}`,
      error: normalizeDiscoveryError(error),
    });
  }
}

export async function refreshProviderModels(options = {}) {
  return listProviderModels({
    ...options,
    dynamic: true,
    includeFallbackOnError: options.includeFallbackOnError ?? true,
  });
}

export function getModelCapabilities({ providerId, modelId } = {}) {
  const provider = getProviderDefinition(providerId);
  const fallback = provider.fallback_models.find((entry) => entry.model_id === String(modelId ?? ""));
  return fallback?.capabilities ?? inferModelCapabilities(provider, String(modelId ?? ""));
}

export function getModelPricing({ providerId, modelId } = {}) {
  const provider = getProviderDefinition(providerId);
  const fallback = provider.fallback_models.find((entry) => entry.model_id === String(modelId ?? ""));
  return fallback?.pricing ?? getStaticModelPricing(provider.provider_id, modelId);
}

export function getPricingCatalog({ providerId } = {}) {
  const providerIds = providerId ? [getProviderDefinition(providerId).provider_id] : Object.keys(PROVIDERS);
  return {
    schema_version: 1,
    catalog_version: PRICING_CATALOG_VERSION,
    source: PRICING_CATALOG_SOURCE,
    retrieved_at: "2026-05-03",
    stale_after: "2026-06-03",
    governance: {
      status: "partial_overlay",
      policy: "Provider-returned dynamic pricing wins when available; otherwise BeHeart uses this dated overlay or returns unknown-cost warnings.",
      review_required_after: "2026-06-03",
      full_provider_wide_catalog: "deferred",
    },
    providers: Object.fromEntries(
      providerIds.map((id) => {
        const providerCatalog = STATIC_PRICING_CATALOG[id] ?? { models: {} };
        const models = Object.fromEntries(
          Object.entries(providerCatalog.models ?? {}).map(([modelId, modelPricing]) => [
            modelId,
            {
              ...modelPricing,
              source_url: modelPricing.source_url || providerCatalog.source_url || "",
            },
          ]),
        );
        return [id, {
          source_url: providerCatalog.source_url ?? "",
          dynamic_pricing: Boolean(providerCatalog.dynamic_pricing),
          local_runtime: Boolean(providerCatalog.local_runtime),
          region_variant_pricing: Boolean(providerCatalog.region_variant_pricing),
          external_pricing_page: Boolean(providerCatalog.external_pricing_page),
          model_count: Object.keys(models).length,
          coverage: resolvePricingCoverage(providerCatalog, models),
          models,
        }];
      }),
    ),
  };
}

export function createProviderValidationPlan({ env = process.env, credentialState = {} } = {}) {
  const providers = listProviders({ env, credentialState });
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    providers: providers.map((provider) => {
      const definition = getProviderDefinition(provider.provider_id);
      const configured = provider.configured;
      const local = Boolean(definition.local);
      const bedrock = definition.auth_method === "aws_sigv4";
      const bedrockHasStaticCredentials = bedrock && hasBedrockStaticCredentials(env);
      const bedrockHasProfileOnly = bedrock && !bedrockHasStaticCredentials && hasBedrockProfile(env);
      const status = bedrock
        ? bedrockHasStaticCredentials
          ? "ready_for_live_test"
          : bedrockHasProfileOnly
            ? "ready_for_live_test"
            : "needs_aws_credentials"
        : local
          ? "needs_local_runtime"
          : configured
            ? "ready_for_live_test"
            : "needs_provider_key";
      return {
        schema_version: 1,
        provider_id: provider.provider_id,
        label: provider.label,
        status,
        configured,
        local_runtime: local,
        requires_api_key: definition.requires_api_key,
        validation_method: local ? "model_discovery_local_endpoint" : bedrock ? "aws_sigv4_model_discovery_api" : "model_discovery_api",
        command: bedrock
          ? bedrockHasStaticCredentials || bedrockHasProfileOnly
            ? "heart models test --provider bedrock --json"
            : "Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS_PROFILE for Bedrock live validation. AWS_REGION defaults to us-east-1 when omitted."
          : local || configured
            ? `heart models test --provider ${provider.provider_id} --json`
            : `heart models add-key --provider ${provider.provider_id} --api-key-stdin`,
        note: bedrock
          ? bedrockHasStaticCredentials
            ? "Bedrock SigV4 signing is available with environment credentials; live validation can run without exposing secrets."
            : bedrockHasProfileOnly
              ? "Bedrock SigV4 signing can resolve static AWS profiles and source_profile assume-role chains locally; IAM Identity Center/SSO profiles return an explicit deferred status."
              : "Bedrock live validation requires least-privilege AWS environment credentials or a supported AWS profile."
          : local
            ? "Start the local model server before running the test command."
            : configured
              ? "A real provider key is configured; live validation can run without exposing the key."
              : "No real provider key is configured.",
      };
    }),
  };
}

export function normalizeModelCapabilities(providerId, model = {}) {
  const provider = getProviderDefinition(providerId);
  return {
    ...inferModelCapabilities(provider, model.model_id ?? model.id ?? model.name ?? ""),
    ...(model.capabilities ?? {}),
  };
}

export function resolveProviderCredential({
  providerId,
  credential,
  env = process.env,
  explicitApiKey,
} = {}) {
  const provider = getProviderDefinition(providerId);
  const directKey = normalizeApiKey(
    explicitApiKey ??
      credential?.api_key ??
      credential?.apiKey ??
      credential?.secret ??
      "",
  );
  if (directKey) {
    return {
      provider_id: provider.provider_id,
      source: credential?.source ?? "explicit",
      api_key: directKey,
      masked_key: maskSecret(directKey),
      enabled: credential?.enabled !== false,
    };
  }

  for (const envKey of provider.env_keys) {
    const envValue = normalizeApiKey(env?.[envKey]);
    if (envValue) {
      return {
        provider_id: provider.provider_id,
        source: "environment",
        env_key: envKey,
        api_key: envValue,
        masked_key: maskSecret(envValue),
        enabled: true,
      };
    }
  }

  if (credential?.configured || credential?.masked_key) {
    return {
      provider_id: provider.provider_id,
      source: credential?.source ?? "stored",
      api_key: "",
      masked_key: String(credential.masked_key ?? ""),
      enabled: credential?.enabled !== false,
      configured: true,
    };
  }

  if (!provider.requires_api_key) {
    return {
      provider_id: provider.provider_id,
      source: "not_required",
      api_key: "",
      masked_key: "",
      enabled: true,
      configured: true,
    };
  }

  return {
    provider_id: provider.provider_id,
    source: "missing",
    api_key: "",
    masked_key: "",
    enabled: false,
  };
}

export function resolveProviderBaseUrl(providerOrId, { env = process.env } = {}) {
  const provider = typeof providerOrId === "string" ? getProviderDefinition(providerOrId) : providerOrId;
  for (const envKey of provider.base_url_env_keys ?? []) {
    const value = String(env?.[envKey] ?? "").trim();
    if (!value) {
      continue;
    }
    if (provider.provider_id === "ollama" && envKey === "OLLAMA_HOST" && !/\/api\/?$/.test(value)) {
      return `${value.replace(/\/+$/, "")}/api`;
    }
    return value;
  }
  return provider.default_base_url;
}

export function maskSecret(value) {
  const secret = normalizeApiKey(value);
  if (!secret) {
    return "";
  }
  if (secret.length <= 8) {
    return "[redacted]";
  }
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export function redactProviderSecrets(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return value
      .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]")
      .replace(/sk_[A-Za-z0-9_-]{8,}/g, "[redacted]")
      .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{12,}\b/g, "[redacted]")
      .replace(/\b(?:aws_)?secret_access_key\s*[:=]\s*["']?[^"'\s,}]+/gi, "secret_access_key=[redacted]")
      .replace(/([A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,})/g, "[redacted]");
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactProviderSecrets(entry));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (isSecretKeyName(key)) {
          return [key, entry ? "[redacted]" : ""];
        }
        return [key, redactProviderSecrets(entry)];
      }),
    );
  }
  return value;
}

export function parseProviderModelSpec(value, fallbackProviderId = "") {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return {
      provider_id: normalizeProviderId(fallbackProviderId),
      model_id: "",
    };
  }

  const slashIndex = raw.indexOf("/");
  if (slashIndex > 0) {
    const providerCandidate = normalizeProviderId(raw.slice(0, slashIndex));
    if (PROVIDERS[providerCandidate]) {
      return {
        provider_id: providerCandidate,
        model_id: raw.slice(slashIndex + 1).trim(),
      };
    }
  }

  return {
    provider_id: normalizeProviderId(fallbackProviderId),
    model_id: raw,
  };
}

export function normalizeProviderId(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "google" || raw === "google-gemini") {
    return "gemini";
  }
  return raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function fetchProviderModels(provider, { apiKey, env, fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const baseUrl = resolveProviderBaseUrl(provider, { env });
    const url = provider.auth_method === "api_key_query"
      ? appendQuery(new URL(buildProviderUrl(baseUrl, provider.model_list_path)), "key", apiKey)
      : buildProviderUrl(baseUrl, provider.model_list_path);
    const response = await fetchImpl(url, {
      method: "GET",
      headers: modelListHeaders(provider, apiKey),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw createRegistryError(
        statusToErrorCode(response.status),
        `Provider model discovery failed for ${provider.label}: HTTP ${response.status}`,
        { status: response.status },
      );
    }
    const payload = await response.json();
    if (provider.provider_id === "gemini") {
      return Array.isArray(payload.models) ? payload.models : [];
    }
    if (provider.provider_id === "ollama") {
      return Array.isArray(payload.models) ? payload.models : [];
    }
    return Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : [];
  } finally {
    clearTimeout(timeout);
  }
}

function modelListHeaders(provider, apiKey) {
  if (provider.provider_id === "anthropic") {
    return {
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    };
  }
  if (provider.auth_method === "bearer_api_key") {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
  return {};
}

function normalizeDiscoveredModel(provider, entry = {}) {
  const rawId = String(entry.id ?? entry.name ?? entry.model_id ?? entry.model ?? "").replace(/^models\//, "");
  const displayName = String(entry.displayName ?? entry.display_name ?? entry.name ?? rawId);
  const contextLength = Number(
    entry.context_length ??
      entry.contextLength ??
      entry.input_token_limit ??
      entry.inputTokenLimit ??
      entry.max_context_length ??
      0,
  );
  const outputLength = Number(entry.output_token_limit ?? entry.outputTokenLimit ?? entry.max_output_tokens ?? 0);

  return {
    schema_version: 1,
    provider_id: provider.provider_id,
    model_id: rawId,
    label: displayName,
    source: "dynamic",
    fallback: false,
    fallback_manifest_version: "",
    refreshed_at: new Date().toISOString(),
    capabilities: {
      ...inferModelCapabilities(provider, rawId),
      ...(contextLength > 0 ? { context_length: contextLength } : {}),
      ...(outputLength > 0 ? { max_output_tokens: outputLength } : {}),
    },
    pricing: normalizePricing(entry.pricing) ?? getStaticModelPricing(provider.provider_id, rawId),
    raw_metadata: sanitizeRawModelMetadata(entry),
  };
}

function fallbackModelList(provider, { warning = "", error = null } = {}) {
  return {
    schema_version: 1,
    provider: toPublicProvider(provider, {}),
    provider_id: provider.provider_id,
    source: FALLBACK_SOURCE,
    dynamic: false,
    refreshed_at: "",
    fallback_manifest_version: FALLBACK_MANIFEST_VERSION,
    warnings: [warning].filter(Boolean),
    error,
    models: provider.fallback_models.map((entry) => ({
      ...entry,
      source: FALLBACK_SOURCE,
      fallback: true,
      fallback_manifest_version: FALLBACK_MANIFEST_VERSION,
      refreshed_at: "",
    })),
  };
}

function toPublicProvider(provider, { env = process.env, credentialState = {} } = {}) {
  const credential = resolveCredentialWithoutProviderThrow(provider, {
    credential: credentialState?.[provider.provider_id],
    env,
  });
  const configured = Boolean((credential.api_key || credential.configured || credential.masked_key) && credential.enabled !== false);
  const keyRequired = provider.requires_api_key;
  return {
    schema_version: 1,
    provider_id: provider.provider_id,
    label: provider.label,
    auth_method: provider.auth_method,
    api_base_url: resolveProviderBaseUrl(provider, { env }),
    env_keys: provider.env_keys,
    model_list_method: provider.supports.dynamic_models ? "dynamic_api" : "fallback_only",
    chat_method: provider.chat_method,
    streaming_support: Boolean(provider.supports.streaming),
    tool_calling_support: Boolean(provider.supports.tool_calling),
    vision_support: Boolean(provider.supports.vision),
    embeddings_support: Boolean(provider.supports.embeddings),
    cost_metadata_available: provider.fallback_models.some((entry) => entry.pricing) || hasStaticPricing(provider.provider_id),
    pricing_catalog: {
      version: PRICING_CATALOG_VERSION,
      source: PRICING_CATALOG_SOURCE,
      source_url: STATIC_PRICING_CATALOG[provider.provider_id]?.source_url ?? "",
      dynamic_pricing: Boolean(STATIC_PRICING_CATALOG[provider.provider_id]?.dynamic_pricing),
      stale_after: "2026-06-03",
    },
    docs_url: provider.docs_url,
    models_docs_url: provider.models_docs_url,
    default_model: provider.fallback_models[0]?.model_id ?? "",
    configured,
    enabled: configured,
    key_status: keyRequired ? (configured ? "configured" : "missing") : "not_required",
    key_source: credential.source,
    masked_key: configured ? credential.masked_key : "",
    disabled_reason: configured
      ? ""
      : keyRequired
        ? `Set ${provider.env_keys[0]} or add a BeHeart provider key.`
        : "No API key is required. Start the local model server before testing.",
  };
}

function resolveCredentialWithoutProviderThrow(provider, options = {}) {
  return resolveProviderCredential({
    providerId: provider.provider_id,
    ...options,
  });
}

function createProvider(definition) {
  return Object.freeze({
    ...definition,
    local: Boolean(definition.local),
    requires_api_key: definition.requires_api_key ?? !definition.local,
    base_url_env_keys: definition.base_url_env_keys ?? [],
    env_keys: definition.env_keys ?? [],
    fallback_models: definition.fallback_models.map((entry) => ({
      ...entry,
      provider_id: definition.provider_id,
      label: entry.label ?? entry.model_id,
      pricing: entry.pricing ?? getStaticModelPricing(definition.provider_id, entry.model_id),
      source: FALLBACK_SOURCE,
      fallback: true,
      fallback_manifest_version: FALLBACK_MANIFEST_VERSION,
      refreshed_at: "",
    })),
  });
}

function model(modelId, options = {}) {
  return {
    schema_version: 1,
    model_id: modelId,
    label: options.label ?? modelId,
    capabilities: {
      text: options.text ?? true,
      streaming: options.streaming ?? true,
      tool_calling: options.tool_calling ?? false,
      vision: options.vision ?? false,
      embeddings: options.embeddings ?? false,
      context_length: options.context_length ?? 0,
      max_output_tokens: options.max_output_tokens ?? 0,
    },
    pricing: options.pricing ?? null,
  };
}

function inferModelCapabilities(provider, modelId) {
  const id = String(modelId ?? "").toLowerCase();
  const embeddings = /embed|embedding/.test(id);
  return {
    text: !embeddings,
    streaming: !embeddings && provider.supports.streaming,
    tool_calling: !embeddings && (provider.supports.tool_calling || /tool|function/.test(id)),
    vision: !embeddings && provider.supports.vision && /gpt-4o|gpt-4\.1|gemini|claude|vision|llama-4|multimodal/.test(id),
    embeddings,
    context_length: inferContextLength(id),
    max_output_tokens: 0,
  };
}

function inferContextLength(id) {
  if (/gemini-2\.5|gemini-2\.0/.test(id)) return 1_048_576;
  if (/gpt-4\.1/.test(id)) return 1_047_576;
  if (/gpt-5/.test(id)) return 272_000;
  if (/claude/.test(id)) return 200_000;
  if (/codestral/.test(id)) return 256_000;
  if (/mistral|llama|groq/.test(id)) return 128_000;
  if (/embed|embedding/.test(id)) return 8_192;
  return 0;
}

function localPricing() {
  return {
    input_per_1m: 0,
    output_per_1m: 0,
    currency: "USD",
    source: "local_runtime",
  };
}

function pricing(inputPer1m, outputPer1m, options = {}) {
  return {
    input_per_1m: inputPer1m,
    output_per_1m: outputPer1m,
    cached_input_per_1m: options.cached_input_per_1m ?? null,
    currency: "USD",
    source: PRICING_CATALOG_SOURCE,
    catalog_version: PRICING_CATALOG_VERSION,
    source_url: options.source_url ?? "",
    note: options.note ?? "",
  };
}

function getStaticModelPricing(providerId, modelId) {
  const providerCatalog = STATIC_PRICING_CATALOG[normalizeProviderId(providerId)];
  const modelKey = String(modelId ?? "").replace(/^models\//, "");
  const direct = providerCatalog?.models?.[modelKey];
  if (direct) {
    return {
      ...direct,
      source_url: direct.source_url || providerCatalog.source_url || "",
    };
  }
  if (providerCatalog?.local_runtime) {
    return localPricing();
  }
  return null;
}

function hasStaticPricing(providerId) {
  const catalog = STATIC_PRICING_CATALOG[providerId];
  return Boolean(catalog?.local_runtime || Object.keys(catalog?.models ?? {}).length > 0 || catalog?.dynamic_pricing);
}

function resolvePricingCoverage(providerCatalog = {}, models = {}) {
  if (providerCatalog.local_runtime) {
    return "local_zero_provider_cost";
  }
  if (providerCatalog.dynamic_pricing) {
    return "dynamic_provider_metadata";
  }
  if (providerCatalog.region_variant_pricing) {
    return "region_variant_external";
  }
  if (providerCatalog.external_pricing_page) {
    return "external_pricing_page";
  }
  return Object.keys(models).length > 0 ? "partial_static_overlay" : "unknown";
}

function hasBedrockStaticCredentials(env = process.env) {
  return Boolean(
    normalizeApiKey(env.AWS_ACCESS_KEY_ID ?? env.BE_AI_HEART_BEDROCK_ACCESS_KEY_ID) &&
      normalizeApiKey(env.AWS_SECRET_ACCESS_KEY ?? env.BE_AI_HEART_BEDROCK_SECRET_ACCESS_KEY),
  );
}

function hasBedrockProfile(env = process.env) {
  return Boolean(normalizeApiKey(env.AWS_PROFILE ?? env.BE_AI_HEART_BEDROCK_PROFILE));
}

function normalizePricing(pricing) {
  if (!pricing || typeof pricing !== "object") {
    return null;
  }
  const promptPerToken = toNumberOrNull(pricing.prompt);
  const completionPerToken = toNumberOrNull(pricing.completion);
  return {
    input_per_1m: toNumberOrNull(pricing.input_per_1m ?? pricing.input) ?? (promptPerToken === null ? null : promptPerToken * 1_000_000),
    output_per_1m: toNumberOrNull(pricing.output_per_1m ?? pricing.output) ?? (completionPerToken === null ? null : completionPerToken * 1_000_000),
    currency: String(pricing.currency ?? "USD"),
    source: "provider_dynamic",
  };
}

function sanitizeRawModelMetadata(entry) {
  const sanitized = { ...entry };
  for (const key of Object.keys(sanitized)) {
    if (isSecretKeyName(key)) {
      sanitized[key] = "[redacted]";
    }
  }
  return sanitized;
}

function normalizeApiKey(value) {
  const raw = String(value ?? "").trim();
  return raw.length > 0 && raw.length <= 4096 ? raw : "";
}

function isSecretKeyName(key) {
  return /api[_-]?key|secret|password|^token$|(?:access|refresh|id|session|auth)[_-]?token/i.test(String(key ?? ""));
}

function appendQuery(url, key, value) {
  url.searchParams.set(key, value);
  return url.toString();
}

function buildProviderUrl(baseUrl, requestPath) {
  return new URL(String(requestPath ?? "").replace(/^\/+/, ""), ensureTrailingSlash(baseUrl)).toString();
}

function ensureTrailingSlash(value) {
  const raw = String(value ?? "").trim();
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function statusToErrorCode(status) {
  if (status === 401 || status === 403) return "auth_error";
  if (status === 404) return "model_not_found";
  if (status === 408 || status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "provider_error";
}

function normalizeDiscoveryError(error) {
  return {
    code: error?.code ?? "provider_error",
    message: safeErrorMessage(error),
    status: error?.status ?? error?.details?.status ?? null,
  };
}

function createRegistryError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  if (details.status) {
    error.status = details.status;
  }
  return error;
}

function safeErrorMessage(error) {
  return String(error?.message ?? error ?? "Unknown provider error").replace(/\s+/g, " ").slice(0, 220);
}
