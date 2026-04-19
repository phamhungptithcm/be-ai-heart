import fs from "node:fs/promises";

import { buildInstallPlan } from "./planner.js";
import {
  createContinueManagedConfig,
  inspectContinueManagedConfig,
} from "./agent-adapters/continue.js";
import { writeJsonFile, writeTextFile } from "./filesystem.js";

function defaultExecFileImpl() {
  return Promise.resolve({ stdout: "", stderr: "" });
}

async function readExistingJsonFile(filePath, label) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return {
      exists: true,
      payload: JSON.parse(content),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        exists: false,
        payload: null,
      };
    }

    if (error instanceof SyntaxError) {
      throw new Error(
        `Cannot install because existing ${label} contains invalid JSON at ${filePath}.`,
      );
    }

    throw error;
  }
}

async function installCursor(plan) {
  const targetPath = plan.target_file;
  const { payload } = targetPath
    ? await readExistingJsonFile(targetPath, "Cursor config")
    : { payload: null };
  const existingPayload = payload ?? { mcpServers: {} };
  const nextPayload = {
    ...existingPayload,
    mcpServers: {
      ...(existingPayload.mcpServers ?? {}),
      "heart-mcp": plan.mcp_entry,
    },
  };

  await writeJsonFile(targetPath, nextPayload);
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

  const managedConfig = await inspectContinueManagedConfig({
    scope: "user",
    env,
    modelRuntime: model,
  });

  if (managedConfig.filesToModify.length === 0) {
    return managedConfig.warnings;
  }

  await writeTextFile(
    managedConfig.managedConfigPath,
    createContinueManagedConfig(model),
  );
  return managedConfig.warnings;
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
