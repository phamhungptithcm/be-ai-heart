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
import {
  compareBenchmarkRuns,
  loadBenchmarkReport,
  prepareBenchmarkReportArtifact,
  runBenchmarkScenario,
  publishBenchmarkReport,
  writeBenchmarkReport,
} from "../../benchmark/src/index.js";
import { buildWorkspaceState, createDefaultConfigYaml, loadHeartConfig } from "../../core/src/index.js";
import { compileContextPack } from "../../context-compiler/src/index.js";
import {
  generateDiagramBundle,
  prepareRepositoryProfileArtifact,
  resolveDiagramTypes,
  syncRepositoryProfile,
  writeDiagramBundle,
} from "../../diagram-generator/src/index.js";
import { findRelevantDocuments } from "../../document-ingest/src/index.js";
import {
  importLocalDocument,
  prepareRepositoryDocumentArtifact,
  pullWebDocumentSubmissions,
  syncRepositoryDocumentsToSurfaces,
} from "../../document-sync/src/index.js";
import {
  exchangeProviderSessionRemote,
  syncBenchmarkReportRemote,
  syncRepositoryDocumentsRemote,
  syncRepositoryProfileRemote,
} from "./http-client.js";
import {
  createDependencyExplanation,
  createImpactAnalysis,
  createProjectOverview,
  searchSymbols,
} from "../../graph/src/index.js";
import { createToolRegistry, startStdioServer } from "../../mcp-server/src/index.js";
import { createDefaultPoliciesYaml } from "../../policy-engine/src/index.js";
import { writeCanonicalSnapshot } from "../../../services/api/src/migration.js";
import { resolveServiceStorageRoot } from "../../../services/api/src/storage.js";

export async function runCli(argv, io = defaultIo()) {
  const { command, subcommand, flags, positional } = parseArgs(argv);

  switch (command) {
    case "init":
      return handleInit(flags, io);
    case "doctor":
      return handleDoctor(flags, io);
    case "scan":
      return handleScan(flags, io);
    case "overview":
      return handleOverview(flags, io);
    case "find":
      return handleFind(subcommand, flags, positional, io);
    case "deps":
      return handleDeps(flags, positional, io);
    case "impact":
      return handleImpact(flags, positional, io);
    case "diagram":
      return handleDiagram(subcommand, flags, positional, io);
    case "pack":
      return handlePack(flags, positional, io);
    case "benchmark":
      return handleBenchmark(subcommand, flags, positional, io);
    case "docs":
      return handleDocs(subcommand, flags, positional, io);
    case "connect":
      return handleConnect(subcommand, flags, io);
    case "auth":
      return handleAuth(subcommand, flags, positional, io);
    case "sync":
      return handleSync(subcommand, flags, positional, io);
    case "service":
      return handleService(subcommand, flags, io);
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
    workspaceState.heartModel,
  );

  writeOutput(overview, flags.json, io);
  return 0;
}

async function handleScan(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot, {
    forceRescan: flags.rebuild === true,
  });

  writeOutput(
    {
      repo_root: repoRoot,
      cache: workspaceState.cache,
      heart: workspaceState.heartModel.summary,
      parser_engine: workspaceState.scanResult.parser_engine,
      file_count: workspaceState.scanResult.totals.file_count,
      symbol_count: workspaceState.scanResult.totals.symbol_count,
      document_count: workspaceState.documentIndex.totals.document_count,
      policy_warnings: workspaceState.policyReport.violations.length,
    },
    flags.json,
    io,
  );
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
    heartModel: workspaceState.heartModel,
    policyReport: workspaceState.policyReport,
  });

  writeOutput(contextPack, flags.json, io);
  return 0;
}

async function handleFind(subcommand, flags, positional, io) {
  if (subcommand !== "symbol") {
    io.stderr.write("Usage: heart find symbol [--json] [--root PATH] <query>\n");
    return 1;
  }

  const query = positional.join(" ").trim();
  if (!query) {
    io.stderr.write("Usage: heart find symbol [--json] [--root PATH] <query>\n");
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);

  writeOutput(
    {
      query,
      matches: searchSymbols(workspaceState.graph, query),
    },
    flags.json,
    io,
  );
  return 0;
}

async function handleDeps(flags, positional, io) {
  const target = positional.join(" ").trim();
  if (!target) {
    io.stderr.write("Usage: heart deps [--json] [--root PATH] <file-or-symbol>\n");
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);
  writeOutput(createDependencyExplanation(workspaceState.graph, target), flags.json, io);
  return 0;
}

