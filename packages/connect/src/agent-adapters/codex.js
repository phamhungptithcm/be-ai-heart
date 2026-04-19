import path from "node:path";
import fs from "node:fs/promises";

import { fileExists } from "../filesystem.js";
import { resolveHeartCliPath } from "../heart-cli-path.js";
import { matchesMcpRemoteUrl } from "../mcp-transport.js";

const HEART_MCP_ID = "heart-mcp";

function missingExecFile() {
  const error = new Error("Command not found");
  error.code = "ENOENT";
  throw error;
}

function resolveHomeRoot(env = process.env) {
  return env.HOME || env.USERPROFILE || "";
}

function resolveCodexConfigLocations({ env = process.env } = {}) {
  const homeRoot = resolveHomeRoot(env);

  return {
    user: homeRoot ? path.join(homeRoot, ".codex", "config.toml") : null,
  };
}

function buildHeartMcpEntry(repoRoot, remoteUrl = null) {
  if (remoteUrl) {
    return {
      type: "http",
      url: remoteUrl,
    };
  }

  return {
    command: "node",
    args: [
      resolveHeartCliPath(),
      "mcp",
      "serve",
      "--root",
      repoRoot,
    ],
  };
}

function hasHeartCodexEntry(entries, { repoRoot, remoteUrl } = {}) {
  if (!Array.isArray(entries)) {
    return false;
  }

  return entries.some((entry) => {
    if (entry?.name !== HEART_MCP_ID) {
      return false;
    }

    if (matchesMcpRemoteUrl(entry, remoteUrl)) {
      return true;
    }

    if (entry?.transport?.type !== "stdio") {
      return false;
    }

    const args = Array.isArray(entry.transport.args) ? entry.transport.args : [];
    const rootFlagIndex = args.lastIndexOf("--root");
    return rootFlagIndex !== -1 && args[rootFlagIndex + 1] === repoRoot;
  });
}

async function readCodexConfigText(configPath) {
  if (!configPath) {
    return "";
  }

  try {
    return await fs.readFile(configPath, "utf8");
  } catch {
    return "";
  }
}

function hasHeartCodexConfigText(configText, { repoRoot, remoteUrl } = {}) {
  if (!configText.includes("[mcp_servers.heart-mcp]")) {
    return false;
  }

  if (remoteUrl && configText.includes(`"${remoteUrl}"`)) {
    return true;
  }

  return Boolean(repoRoot) && configText.includes(`"${repoRoot}"`);
}

export async function detectCodex({
  repoRoot,
  remoteUrl = null,
  env = process.env,
  execFileImpl = missingExecFile,
} = {}) {
  const configLocations = resolveCodexConfigLocations({ env });
  let detectedFromCli = false;
  let configured = false;

  try {
    const result = await execFileImpl("codex", ["mcp", "list", "--json"]);
    const payload = JSON.parse(typeof result?.stdout === "string" ? result.stdout : "[]");
    detectedFromCli = true;
    configured = hasHeartCodexEntry(payload, { repoRoot, remoteUrl });
  } catch {
    const configText = await readCodexConfigText(configLocations.user);
    configured = hasHeartCodexConfigText(configText, { repoRoot, remoteUrl });
  }

  return {
    id: "codex",
    display_name: "Codex",
    supports_mcp: true,
    supports_model_override: false,
    install_modes: ["user"],
    config_locations: configLocations,
    detected: detectedFromCli || configured,
    configured,
    discovery_confidence: detectedFromCli ? "high" : configured ? "medium" : "low",
    warnings: [],
  };
}

export async function buildCodexInstallPlan({
  repoRoot,
  scope,
  env = process.env,
  modelRuntime = null,
  remoteUrl = null,
} = {}) {
  if (scope !== "user") {
    throw new Error("Codex install currently supports user scope only.");
  }

  const configLocations = resolveCodexConfigLocations({ env });
  if (!configLocations.user) {
    throw new Error(
      "Cannot resolve user home path for Codex install. Set HOME or USERPROFILE.",
    );
  }

  const warnings = [];
  if (modelRuntime) {
    warnings.push(
      `Model binding '${modelRuntime}' was ignored for codex because this client does not support model override.`,
    );
  }

  const existingTarget = await fileExists(configLocations.user);
  const mcpEntry = buildHeartMcpEntry(repoRoot, remoteUrl);

  return {
    client: "codex",
    scope,
    repo_root: repoRoot,
    target_file: configLocations.user,
    config_locations: configLocations,
    mcp_entry: mcpEntry,
    model_binding: null,
    files_to_backup: existingTarget ? [configLocations.user] : [],
    files_to_modify: [configLocations.user],
    warnings,
    actions: [remoteUrl ? "run-codex-mcp-add-http" : "run-codex-mcp-add"],
    exec: {
      command: "codex",
      args: remoteUrl
        ? ["mcp", "add", HEART_MCP_ID, "--url", remoteUrl]
        : ["mcp", "add", HEART_MCP_ID, "--", mcpEntry.command, ...mcpEntry.args],
    },
  };
}
