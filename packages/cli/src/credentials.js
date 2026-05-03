import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CREDENTIAL_SCHEMA_VERSION = 1;

export function resolveCredentialPath({ explicitPath, env = process.env } = {}) {
  if (explicitPath) {
    return path.resolve(String(explicitPath));
  }

  const configHome = String(env.BEHEART_CONFIG_HOME ?? env.XDG_CONFIG_HOME ?? "").trim();
  const baseRoot = configHome
    ? path.join(configHome, configHome.endsWith("beheart") ? "" : "beheart")
    : path.join(os.homedir(), ".beheart");

  return path.join(baseRoot, "credentials.json");
}

export async function saveCliCredentials({
  apiUrl,
  apiKey,
  actor,
  workspace,
  credentialPath,
  env = process.env,
} = {}) {
  const targetPath = resolveCredentialPath({ explicitPath: credentialPath, env });
  const payload = {
    schema_version: CREDENTIAL_SCHEMA_VERSION,
    api_url: normalizeBaseUrl(apiUrl),
    api_key: normalizeApiKey(apiKey),
    actor_slug: actor?.actor_slug ?? "",
    workspace_slug: workspace?.workspace_slug ?? "",
    saved_at: new Date().toISOString(),
  };

  if (!payload.api_url || !payload.api_key) {
    throw new Error("API URL and API key are required.");
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(targetPath, 0o600).catch(() => {});

  return {
    credential_path: targetPath,
    api_url: payload.api_url,
    actor_slug: payload.actor_slug,
    workspace_slug: payload.workspace_slug,
    saved_at: payload.saved_at,
  };
}

export async function loadCliCredentials({ credentialPath, env = process.env } = {}) {
  const targetPath = resolveCredentialPath({ explicitPath: credentialPath, env });
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    const payload = JSON.parse(raw);
    const apiUrl = normalizeBaseUrl(payload.api_url);
    const apiKey = normalizeApiKey(payload.api_key);
    if (!apiUrl || !apiKey) {
      return null;
    }

    return {
      credential_path: targetPath,
      api_url: apiUrl,
      api_key: apiKey,
      actor_slug: String(payload.actor_slug ?? ""),
      workspace_slug: String(payload.workspace_slug ?? ""),
      saved_at: String(payload.saved_at ?? ""),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw new Error(`Could not read BeHeart credentials: ${error.message}`);
  }
}

export async function deleteCliCredentials({ credentialPath, env = process.env } = {}) {
  const targetPath = resolveCredentialPath({ explicitPath: credentialPath, env });
  await fs.rm(targetPath, { force: true });
  return {
    credential_path: targetPath,
  };
}

export function redactSecret(value) {
  const secret = String(value ?? "").trim();
  if (!secret) {
    return "";
  }
  if (secret.length <= 8) {
    return "[redacted]";
  }

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function normalizeApiKey(value) {
  const raw = String(value ?? "").trim();
  return raw.length > 0 && raw.length <= 512 ? raw : "";
}