async function handleImpact(flags, positional, io) {
  const target = positional.join(" ").trim();
  if (!target) {
    io.stderr.write("Usage: heart impact [--json] [--root PATH] <file-or-symbol>\n");
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);
  writeOutput(createImpactAnalysis(workspaceState.graph, target), flags.json, io);
  return 0;
}

async function handleDiagram(subcommand, flags, positional, io) {
  if (subcommand === "generate" || !subcommand) {
    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const requestedType = positional[0] ?? "all";
    const workspaceState = await buildWorkspaceState(repoRoot);
    const bundle = generateDiagramBundle({
      workspaceState,
      types: resolveDiagramTypes(requestedType),
      task: flags.task,
      target: flags.target,
    });
    const artifacts = await writeDiagramBundle(repoRoot, bundle);

    if (!flags.json && bundle.diagrams.length === 1) {
      io.stdout.write(`${bundle.diagrams[0].content}\n`);
      return 0;
    }

    writeOutput(
      {
        repo_root: repoRoot,
        generated_at: bundle.generated_at,
        manifest_path: artifacts.manifest_path,
        diagrams: artifacts.diagrams.map((diagram) => ({
          type: diagram.type,
          title: diagram.title,
          format: diagram.format,
          inference_mode: diagram.inference_mode,
          artifact_path: diagram.artifact_path,
        })),
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (subcommand === "sync") {
    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const workspaceState = await buildWorkspaceState(repoRoot);
    const bundle = generateDiagramBundle({
      workspaceState,
      task: flags.task,
      target: flags.target,
    });
    const artifacts = await writeDiagramBundle(repoRoot, bundle);
    const syncResult = await syncRepositoryProfile({
      repoRoot,
      workspaceState,
      bundle,
      artifacts,
      slug: flags.slug,
      portalRoot: flags.portalRoot,
      adminRoot: flags.adminRoot,
    });

    writeOutput(
      {
        repo_root: repoRoot,
        profile_slug: syncResult.profile_slug,
        published_root: syncResult.published_root,
        profile_path: syncResult.profile_path,
        synced_destinations: syncResult.synced_destinations,
      },
      flags.json,
      io,
    );
    return 0;
  }

  io.stderr.write(
    "Usage: heart diagram generate [all|symbol-graph|high-level|class|sequence] [--json] [--task TEXT] [--target NAME] [--root PATH]\n",
  );
  io.stderr.write(
    "       heart diagram sync [--json] [--slug NAME] [--portal-root PATH] [--admin-root PATH] [--task TEXT] [--target NAME] [--root PATH]\n",
  );
  return 1;
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

async function handleBenchmark(subcommand, flags, positional, io) {
  if (subcommand === "run") {
    if (positional.length < 1) {
      io.stderr.write(
        "Usage: heart benchmark run [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <scenario-name-or-path>\n",
      );
      return 1;
    }

    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const scenarioRef = positional[0];
    const report = await runBenchmarkScenario(scenarioRef, {
      repoRoot,
      repo: path.basename(repoRoot),
      profile_slug: flags.slug ?? path.basename(repoRoot),
      scenario: flags.scenario,
      provider: flags.provider,
      model: flags.model,
    });
    const persisted = await writeBenchmarkReport(repoRoot, report);
    const syncedDestinations = await publishBenchmarkReport({
      report,
      repoRoot,
      portalRoot: flags.portalRoot,
      adminRoot: flags.adminRoot,
    });

    writeOutput(
      {
        report,
        persisted,
        synced_destinations: syncedDestinations,
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (subcommand !== "compare") {
    io.stderr.write(
      "Usage: heart benchmark run [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <scenario-name-or-path>\n",
    );
    io.stderr.write(
      "       heart benchmark compare [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <baseline.json> <assisted.json>\n",
    );
    return 1;
  }

  if (positional.length < 2) {
    io.stderr.write(
      "Usage: heart benchmark compare [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <baseline.json> <assisted.json>\n",
    );
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const baselinePath = path.resolve(io.cwd, positional[0]);
  const assistedPath = path.resolve(io.cwd, positional[1]);
  const [baseline, assisted] = await Promise.all([
    loadBenchmarkReport(baselinePath),
    loadBenchmarkReport(assistedPath),
  ]);

  const report = compareBenchmarkRuns(baseline, assisted, {
    repo: path.basename(repoRoot),
    profile_slug: flags.slug ?? path.basename(repoRoot),
    scenario: flags.scenario ?? "comparison",
    provider: flags.provider,
    model: flags.model,
  });
  const persisted = await writeBenchmarkReport(repoRoot, report);
  const syncedDestinations = await publishBenchmarkReport({
    report,
    repoRoot,
    portalRoot: flags.portalRoot,
    adminRoot: flags.adminRoot,
  });

  writeOutput(
    {
      report,
      persisted,
      synced_destinations: syncedDestinations,
    },
    flags.json,
    io,
  );
  return 0;
}

async function handleDocs(subcommand, flags, positional, io) {
  if (subcommand === "search") {
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

  if (subcommand === "import") {
    if (positional.length < 1) {
      io.stderr.write(
        "Usage: heart docs import [--json] [--root PATH] [--slug NAME] [--category NAME] [--title TEXT] [--summary TEXT] [--portal-root PATH] [--admin-root PATH] <source-file>\n",
      );
      return 1;
    }

    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const result = await importLocalDocument({
      repoRoot,
      sourcePath: positional[0],
      title: flags.title,
      category: flags.category,
      summary: flags.summary,
      profileSlug: flags.slug,
    });
    const published = await syncRepositoryDocumentsToWeb({
      repoRoot,
      profileSlug: flags.slug ?? path.basename(repoRoot),
      portalRoot: flags.portalRoot,
      adminRoot: flags.adminRoot,
      cwd: io.cwd,
    });

    writeOutput(
      {
        ...result,
        ...published,
      },
      flags.json,
      io,
    );
    return 0;
  }

  if (subcommand === "sync-web") {
    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const profileSlug = flags.slug ?? path.basename(repoRoot);
    const portalRoot = flags.portalRoot ? path.resolve(io.cwd, flags.portalRoot) : path.join(repoRoot, "apps", "portal");
    const result = await pullWebDocumentSubmissions({
      repoRoot,
      portalRoot,
      profileSlug,
    });
    const published = await syncRepositoryDocumentsToWeb({
      repoRoot,
      profileSlug,
      portalRoot: flags.portalRoot,
      adminRoot: flags.adminRoot,
      cwd: io.cwd,
    });

    writeOutput(
      {
        ...result,
        ...published,
      },
      flags.json,
      io,
    );
    return 0;
  }

  io.stderr.write("Usage: heart docs search [--json] [--root PATH] <query>\n");
  io.stderr.write(
    "       heart docs import [--json] [--root PATH] [--slug NAME] [--category NAME] [--title TEXT] [--summary TEXT] [--portal-root PATH] [--admin-root PATH] <source-file>\n",
  );
  io.stderr.write("       heart docs sync-web [--json] [--root PATH] [--slug NAME] [--portal-root PATH] [--admin-root PATH]\n");
  return 1;
}

async function handleConnect(subcommand, flags, io) {
  if (flags.help || subcommand === "help") {
    io.stdout.write(`${connectHelpText()}\n`);
    return 0;
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
      verifyImpl: async (installPlan) =>
        verifyConnection({
          client: flags.client,
          repoRoot,
          plan: normalizeVerificationPlan(installPlan),
        }),
    });

    if (flags.backup) {
      result.backups = backups;
    }

    writeOutput(result, flags.json, io);
    return connectVerificationExitCode(result);
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
  return connectVerificationExitCode(result);
}

async function handleConnectDoctor(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const result = await runConnectDoctor({ repoRoot });

  writeOutput(result, flags.json, io);
  return 0;
}

async function handleService(subcommand, flags, io) {
  if (subcommand !== "export" && subcommand !== undefined) {
    io.stderr.write("Usage: heart service export [--json] [--root PATH] [--out PATH]\n");
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const serviceStorageRoot = resolveServiceStorageRoot({ repoRoot });
  const result = await writeCanonicalSnapshot({
    serviceStorageRoot,
    outputPath: flags.out ? path.resolve(io.cwd, flags.out) : undefined,
  });

  writeOutput(
    {
      output_path: result.output_path,
      source: result.snapshot.source,
      table_counts: Object.fromEntries(
        Object.entries(result.snapshot.tables).map(([tableName, rows]) => [tableName, rows.length]),
      ),
      postgres_migration: result.snapshot.postgres_migration,
    },
    flags.json,
    io,
  );
  return 0;
}

async function handleAuth(subcommand, flags, positional, io) {
  if (subcommand !== "provider-session" && subcommand !== undefined) {
    io.stderr.write(
      "Usage: heart auth provider-session --url BASE_URL [--surface portal|admin] [--workspace NAME] [--customer NAME] [--id-token TOKEN] [--out PATH]\n",
    );
    return 1;
  }

  const idToken = flags.idToken ?? positional[0];
  if (!flags.url || !idToken) {
    io.stderr.write(
      "Usage: heart auth provider-session --url BASE_URL [--surface portal|admin] [--workspace NAME] [--customer NAME] [--id-token TOKEN] [--out PATH]\n",
    );
    return 1;
  }

  const result = await exchangeProviderSessionRemote({
    baseUrl: flags.url,
    idToken,
    workspaceSlug: flags.workspace ?? flags.slug,
    customerSlug: flags.customer,
    providerConfig: flags.issuer || flags.audience
      ? {
          issuer: flags.issuer,
          audience: flags.audience,
        }
      : undefined,
  });

  if (flags.out) {
    await fs.writeFile(path.resolve(io.cwd, flags.out), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  writeOutput(result, flags.json, io);
  return 0;
}

async function handleSync(subcommand, flags, positional, io) {
  if (!["profile", "docs", "benchmark"].includes(subcommand ?? "")) {
    io.stderr.write(
      "Usage: heart sync profile --url BASE_URL --session TOKEN [--root PATH] [--slug NAME]\n",
    );
    io.stderr.write(
      "       heart sync docs --url BASE_URL --session TOKEN [--root PATH] [--slug NAME]\n",
    );
    io.stderr.write(
      "       heart sync benchmark --url BASE_URL --session TOKEN [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] <scenario-name-or-path>\n",
    );
    return 1;
  }

  if (!flags.url || !flags.session) {
    io.stderr.write("Both --url and --session are required for remote sync.\n");
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const profileSlug = flags.slug ?? path.basename(repoRoot);
  const workspaceSlug = flags.workspace ?? profileSlug;
  const customerSlug = flags.customer ?? workspaceSlug;

  if (subcommand === "profile") {
    const workspaceState = await buildWorkspaceState(repoRoot);
    const bundle = generateDiagramBundle({
      workspaceState,
      task: flags.task,
      target: flags.target,
    });
    const artifacts = await writeDiagramBundle(repoRoot, bundle);
    const profile = {
      ...prepareRepositoryProfileArtifact({
        repoRoot,
        workspaceState,
        bundle,
        artifacts,
        slug: profileSlug,
      }),
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
    };
    const result = await syncRepositoryProfileRemote({
      baseUrl: flags.url,
      sessionToken: flags.session,
      profile,
    });
    writeOutput(result, flags.json, io);
    return 0;
  }

  if (subcommand === "docs") {
    const workspaceState = await buildWorkspaceState(repoRoot);
    const artifact = {
      ...prepareRepositoryDocumentArtifact({
        profileSlug,
        repo: path.basename(repoRoot),
        documentIndex: workspaceState.documentIndex,
      }),
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
    };
    const result = await syncRepositoryDocumentsRemote({
      baseUrl: flags.url,
      sessionToken: flags.session,
      artifact,
    });
    writeOutput(result, flags.json, io);
    return 0;
  }

  if (positional.length < 1) {
    io.stderr.write(
      "Usage: heart sync benchmark --url BASE_URL --session TOKEN [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] <scenario-name-or-path>\n",
    );
    return 1;
  }

  const report = {
    ...prepareBenchmarkReportArtifact(
      await runBenchmarkScenario(positional[0], {
        repoRoot,
        repo: path.basename(repoRoot),
        profile_slug: profileSlug,
        scenario: flags.scenario,
        provider: flags.provider,
        model: flags.model,
      }),
    ),
    workspace_slug: workspaceSlug,
    customer_slug: customerSlug,
  };
  const result = await syncBenchmarkReportRemote({
    baseUrl: flags.url,
    sessionToken: flags.session,
    report,
  });
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
    "rebuild",
    "agents",
    "models",
    "dry-run",
    "backup",
    "help",
  ]);
  const valueFlags = new Set([
    "root",
    "task",
    "target",
    "slug",
    "category",
    "title",
    "summary",
    "scenario",
    "provider",
    "model",
    "url",
    "session",
    "workspace",
    "customer",
    "surface",
    "id-token",
    "issuer",
    "audience",
    "portal-root",
    "admin-root",
    "out",
    "client",
    "scope",
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

    if (
      (command === "mcp" ||
        command === "docs" ||
        command === "connect" ||
        command === "diagram" ||
        command === "benchmark" ||
        command === "service" ||
        command === "auth" ||
        command === "sync" ||
        command === "find") &&
      !subcommand
    ) {
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
  heart scan [--json] [--rebuild] [--root PATH]
  heart overview [--json] [--root PATH]
  heart find symbol [--json] [--root PATH] <query>
  heart deps [--json] [--root PATH] <file-or-symbol>
  heart impact [--json] [--root PATH] <file-or-symbol>
  heart diagram generate [all|symbol-graph|high-level|class|sequence] [--json] [--task TEXT] [--target NAME] [--root PATH]
  heart diagram sync [--json] [--slug NAME] [--portal-root PATH] [--admin-root PATH] [--task TEXT] [--target NAME] [--root PATH]
  heart pack [--json] [--root PATH] <task description>
  heart benchmark run [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <scenario-name-or-path>
  heart benchmark compare [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <baseline.json> <assisted.json>
  heart docs search [--json] [--root PATH] <query>
  heart docs import [--json] [--root PATH] [--slug NAME] [--category NAME] [--title TEXT] [--summary TEXT] [--portal-root PATH] [--admin-root PATH] <source-file>
  heart docs sync-web [--json] [--root PATH] [--slug NAME] [--portal-root PATH] [--admin-root PATH]
  heart connect detect [--json] [--root PATH] [--agents] [--models]
  heart connect install --client CLIENT [--json] [--root PATH] [--scope user|repo] [--model RUNTIME] [--dry-run] [--backup]
  heart connect verify --client CLIENT [--json] [--root PATH]
  heart connect doctor [--json] [--root PATH]
  heart auth provider-session --url BASE_URL [--surface portal|admin] [--workspace NAME] [--customer NAME] [--id-token TOKEN] [--issuer URL] [--audience NAME] [--out PATH]
  heart sync profile --url BASE_URL --session TOKEN [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME]
  heart sync docs --url BASE_URL --session TOKEN [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME]
  heart sync benchmark --url BASE_URL --session TOKEN [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME] [--scenario TEXT] [--provider NAME] [--model NAME] <scenario-name-or-path>
  heart service export [--json] [--root PATH] [--out PATH]
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
  return entry && typeof entry.command === "string" && Array.isArray(entry.args);
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

function connectVerificationExitCode(result) {
  return result?.status === "failed" ? 1 : 0;
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

async function syncRepositoryDocumentsToWeb({
  repoRoot,
  profileSlug,
  portalRoot,
  adminRoot,
  cwd,
}) {
  const destinations = await resolveDocumentSurfaceDestinations(repoRoot, {
    portalRoot,
    adminRoot,
    cwd,
  });

  if (destinations.length === 0) {
    return {
      synced_destinations: [],
    };
  }

  const workspaceState = await buildWorkspaceState(repoRoot);
  const published = await syncRepositoryDocumentsToSurfaces({
    repoRoot,
    profileSlug,
    repo: path.basename(repoRoot),
    documentIndex: workspaceState.documentIndex,
    portalRoot: destinations.find((destination) => destination.kind === "portal")?.root,
    adminRoot: destinations.find((destination) => destination.kind === "admin")?.root,
  });

  return {
    document_count: workspaceState.documentIndex.totals.document_count,
    service_storage_root: published.service_storage_root,
    repository_path: published.repository_path,
    synced_destinations: published.synced_destinations,
  };
}

async function resolveDocumentSurfaceDestinations(repoRoot, { portalRoot, adminRoot, cwd }) {
  const destinations = [];
  const candidates = [
    {
      kind: "portal",
      root: portalRoot ? path.resolve(cwd, portalRoot) : path.join(repoRoot, "apps", "portal"),
      explicit: Boolean(portalRoot),
    },
    {
      kind: "admin",
      root: adminRoot ? path.resolve(cwd, adminRoot) : path.join(repoRoot, "apps", "admin"),
      explicit: Boolean(adminRoot),
    },
  ];

  for (const candidate of candidates) {
    if (candidate.explicit || (await fileExists(candidate.root))) {
      destinations.push(candidate);
    }
  }

  return destinations;
}
