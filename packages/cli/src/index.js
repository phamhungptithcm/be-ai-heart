import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  buildInstallPlan,
  detectConnections,
  installConnection,
  runConnectDoctor,
  verifyConnection,
} from "../../connect/src/index.js";
import { buildWorkspaceState, createDefaultConfigYaml, loadHeartConfig } from "../../core/src/index.js";
import { compileContextPack } from "../../context-compiler/src/index.js";
import { findRelevantDocuments } from "../../document-ingest/src/index.js";
import { createProjectOverview } from "../../graph/src/index.js";
import { createToolRegistry, startStdioServer } from "../../mcp-server/src/index.js";
import { createDefaultPoliciesYaml } from "../../policy-engine/src/index.js";

export async function runCli(argv, io = defaultIo()) {
  const { command, subcommand, flags, positional } = parseArgs(argv);

  switch (command) {
    case "init":
      return handleInit(flags, io);
    case "doctor":
      return handleDoctor(flags, io);
    case "overview":
      return handleOverview(flags, io);
    case "pack":
      return handlePack(flags, positional, io);
    case "docs":
      return handleDocs(subcommand, flags, positional, io);
    case "connect":
      return handleConnect(subcommand, flags, io);
    case "mcp":
      return handleMcp(subcommand, flags, io);
    case "help":
    case undefined:
      writeOutput(helpText(), flags.json, io);
      return 0;
    default:
      io.stderr.write(`Unknown command: ${command}\n`);
      io.stderr.write(helpText());
      return 1;
  }
}

async function handleInit(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const configState = await loadHeartConfig(repoRoot);

  if (configState.exists && !flags.force) {
    writeOutput(
      {
        created: false,
        message: `Config already exists at ${configState.path}. Use --force to overwrite.`,
      },
      flags.json,
      io,
    );
    return 0;
  }

  await fs.writeFile(
    path.join(repoRoot, "heart.config.yaml"),
    createDefaultConfigYaml(path.basename(repoRoot)),
    "utf8",
  );
  await fs.mkdir(path.join(repoRoot, ".heart"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, ".heart", "policies.yaml"), createDefaultPoliciesYaml(), "utf8");

  writeOutput(
    {
      created: true,
      config: path.join(repoRoot, "heart.config.yaml"),
      policies: path.join(repoRoot, ".heart", "policies.yaml"),
    },
    flags.json,
    io,
  );
  return 0;
}

async function handleDoctor(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const configState = await loadHeartConfig(repoRoot);

  const result = {
    repo_root: repoRoot,
    config_exists: configState.exists,
    agents_exists: await fileExists(path.join(repoRoot, "AGENTS.md")),
    skill_count: await countSkillFiles(path.join(repoRoot, "skills")),
    node_version: process.version,
  };

  writeOutput(result, flags.json, io);
  return 0;
}

async function handleOverview(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);
  const overview = createProjectOverview(
    workspaceState.graph,
    workspaceState.policyReport,
    workspaceState.documentIndex,
  );

  writeOutput(overview, flags.json, io);
  return 0;
}

async function handlePack(flags, positional, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const task = positional.join(" ").trim();

  if (!task) {
    io.stderr.write("Usage: heart pack [--json] [--root PATH] <task description>\n");
    return 1;
  }

  const workspaceState = await buildWorkspaceState(repoRoot);
  const contextPack = compileContextPack({
    task,
    graph: workspaceState.graph,
    documentIndex: workspaceState.documentIndex,
    policyReport: workspaceState.policyReport,
  });

  writeOutput(contextPack, flags.json, io);
  return 0;
}

async function handleMcp(subcommand, flags, io) {
  if (subcommand === "tools" || !subcommand) {
    writeOutput({ tools: createToolRegistry() }, flags.json, io);
    return 0;
  }

  if (subcommand === "serve") {
    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    await startStdioServer({
      repoRoot,
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
    });
    return 0;
  }

  io.stderr.write(`Unknown mcp subcommand: ${subcommand}\n`);
  return 1;
}

