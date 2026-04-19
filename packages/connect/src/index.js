import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HEART_SERVER_NAME = "heart-mcp";
const MCP_PROTOCOL_VERSION = "2025-06-18";
const MODEL_ENDPOINTS = Object.freeze({
  ollama: "http://127.0.0.1:11434",
  lmStudio: "http://127.0.0.1:1234",
});
const CONNECT_TIMEOUT_MS = 4_000;
const HEART_CLI_BIN = fileURLToPath(new URL("../../cli/bin/heart.js", import.meta.url));

const SUPPORTED_AGENTS = Object.freeze([
  {
    id: "cursor",
    display_name: "Cursor",
    supports_mcp: true,
    supports_model_override: false,
    install_modes: ["repo", "user"],
    repo_config_locations: [".cursor/mcp.json"],
    user_config_locations: [".cursor/mcp.json"],
    config_shape: "json-mcpServers",
  },
  {
    id: "codex",
    display_name: "Codex",
    supports_mcp: true,
    supports_model_override: false,
    install_modes: ["repo", "user"],
    repo_config_locations: [".codex/config.json"],
    user_config_locations: [".codex/config.json"],
    config_shape: "json-mcpServers",
  },
  {
    id: "claude-desktop",
    display_name: "Claude Desktop",
    supports_mcp: true,
    supports_model_override: false,
    install_modes: ["user"],
    repo_config_locations: [],
    user_config_locations: [
      "Library/Application Support/Claude/claude_desktop_config.json",
      ".config/Claude/claude_desktop_config.json",
      "AppData/Roaming/Claude/claude_desktop_config.json",
    ],
    config_shape: "json-mcpServers",
  },
]);

export async function detectConnections({
  repoRoot = "",
  env = process.env,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  detectAgentsImpl,
  detectModelsImpl,
} = {}) {
  const safeRepoRoot = String(repoRoot ?? "").trim();
  const agents = await resolveDetectedItems(
    detectAgentsImpl,
    async () => detectAgentHosts({ repoRoot: safeRepoRoot, env }),
  );
  const models = await resolveDetectedItems(
    detectModelsImpl,
    async () => detectModelRuntimes({ fetchImpl }),
  );
  const recommendations = buildRecommendations({
    repoRoot: safeRepoRoot,
    agents,
    models,
  });

  return {
    repo_root: safeRepoRoot,
    agents: [...agents].sort((left, right) => left.id.localeCompare(right.id)),
    models: [...models].sort((left, right) => left.id.localeCompare(right.id)),
    warnings: [],
    recommendations,
  };
}

export async function doctorConnections({
  repoRoot = "",
  env = process.env,
  binaryPath = process.argv[1] ?? null,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  detectAgentsImpl,
  detectModelsImpl,
} = {}) {
  const inventory = await detectConnections({
    repoRoot,
    env,
    fetchImpl,
    detectAgentsImpl,
    detectModelsImpl,
  });
  const actions = [];

  if (inventory.agents.length === 0) {
    actions.push(`No supported agent host config was detected under ${resolveHomeRoot(env) ?? "<unknown-home>"}.`);
    actions.push(`Run heart connect install --client cursor --scope repo --root ${repoRoot}`);
  } else if (!inventory.agents.some((agent) => agent.configured)) {
    actions.push("Detected agent hosts are not yet configured for heart-mcp.");
    actions.push(`Run heart connect install --client ${inventory.agents[0].id} --scope ${inventory.agents[0].scope ?? "user"} --root ${repoRoot}`);
  } else {
    actions.push(`Run heart connect verify --client ${inventory.agents.find((agent) => agent.configured)?.id ?? inventory.agents[0].id} --root ${repoRoot}`);
  }

  if (inventory.models.length > 0) {
    actions.push(`Detected ${inventory.models.length} local model runtime${inventory.models.length === 1 ? "" : "s"} ready for advisory use.`);
  }

  return {
    repo_root: String(repoRoot ?? "").trim(),
    heart_binary: {
      command: "heart",
      resolved_path: binaryPath,
      available: Boolean(binaryPath),
    },
    inventory,
    warnings: [],
    actions,
  };
}

