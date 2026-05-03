import test from "node:test";
import assert from "node:assert/strict";

import {
  createProviderValidationPlan,
  getModelPricing,
  getPricingCatalog,
  listProviderModels,
  listProviders,
  redactProviderSecrets,
  resolveProviderCredential,
} from "../packages/model-registry/src/index.js";

test("model registry lists provider metadata without requiring keys", () => {
  const providers = listProviders({ env: {} });
  const providerIds = providers.map((provider) => provider.provider_id);

  assert.ok(providerIds.includes("openai"));
  assert.ok(providerIds.includes("anthropic"));
  assert.ok(providerIds.includes("gemini"));
  assert.equal(providers.find((provider) => provider.provider_id === "openai").configured, false);
  assert.equal(providers.find((provider) => provider.provider_id === "ollama").key_status, "not_required");
  assert.equal(providers.find((provider) => provider.provider_id === "openai").model_list_method, "dynamic_api");
});

test("model registry uses versioned fallback when no key exists", async () => {
  const result = await listProviderModels({ providerId: "openai", env: {}, dynamic: true });

  assert.equal(result.source, "versioned_fallback");
  assert.equal(result.fallback_manifest_version, "2026-05-03");
  assert.ok(result.models.length >= 1);
  assert.ok(result.warnings[0].includes("No API key"));
  assert.equal(result.models.find((model) => model.model_id === "gpt-5.1").pricing.input_per_1m, 1.25);
});

test("model registry dynamically discovers OpenAI models with a provider key", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ data: [{ id: "gpt-test", context_length: 128000 }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await listProviderModels({
    providerId: "openai",
    credential: { api_key: "sk-test-dynamic-key" },
    env: {},
    fetchImpl,
  });

  assert.equal(result.source, "dynamic");
  assert.equal(result.models[0].model_id, "gpt-test");
  assert.equal(calls[0].url, "https://api.openai.com/v1/models");
  assert.equal(calls[0].options.headers.Authorization, "Bearer sk-test-dynamic-key");
});

test("model registry dynamically discovers local Ollama models without an API key", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ models: [{ name: "llama3.2:latest" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await listProviderModels({
    providerId: "ollama",
    env: {},
    fetchImpl,
  });

  assert.equal(result.source, "dynamic");
  assert.equal(result.models[0].model_id, "llama3.2:latest");
  assert.equal(calls[0].url, "http://127.0.0.1:11434/api/tags");
  assert.deepEqual(calls[0].options.headers, {});
});

test("model registry normalizes OpenRouter per-token pricing into per-million metadata", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    data: [{
      id: "openai/gpt-test",
      pricing: { prompt: "0.000001", completion: "0.000002" },
    }],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  const result = await listProviderModels({
    providerId: "openrouter",
    credential: { api_key: "sk-or-test" },
    env: {},
    fetchImpl,
  });

  assert.equal(result.models[0].pricing.input_per_1m, 1);
  assert.equal(result.models[0].pricing.output_per_1m, 2);
});

test("provider credentials resolve env fallback and redact secrets", () => {
  const credential = resolveProviderCredential({
    providerId: "anthropic",
    env: { ANTHROPIC_API_KEY: "sk-ant-secret-value" },
  });

  assert.equal(credential.source, "environment");
  assert.equal(credential.masked_key, "sk-a...alue");
  assert.deepEqual(redactProviderSecrets({ api_key: "sk-secret-value-12345", nested: { password: "pw" } }), {
    api_key: "[redacted]",
    nested: { password: "[redacted]" },
  });
  assert.equal(redactProviderSecrets("AKIAIOSFODNN7EXAMPLE aws_secret_access_key=super-secret"), "[redacted] secret_access_key=[redacted]");
});

test("model registry exposes versioned pricing catalog overlay", () => {
  const catalog = getPricingCatalog({ providerId: "groq" });
  const pricing = getModelPricing({ providerId: "openai", modelId: "gpt-5.1" });

  assert.equal(catalog.catalog_version, "2026-05-03");
  assert.equal(catalog.governance.status, "partial_overlay");
  assert.equal(catalog.providers.groq.model_count >= 1, true);
  assert.equal(catalog.providers.groq.coverage, "partial_static_overlay");
  assert.equal(pricing.source, "versioned_static_catalog");
  assert.equal(pricing.input_per_1m, 1.25);
});

test("provider validation plan separates real-key, local-runtime, and Bedrock boundaries", () => {
  const plan = createProviderValidationPlan({
    env: { OPENAI_API_KEY: "sk-test-live-ready" },
    credentialState: {},
  });
  const byProvider = Object.fromEntries(plan.providers.map((provider) => [provider.provider_id, provider]));

  assert.equal(byProvider.openai.status, "ready_for_live_test");
  assert.equal(byProvider.anthropic.status, "needs_provider_key");
  assert.equal(byProvider.ollama.status, "needs_local_runtime");
  assert.equal(byProvider.lmstudio.status, "needs_local_runtime");
  assert.equal(byProvider.bedrock.status, "needs_aws_credentials");
});

test("provider validation plan marks Bedrock ready when signable AWS env credentials exist", () => {
  const plan = createProviderValidationPlan({
    env: {
      AWS_ACCESS_KEY_ID: "AKIABEDROCKTEST",
      AWS_SECRET_ACCESS_KEY: "bedrock-secret",
      AWS_REGION: "us-west-2",
    },
    credentialState: {},
  });
  const bedrock = plan.providers.find((provider) => provider.provider_id === "bedrock");

  assert.equal(bedrock.status, "ready_for_live_test");
  assert.equal(bedrock.validation_method, "aws_sigv4_model_discovery_api");
  assert.equal(bedrock.command, "heart models test --provider bedrock --json");
});

test("provider validation plan marks Bedrock AWS profiles ready for local resolution", () => {
  const plan = createProviderValidationPlan({
    env: {
      AWS_PROFILE: "bedrock-role",
    },
    credentialState: {},
  });
  const bedrock = plan.providers.find((provider) => provider.provider_id === "bedrock");

  assert.equal(bedrock.status, "ready_for_live_test");
  assert.match(bedrock.note, /static AWS profiles and source_profile assume-role/);
});