async function handleDocs(subcommand, flags, positional, io) {
  if (subcommand !== "search") {
    io.stderr.write("Usage: heart docs search [--json] [--root PATH] <query>\n");
    return 1;
  }

  const query = positional.join(" ").trim();
  if (!query) {
    io.stderr.write("Usage: heart docs search [--json] [--root PATH] <query>\n");
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);

  writeOutput(
    {
      query,
      matches: findRelevantDocuments(workspaceState.documentIndex, query, 8),
    },
    flags.json,
    io,
  );
  return 0;
}

async function handleConnect(subcommand, flags, io) {
  if (flags.help || subcommand === "help") {
    io.stderr.write(`Unknown connect subcommand: ${subcommand ?? "--help"}\n`);
    return 1;
  }

  if (subcommand === "detect") {
    return handleConnectDetect(flags, io);
  }

  if (subcommand === "install") {
    return handleConnectInstall(flags, io);
  }

  if (subcommand === "verify") {
    return handleConnectVerify(flags, io);
  }

  if (subcommand === "doctor") {
    return handleConnectDoctor(flags, io);
  }

  io.stderr.write(connectHelpText());
  return 1;
}

async function handleConnectDetect(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const result = await detectConnections({ repoRoot });

  if (flags.agents && !flags.models) {
    result.models = [];
  }

  if (flags.models && !flags.agents) {
    result.agents = [];
  }

  writeOutput(result, flags.json, io);
  return 0;
}

