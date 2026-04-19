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
  await installJsonMcpServer(plan);
}

async function installJsonMcpServer(plan) {
  const targetPath = plan.target_file;
  const { payload } = targetPath
    ? await readExistingJsonFile(targetPath, `${plan.client} config`)
    : { payload: null };
  const rootKey = plan.json_root_key ?? "mcpServers";
  const existingPayload = payload ?? { [rootKey]: {} };
  const nextPayload = {
    ...existingPayload,
    [rootKey]: {
      ...(existingPayload[rootKey] ?? {}),
      [plan.server_key ?? "heart-mcp"]: plan.mcp_entry,
    },
  };

  await writeJsonFile(targetPath, nextPayload);
}

async function installClaudeCode(plan, execFileImpl) {
  const command = plan.exec?.command ?? plan.command;
  const args = plan.exec?.args ?? plan.args;
  await execFileImpl(command, args);
}

async function installCodex(plan, execFileImpl) {
  const command = plan.exec?.command ?? plan.command;
  const args = plan.exec?.args ?? plan.args;
  await execFileImpl(command, args);
}

async function maybeWriteContinueManagedConfig({ env, model, modelName = null }) {
  if (!model) {
    return [];
  }

  const managedConfig = await inspectContinueManagedConfig({
    scope: "user",
    env,
    modelRuntime: model,
    resolvedModelName: modelName,
  });

  if (managedConfig.filesToModify.length === 0) {
    return managedConfig.warnings;
  }

  await writeTextFile(
    managedConfig.managedConfigPath,
    createContinueManagedConfig(model, modelName ?? undefined),
  );
  return managedConfig.warnings;
}

async function installContinue(plan, { env, model }) {
  await writeJsonFile(plan.target_file, plan.mcp_entry);
  if (plan.scope !== "user") {
    return [];
  }

  return maybeWriteContinueManagedConfig({
    env,
    model,
    modelName: plan.resolved_model_name,
  });
}

async function captureRollbackSnapshots(filePaths) {
  const snapshots = [];

  for (const filePath of filePaths ?? []) {
    try {
      snapshots.push({
        filePath,
        existed: true,
        content: await fs.readFile(filePath),
      });
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }

      snapshots.push({
        filePath,
        existed: false,
        content: null,
      });
    }
  }

  return snapshots;
}

async function restoreRollbackSnapshots(snapshots) {
  for (const snapshot of snapshots ?? []) {
    if (snapshot.existed) {
      await writeTextFile(snapshot.filePath, snapshot.content);
      continue;
    }

    await fs.rm(snapshot.filePath, { force: true });
  }
}

export async function installConnection({
  client,
  scope,
  repoRoot,
  env = process.env,
  model = null,
  remoteUrl = null,
  execFileImpl = defaultExecFileImpl,
  verifyImpl,
  detectedModelsByRuntime = {},
} = {}) {
  const plan = await buildInstallPlan({
    client,
    scope,
    repoRoot,
    env,
    modelRuntime: model,
    detectedModelsByRuntime,
    remoteUrl,
  });
  const modifiedFiles = plan.files_to_modify ?? [];
  let warnings = [...(plan.warnings ?? [])];
  const rollbackSnapshots = await captureRollbackSnapshots(modifiedFiles);

  try {
    if (plan.client === "cursor") {
      await installCursor(plan);
    } else if (plan.client === "claude-code") {
      await installClaudeCode(plan, execFileImpl);
    } else if (plan.client === "codex") {
      await installCodex(plan, execFileImpl);
    } else if (
      plan.client === "windsurf" ||
      plan.client === "cline" ||
      plan.client === "copilot-cli" ||
      plan.client === "vscode"
    ) {
      await installJsonMcpServer(plan);
    } else if (plan.client === "continue") {
      warnings = warnings.concat(await installContinue(plan, { env, model }));
    } else {
      throw new Error(`Unsupported install client: ${plan.client}`);
    }

    const verification = verifyImpl
      ? await verifyImpl(plan)
      : { status: "ready", warnings: [] };

    if (verification.status === "failed" && modifiedFiles.length > 0) {
      await restoreRollbackSnapshots(rollbackSnapshots);
    }

    return {
      ...verification,
      warnings: [...(verification.warnings ?? []), ...warnings],
      client,
      scope,
      plan,
    };
  } catch (error) {
    if (modifiedFiles.length > 0) {
      await restoreRollbackSnapshots(rollbackSnapshots);
    }
    throw error;
  }
}