export async function buildInstallPlan({
  client,
  scope = "repo",
  repoRoot = "",
  env = process.env,
  modelRuntime = null,
} = {}) {
  const adapter = getAgentAdapter(client);
  const normalizedScope = normalizeInstallScope(scope, adapter);
  const configPath = resolveAgentConfigPath({
    adapter,
    scope: normalizedScope,
    repoRoot,
    env,
  });
  const mcpEntry = createMcpEntry(repoRoot);
  const warnings = [];
  const actions = [
    `Write ${HEART_SERVER_NAME} into ${configPath}`,
  ];

  if (modelRuntime && adapter.supports_model_override !== true) {
    warnings.push(`${adapter.display_name} does not expose a supported model override surface in this version.`);
  }

  return {
    client: adapter.id,
    scope: normalizedScope,
    repo_root: String(repoRoot ?? "").trim(),
    config_path: configPath,
    mcp_entry: mcpEntry,
    model_binding:
      modelRuntime && adapter.supports_model_override === true
        ? {
            runtime: modelRuntime,
          }
        : null,
    files_to_backup: (await fileExists(configPath)) ? [configPath] : [],
    files_to_modify: [configPath],
    warnings,
    actions,
  };
}

export async function installConnection({
  client,
  scope = "repo",
  repoRoot = "",
  env = process.env,
  model = null,
  backup = false,
  plan = null,
  verifyImpl,
} = {}) {
  const installPlan =
    plan ??
    (await buildInstallPlan({
      client,
      scope,
      repoRoot,
      env,
      modelRuntime: model,
    }));
  const previousExists = await fileExists(installPlan.config_path);
  const previousRaw = previousExists ? await fs.readFile(installPlan.config_path, "utf8") : null;
  const backupPath = previousExists && backup ? await createBackupFile(installPlan.config_path, previousRaw) : null;

  try {
    const currentConfig = previousRaw ? parseAgentConfig(previousRaw, installPlan.config_path) : createEmptyAgentConfig();
    currentConfig.mcpServers[HEART_SERVER_NAME] = {
      command: installPlan.mcp_entry.command,
      args: installPlan.mcp_entry.args,
    };

    await writeConfigAtomically(installPlan.config_path, currentConfig);
    const verification =
      typeof verifyImpl === "function"
        ? await verifyImpl(installPlan)
        : await verifyConnection({
            client: installPlan.client,
            repoRoot: installPlan.repo_root,
            env,
            plan: installPlan,
          });

    if (verification.status !== "ready") {
      await restorePreviousConfig({
        configPath: installPlan.config_path,
        previousRaw,
        previousExists,
      });
      return {
        status: "failed",
        plan: installPlan,
        backup_path: backupPath,
        verification,
      };
    }

    return {
      status: "ready",
      plan: installPlan,
      backup_path: backupPath,
      verification,
    };
  } catch (error) {
    await restorePreviousConfig({
      configPath: installPlan.config_path,
      previousRaw,
      previousExists,
    });
    throw error;
  }
}