async function handleConnectInstall(flags, io) {
  if (!flags.client) {
    io.stderr.write(
      "Usage: heart connect install --client CLIENT [--json] [--root PATH] [--scope user|repo] [--model RUNTIME] [--dry-run] [--backup]\n",
    );
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const scope = flags.scope ?? "repo";
  const scopeError = validateConnectScope(scope);
  if (scopeError) {
    io.stderr.write(`${scopeError}\n`);
    return 1;
  }

  let plan;
  try {
    plan = await buildInstallPlan({
      client: flags.client,
      scope,
      repoRoot,
      modelRuntime: flags.model,
    });
  } catch (error) {
    io.stderr.write(`${formatConnectClientError(error, flags.client)}\n`);
    return 1;
  }

  if (flags.dryRun) {
    writeOutput({ plan }, flags.json, io);
    return 0;
  }

  try {
    const backups = flags.backup
      ? await createPlanBackups(plan.files_to_backup ?? [])
      : [];

    const result = await installConnection({
      client: flags.client,
      scope,
      repoRoot,
      model: flags.model,
      verifyImpl: async (plan) =>
        verifyConnection({
          client: flags.client,
          repoRoot,
          plan: normalizeVerificationPlan(plan),
        }),
    });

    if (flags.backup) {
      result.backups = backups;
    }

    writeOutput(result, flags.json, io);
    return 0;
  } catch (error) {
    io.stderr.write(`Connect install failed: ${formatConnectInstallError(error)}\n`);
    return 1;
  }
}

async function handleConnectVerify(flags, io) {
  if (!flags.client) {
    io.stderr.write(
      "Usage: heart connect verify --client CLIENT [--json] [--root PATH]\n",
    );
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const client = flags.client;
  const scope = flags.scope ?? "repo";
  const scopeError = validateConnectScope(scope);
  if (scopeError) {
    io.stderr.write(`${scopeError}\n`);
    return 1;
  }

  let plan;
  try {
    plan = await buildInstallPlan({
      client,
      scope,
      repoRoot,
      modelRuntime: flags.model,
    });
  } catch (error) {
    io.stderr.write(`${formatConnectClientError(error, client)}\n`);
    return 1;
  }

  const result = await verifyConnection({
    client,
    repoRoot,
    plan: normalizeVerificationPlan(plan),
  });

  writeOutput(result, flags.json, io);
  return 0;
}

async function handleConnectDoctor(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const result = await runConnectDoctor({ repoRoot });

  writeOutput(result, flags.json, io);
  return 0;
}

function parseArgs(argv) {
  const tokens = [...argv];
  const flags = {};
  const positional = [];
  let command;
  let subcommand;
  const booleanFlags = new Set([
    "json",
    "force",
    "agents",
    "models",
    "dry-run",
    "backup",
    "rebuild",
    "help",
  ]);
  const valueFlags = new Set([
    "root",
    "client",
    "scope",
    "model",
    "slug",
    "portal-root",
    "admin-root",
    "task",
    "target",
    "token-budget",
    "scenario",
    "provider",
    "out",
    "title",
    "summary",
    "category",
  ]);

  while (tokens.length > 0) {
    const token = tokens.shift();

    if (token.startsWith("--")) {
      const flagName = token.slice(2);

      if (booleanFlags.has(flagName)) {
        flags[toFlagKey(flagName)] = true;
      } else if (valueFlags.has(flagName)) {
        flags[toFlagKey(flagName)] = tokens.shift();
      }
      continue;
    }

    if (!command) {
      command = token;
      continue;
    }

    if ((command === "mcp" || command === "docs" || command === "connect") && !subcommand) {
      subcommand = token;
      continue;
    }

    positional.push(token);
  }

  return {
    command,
    subcommand,
    flags,
    positional,
  };
}

function resolveRepoRoot(rootFlag, cwd) {
  return path.resolve(cwd, rootFlag ?? ".");
}

function writeOutput(payload, jsonMode, io) {
  if (jsonMode) {
    io.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  if (typeof payload === "string") {
    io.stdout.write(`${payload}\n`);
    return;
  }

  io.stdout.write(`${formatObject(payload)}\n`);
}

function formatObject(value) {
  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${typeof entry === "string" ? entry : JSON.stringify(entry)}`)
    .join("\n");
}

function helpText() {
  return `heart

Usage:
  heart init [--force] [--root PATH]
  heart doctor [--json] [--root PATH]
  heart overview [--json] [--root PATH]
  heart pack [--json] [--root PATH] <task description>
  heart docs search [--json] [--root PATH] <query>
  heart connect detect [--json] [--root PATH] [--agents] [--models]
  heart connect install --client CLIENT [--json] [--root PATH] [--scope user|repo] [--model RUNTIME] [--dry-run] [--backup]
  heart connect verify --client CLIENT [--json] [--root PATH]
  heart connect doctor [--json] [--root PATH]
  heart mcp tools [--json]
  heart mcp serve [--root PATH]
`;
}

function connectHelpText() {
  return `heart connect

Usage:
  heart connect detect [--json] [--root PATH] [--agents] [--models]
  heart connect install --client CLIENT [--json] [--root PATH] [--scope user|repo] [--model RUNTIME] [--dry-run] [--backup]
  heart connect verify --client CLIENT [--json] [--root PATH]
  heart connect doctor [--json] [--root PATH]
`;
}

function defaultIo() {
  return {
    cwd: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function countSkillFiles(skillsRoot) {
  try {
    const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

function normalizeVerificationPlan(plan) {
  const directEntry = plan?.mcp_entry;
  if (isSpawnableMcpEntry(directEntry)) {
    return plan;
  }

  const firstEntry = directEntry?.mcpServers?.find?.((entry) => isSpawnableMcpEntry(entry));
  if (firstEntry) {
    return {
      ...plan,
      mcp_entry: firstEntry,
    };
  }

  return plan;
}

function isSpawnableMcpEntry(entry) {
  return (
    entry &&
    typeof entry.command === "string" &&
    Array.isArray(entry.args)
  );
}

function toFlagKey(flagName) {
  return flagName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function validateConnectScope(scope) {
  if (scope !== "repo" && scope !== "user") {
    return `Invalid --scope value: ${scope}. Expected repo or user.`;
  }

  return null;
}

function formatConnectClientError(error, client) {
  if (error instanceof Error && error.message.startsWith("Unsupported install client:")) {
    return `Unsupported connect client: ${client}.`;
  }

  return error instanceof Error ? error.message : String(error);
}

function formatConnectInstallError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function createPlanBackups(filePaths) {
  const backups = [];

  for (const source of filePaths) {
    const backup = await createDeterministicBackupPath(source);
    await fs.mkdir(path.dirname(backup), { recursive: true });
    await fs.copyFile(source, backup);
    backups.push({ source, backup });
  }

  return backups;
}

async function createDeterministicBackupPath(source) {
  let suffix = "";
  let attempt = 0;

  while (true) {
    const backup = `${source}.bak${suffix}`;
    try {
      await fs.access(backup);
      attempt += 1;
      suffix = `.${attempt}`;
    } catch {
      return backup;
    }
  }
}
