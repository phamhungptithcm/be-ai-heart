import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
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

function parseArgs(argv) {
  const tokens = [...argv];
  const flags = {};
  const positional = [];
  let command;
  let subcommand;

  while (tokens.length > 0) {
    const token = tokens.shift();

    if (token.startsWith("--")) {
      if (token === "--json" || token === "--force") {
        flags[token.slice(2)] = true;
      } else if (token === "--root") {
        flags.root = tokens.shift();
      }
      continue;
    }

    if (!command) {
      command = token;
      continue;
    }

    if ((command === "mcp" || command === "docs") && !subcommand) {
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
  heart mcp tools [--json]
  heart mcp serve [--root PATH]
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