export async function verifyConnection({
  client,
  repoRoot = "",
  env = process.env,
  plan = null,
  timeoutMs = CONNECT_TIMEOUT_MS,
} = {}) {
  const verificationPlan =
    plan ??
    (await buildInstallPlan({
      client,
      scope: "repo",
      repoRoot,
      env,
    }));

  const result = {
    client: verificationPlan.client,
    repo_root: verificationPlan.repo_root,
    config_path: verificationPlan.config_path,
    config_status: "missing",
    spawn_status: "pending",
    initialize_status: "pending",
    tools_list_status: "pending",
    model_runtime_status: verificationPlan.model_binding ? "pending" : "not_requested",
    warnings: [],
    status: "failed",
  };

  if (!(await fileExists(verificationPlan.config_path))) {
    result.warnings.push(`Config file not found: ${verificationPlan.config_path}`);
    return result;
  }

  const rawConfig = await fs.readFile(verificationPlan.config_path, "utf8");
  const config = parseAgentConfig(rawConfig, verificationPlan.config_path);
  const entry = config.mcpServers?.[HEART_SERVER_NAME];
  if (!entry) {
    result.config_status = "missing_entry";
    result.warnings.push(`${HEART_SERVER_NAME} is not configured in ${verificationPlan.config_path}`);
    return result;
  }

  result.config_status = "configured";

  const child = spawn(entry.command, entry.args ?? [], {
    cwd: verificationPlan.repo_root || process.cwd(),
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const output = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  });
  const iterator = output[Symbol.asyncIterator]();

  try {
    result.spawn_status = "ready";
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: "heart-connect-verify",
            version: "0.1.0",
          },
        },
      })}\n`,
    );
    const initializeResponse = await nextMessage(iterator, timeoutMs);
    if (initializeResponse?.result?.protocolVersion !== MCP_PROTOCOL_VERSION) {
      throw new Error("Unexpected initialize response from MCP server.");
    }

    result.initialize_status = "ready";
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
    const toolsResponse = await nextMessage(iterator, timeoutMs);
    const toolNames = Array.isArray(toolsResponse?.result?.tools)
      ? toolsResponse.result.tools.map((tool) => tool.name)
      : [];

    if (toolNames.length === 0) {
      throw new Error("tools/list returned no tools.");
    }

    result.tools_list_status = "ready";
    result.available_tools = toolNames;
    result.status = "ready";
    return result;
  } catch (error) {
    if (result.spawn_status === "pending") {
      result.spawn_status = "failed";
    } else if (result.initialize_status === "pending") {
      result.initialize_status = "failed";
    } else {
      result.tools_list_status = "failed";
    }
    result.warnings.push(String(error?.message ?? error));
    return result;
  } finally {
    output.close();
    child.kill();
  }
}

async function detectAgentHosts({ repoRoot, env }) {
  const homeRoot = resolveHomeRoot(env);
  const detectedAgents = [];

  for (const adapter of SUPPORTED_AGENTS) {
    const scopeCandidates = [
      ...adapter.repo_config_locations.map((relativePath) => ({
        scope: "repo",
        configPath: path.join(repoRoot, relativePath),
      })),
      ...adapter.user_config_locations
        .filter(() => Boolean(homeRoot))
        .map((relativePath) => ({
          scope: "user",
          configPath: path.join(homeRoot, relativePath),
        })),
    ];

    for (const candidate of scopeCandidates) {
      if (!(await fileExists(candidate.configPath))) {
        continue;
      }

      const content = await readFileSafe(candidate.configPath);
      const configured = detectHeartServerEntry(content);
      detectedAgents.push({
        id: adapter.id,
        display_name: adapter.display_name,
        supports_mcp: adapter.supports_mcp,
        supports_model_override: adapter.supports_model_override,
        install_modes: [...adapter.install_modes],
        config_path: candidate.configPath,
        scope: candidate.scope,
        detected: true,
        configured,
        discovery_confidence: "high",
        warnings: [],
      });
      break;
    }
  }

  return detectedAgents;
}

async function detectModelRuntimes({ fetchImpl }) {
  if (typeof fetchImpl !== "function") {
    return [];
  }

  const results = [];
  const ollama = await detectOllama(fetchImpl);
  if (ollama) {
    results.push(ollama);
  }

  const lmStudio = await detectLmStudio(fetchImpl);
  if (lmStudio) {
    results.push(lmStudio);
  }

  return results;
}

async function detectOllama(fetchImpl) {
  try {
    const [tagsResponse, runningResponse] = await Promise.all([
      fetchImpl(`${MODEL_ENDPOINTS.ollama}/api/tags`),
      fetchImpl(`${MODEL_ENDPOINTS.ollama}/api/ps`).catch(() => null),
    ]);

    if (!tagsResponse?.ok) {
      return null;
    }

    const tagsPayload = await tagsResponse.json();
    const runningPayload = runningResponse?.ok ? await runningResponse.json() : { models: [] };
    const modelsDetected = [...new Set((tagsPayload.models ?? []).map((model) => model.name ?? model.model).filter(Boolean))];

    return {
      id: "ollama",
      display_name: "Ollama",
      transport: "http",
      endpoint: `${MODEL_ENDPOINTS.ollama}/api`,
      installed: true,
      running: Array.isArray(runningPayload.models) ? runningPayload.models.length > 0 : true,
      models_detected: modelsDetected,
      auth_required: false,
      discovery_confidence: "high",
      warnings: [],
    };
  } catch {
    return null;
  }
}

async function detectLmStudio(fetchImpl) {
  try {
    const response = await fetchImpl(`${MODEL_ENDPOINTS.lmStudio}/v1/models`);
    if (!response?.ok) {
      return null;
    }

    const payload = await response.json();
    const modelsDetected = [...new Set((payload.data ?? []).map((model) => model.id).filter(Boolean))];

    return {
      id: "lm-studio",
      display_name: "LM Studio",
      transport: "http",
      endpoint: `${MODEL_ENDPOINTS.lmStudio}/v1`,
      installed: true,
      running: true,
      models_detected: modelsDetected,
      auth_required: false,
      discovery_confidence: "high",
      warnings: [],
    };
  } catch {
    return null;
  }
}

async function resolveDetectedItems(explicitDetector, defaultDetector) {
  const detector = typeof explicitDetector === "function" ? explicitDetector : defaultDetector;
  if (typeof detector !== "function") {
    return [];
  }

  const result = await detector();
  return Array.isArray(result) ? result : [];
}

function getAgentAdapter(client) {
  const adapter = SUPPORTED_AGENTS.find((entry) => entry.id === client);
  if (!adapter) {
    throw new Error(`Unsupported connect client: ${client}`);
  }

  return adapter;
}

function normalizeInstallScope(scope, adapter) {
  const normalizedScope = String(scope ?? "repo").trim().toLowerCase();
  if (!adapter.install_modes.includes(normalizedScope)) {
    throw new Error(`${adapter.display_name} does not support ${normalizedScope} scope.`);
  }

  return normalizedScope;
}

function resolveAgentConfigPath({ adapter, scope, repoRoot, env }) {
  if (scope === "repo") {
    const relativePath = adapter.repo_config_locations[0];
    if (!relativePath) {
      throw new Error(`${adapter.display_name} does not support repo-scoped configuration.`);
    }

    return path.join(repoRoot, relativePath);
  }

  const homeRoot = resolveHomeRoot(env);
  if (!homeRoot) {
    throw new Error(`Cannot resolve home directory for ${adapter.display_name} user-scoped configuration.`);
  }

  const relativePath = adapter.user_config_locations[0];
  return path.join(homeRoot, relativePath);
}

function createMcpEntry(repoRoot) {
  return {
    command: "node",
    args: [HEART_CLI_BIN, "mcp", "serve", "--root", repoRoot],
  };
}

function buildRecommendations({ repoRoot, agents, models }) {
  if (agents.length === 0) {
    return [`heart connect install --client cursor --scope repo --root ${repoRoot}`];
  }

  const configuredAgent = agents.find((agent) => agent.configured);
  if (configuredAgent) {
    return [`heart connect verify --client ${configuredAgent.id} --root ${repoRoot}`];
  }

  const firstAgent = agents[0];
  const installRecommendation = `heart connect install --client ${firstAgent.id} --scope ${firstAgent.scope ?? "user"} --root ${repoRoot}`;
  if (models.length === 0) {
    return [installRecommendation];
  }

  return [installRecommendation, `Detected ${models.length} local model runtime${models.length === 1 ? "" : "s"} for advisory use.`];
}

function detectHeartServerEntry(content) {
  if (typeof content !== "string") {
    return false;
  }

  try {
    const config = JSON.parse(content);
    return Boolean(config?.mcpServers?.[HEART_SERVER_NAME]);
  } catch {
    return /heart(\.js)?["\s,]+mcp["\s,]+serve/u.test(content);
  }
}

function createEmptyAgentConfig() {
  return {
    mcpServers: {},
  };
}

function parseAgentConfig(raw, configPath) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Config must be a JSON object.");
    }

    return {
      ...parsed,
      mcpServers:
        parsed.mcpServers && typeof parsed.mcpServers === "object" && !Array.isArray(parsed.mcpServers)
          ? { ...parsed.mcpServers }
          : {},
    };
  } catch (error) {
    throw new Error(`Failed to parse ${configPath}: ${error.message}`);
  }
}

async function writeConfigAtomically(configPath, payload) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const tempPath = `${configPath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;

  try {
    await fs.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, configPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => null);
    throw error;
  }
}

async function createBackupFile(configPath, raw) {
  const backupPath = `${configPath}.${Date.now()}.bak`;
  await fs.writeFile(backupPath, raw, "utf8");
  return backupPath;
}

async function restorePreviousConfig({ configPath, previousRaw, previousExists }) {
  if (previousExists && typeof previousRaw === "string") {
    await fs.writeFile(configPath, previousRaw, "utf8");
    return;
  }

  await fs.rm(configPath, { force: true }).catch(() => null);
}

function resolveHomeRoot(env = {}) {
  return env.HOME || env.USERPROFILE || null;
}

async function nextMessage(iterator, timeoutMs) {
  const timeout = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for MCP server response."));
    }, timeoutMs);
    timer.unref?.();
  });
  const nextLine = iterator.next().then((result) => {
    if (result.done) {
      throw new Error("MCP server closed stdout before completing verification.");
    }

    return JSON.parse(result.value);
  });

  return await Promise.race([nextLine, timeout]);
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readFileSafe(targetPath) {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}
