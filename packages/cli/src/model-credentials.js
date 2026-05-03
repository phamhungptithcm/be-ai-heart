import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getProviderDefinition,
  maskSecret,
  normalizeProviderId,
  parseProviderModelSpec,
  redactProviderSecrets,
} from "../../model-registry/src/index.js";

const MODEL_CONFIG_SCHEMA_VERSION = 1;

export function resolveCliModelConfigPath({ explicitPath, env = process.env } = {}) {
  if (explicitPath) {
    return path.resolve(String(explicitPath));
  }

  const configHome = String(env.BEHEART_CONFIG_HOME ?? env.XDG_CONFIG_HOME ?? "").trim();
  const baseRoot = configHome
    ? path.join(configHome, configHome.endsWith("beheart") ? "" : "beheart")
    : path.join(os.homedir(), ".beheart");

  return path.join(baseRoot, "model-credentials.json");
}

export async function loadCliModelConfig({ credentialPath, env = process.env } = {}) {
  const targetPath = resolveCliModelConfigPath({ explicitPath: credentialPath, env });
  const empty = createEmptyModelConfig(targetPath);
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return normalizeCliModelConfig(JSON.parse(raw), targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return empty;
    }
    throw new Error(`Could not read BeHeart model credentials: ${error.message}`);
  }
}

export async function saveCliModelConfig(config, { credentialPath, env = process.env } = {}) {
  const targetPath = resolveCliModelConfigPath({ explicitPath: credentialPath, env });
  const normalized = normalizeCliModelConfig(config, targetPath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  await fs.writeFile(targetPath, `${JSON.stringify(normalized, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(targetPath, 0o600).catch(() => {});
  return redactCliModelConfig(normalized);
}

export async function addCliProviderKey({
  providerId,
  apiKey,
  enabled = true,
  credentialPath,
  env = process.env,
} = {}) {
  const provider = getProviderDefinition(providerId);
  const key = normalizeApiKey(apiKey);
  if (!key) {
    throw new Error("A provider API key is required.");
  }

  const current = await loadCliModelConfig({ credentialPath, env });
  const next = {
    ...current,
    updated_at: new Date().toISOString(),
    credentials: {
      ...(current.credentials ?? {}),
      [provider.provider_id]: {
        provider_id: provider.provider_id,
        api_key: key,
        masked_key: maskSecret(key),
        enabled: enabled !== false,
        source: "local_file",
        saved_at: new Date().toISOString(),
      },
    },
  };
  return saveCliModelConfig(next, { credentialPath, env });
}

export async function deleteCliProviderKey({ providerId, credentialPath, env = process.env } = {}) {
  const safeProviderId = normalizeProviderId(providerId);
  getProviderDefinition(safeProviderId);
  const current = await loadCliModelConfig({ credentialPath, env });
  const credentials = { ...(current.credentials ?? {}) };
  delete credentials[safeProviderId];
  const next = {
    ...current,
    updated_at: new Date().toISOString(),
    credentials,
  };
  return saveCliModelConfig(next, { credentialPath, env });
}

export async function selectCliModel({
  providerId,
  modelId,
  modelSpec,
  credentialPath,
  env = process.env,
} = {}) {
  const parsed = modelSpec
    ? parseProviderModelSpec(modelSpec, providerId)
    : {
        provider_id: normalizeProviderId(providerId),
        model_id: String(modelId ?? "").trim(),
      };
  const provider = getProviderDefinition(parsed.provider_id);
  if (!parsed.model_id) {
    throw new Error("A model id is required.");
  }
  const current = await loadCliModelConfig({ credentialPath, env });
  const next = {
    ...current,
    updated_at: new Date().toISOString(),
    selected: {
      provider_id: provider.provider_id,
      model_id: parsed.model_id,
      selected_at: new Date().toISOString(),
    },
  };
  return saveCliModelConfig(next, { credentialPath, env });
}

export function resolveCliSelectedModel({ config, providerId, modelId, modelSpec } = {}) {
  if (modelSpec) {
    return parseProviderModelSpec(modelSpec, providerId);
  }
  if (providerId || modelId) {
    return {
      provider_id: normalizeProviderId(providerId ?? config?.selected?.provider_id ?? "openai"),
      model_id: String(modelId ?? config?.selected?.model_id ?? "").trim(),
    };
  }
  return {
    provider_id: normalizeProviderId(config?.selected?.provider_id ?? "openai"),
    model_id: String(config?.selected?.model_id ?? ""),
  };
}

export function getCliProviderCredential(config, providerId) {
  const safeProviderId = normalizeProviderId(providerId);
  const credential = config?.credentials?.[safeProviderId];
  return credential?.enabled === false ? null : credential ?? null;
}

export function redactCliModelConfig(config) {
  const redacted = redactProviderSecrets(config);
  for (const credential of Object.values(redacted.credentials ?? {})) {
    if (credential.api_key) {
      credential.api_key = "[redacted]";
    }
  }
  return redacted;
}

function normalizeCliModelConfig(config, credentialPath) {
  const credentials = {};
  for (const [providerId, credential] of Object.entries(config?.credentials ?? {})) {
    const safeProviderId = normalizeProviderId(providerId || credential?.provider_id);
    if (!safeProviderId) {
      continue;
    }
    credentials[safeProviderId] = {
      provider_id: safeProviderId,
      api_key: normalizeApiKey(credential?.api_key),
      masked_key: credential?.masked_key || maskSecret(credential?.api_key),
      enabled: credential?.enabled !== false,
      source: credential?.source ?? "local_file",
      saved_at: String(credential?.saved_at ?? ""),
    };
  }
  const selectedProviderId = normalizeProviderId(config?.selected?.provider_id ?? "");
  const selectedModelId = String(config?.selected?.model_id ?? "").trim();
  return {
    schema_version: MODEL_CONFIG_SCHEMA_VERSION,
    credential_path: credentialPath,
    selected: selectedProviderId && selectedModelId
      ? {
          provider_id: selectedProviderId,
          model_id: selectedModelId,
          selected_at: String(config?.selected?.selected_at ?? ""),
        }
      : null,
    credentials,
    updated_at: String(config?.updated_at ?? ""),
    security: {
      storage: "local_file_0600",
      note:
        "Provider keys are stored only on this machine with user-only file permissions. Prefer env vars or an OS keychain for shared machines.",
    },
  };
}

function createEmptyModelConfig(credentialPath) {
  return {
    schema_version: MODEL_CONFIG_SCHEMA_VERSION,
    credential_path: credentialPath,
    selected: null,
    credentials: {},
    updated_at: "",
    security: {
      storage: "local_file_0600",
      note:
        "Provider keys are stored only on this machine with user-only file permissions. Prefer env vars or an OS keychain for shared machines.",
    },
  };
}

function normalizeApiKey(value) {
  const raw = String(value ?? "").trim();
  return raw.length > 0 && raw.length <= 4096 ? raw : "";
}
