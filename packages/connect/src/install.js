import fs from "node:fs/promises";

import { buildInstallPlan } from "./planner.js";
import {
  MANAGED_CONTINUE_CONFIG_HEADER,
  resolveContinueManagedConfigPath,
} from "./agent-adapters/continue.js";
import { readJsonFile, writeJsonFile, writeTextFile } from "./filesystem.js";

function defaultExecFileImpl() {
  return Promise.resolve({ stdout: "", stderr: "" });
}

function createContinueManagedConfig(model) {
  if (model === "ollama") {
    return `${MANAGED_CONTINUE_CONFIG_HEADER}
version: 1
models:
  - name: qwen3.5-coder:latest
    provider: ollama
    model: qwen3.5-coder:latest
`;
  }

  if (model === "lm-studio") {
    return `${MANAGED_CONTINUE_CONFIG_HEADER}
version: 1
models:
  - name: qwen3.5-coder:latest
    provider: lm-studio
    model: qwen3.5-coder:latest
`;
  }

  throw new Error(`Unsupported Continue model runtime: ${model}`);
}

async function installCursor(plan) {
  const targetPath = plan.target_file;
  const existingPayload = (await readJsonFile(targetPath)) ?? { mcpServers: {} };
  const payload = {
    ...existingPayload,
    mcpServers: {
      ...(existingPayload.mcpServers ?? {}),
      "heart-mcp": plan.mcp_entry,
    },
  };

  await writeJsonFile(targetPath, payload);
}

async function installClaudeCode(plan, execFileImpl) {
  const command = plan.exec?.command ?? plan.command;
  const args = plan.exec?.args ?? plan.args;
  await execFileImpl(command, args);
}

async function maybeWriteContinueManagedConfig({ env, model }) {
  if (!model) {
    return [];
  }

  const configPath = resolveContinueManagedConfigPath(env);
  if (!configPath) {
    return ["Continue managed config path could not be resolved."];
  }

  let existingText = null;
  try {
    existingText = await fs.readFile(configPath, "utf8");
  } catch {
    existingText = null;
  }

  if (
    existingText !== null &&
    !existingText.startsWith(MANAGED_CONTINUE_CONFIG_HEADER)
  ) {
    return [
      "Continue user config already exists and is not BeHeart-managed; skipping managed model config.",
    ];
  }

  await writeTextFile(configPath, createContinueManagedConfig(model));
  return [];
}

async function installContinue(plan, { env, model }) {
  await writeJsonFile(plan.target_file, plan.mcp_entry);
  if (plan.scope !== "user") {
    return [];
  }

  return maybeWriteContinueManagedConfig({ env, model });
}

export async function installConnection({
  client,
  scope,
  repoRoot,
  env = process.env,
  model = null,
  execFileImpl = defaultExecFileImpl,
  verifyImpl,
} = {}) {
  const plan = await buildInstallPlan({
    client,
    scope,
    repoRoot,
    env,
    modelRuntime: model,
  });
  let warnings = [...(plan.warnings ?? [])];

  if (plan.client === "cursor") {
    await installCursor(plan);
  } else if (plan.client === "claude-code") {
    await installClaudeCode(plan, execFileImpl);
  } else if (plan.client === "continue") {
    warnings = warnings.concat(await installContinue(plan, { env, model }));
  } else {
    throw new Error(`Unsupported install client: ${plan.client}`);
  }

  const verification = verifyImpl
    ? await verifyImpl(plan)
    : { status: "ready", warnings: [] };

  return {
    ...verification,
    warnings: [...(verification.warnings ?? []), ...warnings],
    client,
    scope,
    plan,
  };
}
