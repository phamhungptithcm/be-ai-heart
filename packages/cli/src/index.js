import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  buildInstallPlan,
  detectConnections,
  installConnection,
  runConnectDoctor,
  verifyConnection,
} from "../../connect/src/index.js";
import {
  compareBenchmarkRuns,
  loadBenchmarkScenario,
  loadBenchmarkReport,
  mergeObservedRunIntoBenchmarkInput,
  prepareBenchmarkReportArtifact,
  publishBenchmarkReport,
  runBenchmarkScenario,
  runBenchmarkSuite,
  writeBenchmarkEvidenceBundle,
  writeBenchmarkReport,
  writeBenchmarkSuiteReport,
} from "../../benchmark/src/index.js";
import {
  KNOWN_MCP_TOOL_NAMES,
  buildWorkspaceState,
  createDefaultConfigYaml,
  detectProjectEnvironment,
  loadHeartConfig,
  resolveEnabledMcpTools,
  runWorkspaceDoctor,
} from "../../core/src/index.js";
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
import {
  loadAgentRunCapture,
  startServiceHost,
  writeAgentRunRecord,
} from "../../../services/api/src/index.js";
import { resolveServiceStorageRoot } from "../../../services/api/src/storage.js";

const EXIT_USAGE_ERROR = 2;
const EXIT_NOT_FOUND = 3;

export async function runCli(argv, io = defaultIo()) {
  const parsedArgs = parseArgs(argv);
  if (parsedArgs.error) {
    io.stderr.write(`${parsedArgs.error}\n`);
    return EXIT_USAGE_ERROR;
  }

  const { command, subcommand, flags, positional } = parsedArgs;

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
    case "policy":
      return handlePolicy(subcommand, flags, io);
    case "diagram":
      return handleDiagram(subcommand, flags, positional, io);
    case "pack":
      return handlePack(flags, positional, io);
    case "benchmark":
      return handleBenchmark(subcommand, flags, positional, io);
    case "agent":
      return handleAgent(subcommand, flags, positional, io);
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
  const environment = await detectProjectEnvironment(repoRoot, {
    ignore: configState.config.project.ignore,
  });

  if (configState.exists && !flags.force) {
    const payload = {
      created: false,
      repo_root: repoRoot,
      config_path: configState.path,
      policy_path: path.join(repoRoot, ".heart", "policies.yaml"),
      detected: environment,
      next_commands: [`heart doctor --root ${repoRoot}`],
      message: `Config already exists at ${configState.path}. Use --force to overwrite.`,
    };
    writeOutput(flags.json ? payload : formatInitOutput(payload), flags.json, io);
    return 0;
  }

  await fs.writeFile(
    path.join(repoRoot, "heart.config.yaml"),
    createDefaultConfigYaml(path.basename(repoRoot)),
    "utf8",
  );
  await fs.mkdir(path.join(repoRoot, ".heart"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, ".heart", "policies.yaml"), createDefaultPoliciesYaml(), "utf8");

  const payload = {
    created: true,
    repo_root: repoRoot,
    config_path: path.join(repoRoot, "heart.config.yaml"),
    policy_path: path.join(repoRoot, ".heart", "policies.yaml"),
    detected: environment,
    next_commands: [
      `heart doctor --root ${repoRoot}`,
      `heart scan --root ${repoRoot}`,
      `heart overview --root ${repoRoot}`,
    ],
  };

  writeOutput(flags.json ? payload : formatInitOutput(payload), flags.json, io);
  return 0;
}

async function handleDoctor(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const result = await runWorkspaceDoctor(repoRoot);
  writeOutput(flags.json ? result : formatDoctorOutput(result), flags.json, io);
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
    io.stderr.write("Usage: heart pack [--json] [--token-budget N] [--root PATH] <task description>\n");
    return EXIT_USAGE_ERROR;
  }

  const workspaceState = await buildWorkspaceState(repoRoot);
  const contextPack = compileContextPack({
    task,
    graph: workspaceState.graph,
    documentIndex: workspaceState.documentIndex,
    heartModel: workspaceState.heartModel,
    policyReport: workspaceState.policyReport,
    tokenBudget: flags.tokenBudget,
  });

  writeOutput(flags.json ? contextPack : formatPackOutput(contextPack, repoRoot), flags.json, io);
  return 0;
}

async function handleFind(subcommand, flags, positional, io) {
  if (subcommand !== "symbol") {
    io.stderr.write("Usage: heart find symbol [--json] [--root PATH] <query>\n");
    return EXIT_USAGE_ERROR;
  }

  const query = positional.join(" ").trim();
  if (!query) {
    io.stderr.write("Usage: heart find symbol [--json] [--root PATH] <query>\n");
    return EXIT_USAGE_ERROR;
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
    return EXIT_USAGE_ERROR;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);
  const result = createDependencyExplanation(workspaceState.graph, target);
  writeOutput(flags.json ? result : formatNotFoundAwareOutput("deps", result, repoRoot), flags.json, io);
  return result.found === false ? EXIT_NOT_FOUND : 0;
}

async function handleImpact(flags, positional, io) {
  const target = positional.join(" ").trim();
  if (!target) {
    io.stderr.write("Usage: heart impact [--json] [--root PATH] <file-or-symbol>\n");
    return EXIT_USAGE_ERROR;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);
  const result = createImpactAnalysis(workspaceState.graph, target);
  writeOutput(flags.json ? result : formatNotFoundAwareOutput("impact", result, repoRoot), flags.json, io);
  return result.found === false ? EXIT_NOT_FOUND : 0;
}

async function handlePolicy(subcommand, flags, io) {
  if (subcommand !== "check") {
    io.stderr.write("Usage: heart policy check [--json] [--root PATH]\n");
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const workspaceState = await buildWorkspaceState(repoRoot);
  writeOutput(workspaceState.policyReport, flags.json, io);
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
    "Usage: heart diagram generate [all|symbol-graph|high-level|component|class|sequence] [--json] [--task TEXT] [--target NAME] [--root PATH]\n",
  );
  io.stderr.write(
    "       heart diagram sync [--json] [--slug NAME] [--portal-root PATH] [--admin-root PATH] [--task TEXT] [--target NAME] [--root PATH]\n",
  );
  return 1;
}

async function handleMcp(subcommand, flags, io) {
  if (subcommand === "tools" || !subcommand) {
    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const configState = await loadHeartConfig(repoRoot);
    const effectiveEnabledTools = resolveEnabledMcpTools(configState.config.mcp?.enabled_tools);
    const tools = createToolRegistry({
      enabledTools: effectiveEnabledTools,
    });
    const payload = {
      repo_root: repoRoot,
      enabled_tools: effectiveEnabledTools,
      disabled_tools: KNOWN_MCP_TOOL_NAMES.filter((tool) => !effectiveEnabledTools.includes(tool)),
      tools,
    };

    writeOutput(flags.json ? payload : formatMcpToolsOutput(payload), flags.json, io);
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
  return EXIT_USAGE_ERROR;
}

async function handleBenchmark(subcommand, flags, positional, io) {
  if (subcommand === "capture") {
    if (positional.length < 2 || !flags.upstreamBaseUrl || !Array.isArray(flags.command) || flags.command.length === 0) {
      io.stderr.write(
        "Usage: heart benchmark capture <baseline|assisted> <scenario-name-or-path> [--json] [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME] [--provider NAME] [--model NAME] [--agent-client NAME] [--input-cost-per-1m USD] [--cached-input-cost-per-1m USD] [--output-cost-per-1m USD] --upstream-base-url URL -- <command ...>\n",
      );
      return 1;
    }

    const mode = positional[0];
    if (!["baseline", "assisted"].includes(mode)) {
      io.stderr.write("Benchmark capture mode must be baseline or assisted.\n");
      return 1;
    }

    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    const scenario = await loadBenchmarkScenario(positional[1], repoRoot);
    const result = await executeAgentRunCapture({
      repoRoot,
      slug: flags.slug,
      workspace: flags.workspace,
      customer: flags.customer,
      scenario: scenario.id,
      dataset: scenario.dataset?.id,
      mode,
      provider: flags.provider ?? scenario.provider,
      model: flags.model ?? scenario.model,
      agentClient: flags.agentClient,
      upstreamBaseUrl: flags.upstreamBaseUrl,
      command: flags.command,
      pricing: createPricingConfig(flags),
    });
    const artifact = await writeAgentRunCaptureArtifact(repoRoot, {
      scenario,
      mode,
      run: result.run,
      summary: result.summary,
      proxy: result.proxy,
      command: result.command,
    });

    writeOutput(
      {
        ...result,
        artifact,
        next_commands: {
          run_report:
            mode === "baseline"
              ? `heart benchmark run ${scenario.path ?? scenario.id} --baseline-run ${result.run.run_id} --assisted-run <assisted-run-id>`
              : `heart benchmark run ${scenario.path ?? scenario.id} --baseline-run <baseline-run-id> --assisted-run ${result.run.run_id}`,
        },
      },
      flags.json,
      io,
    );
    return result.command.exit_code === 0 ? 0 : result.command.exit_code || 1;
  }

  if (subcommand === "run") {
    if (!flags.all && positional.length < 1) {
      io.stderr.write(
        "Usage: heart benchmark run [--all] [--baseline-run RUN_ID] [--assisted-run RUN_ID] [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <scenario-name-or-path>\n",
      );
      return 1;
    }

    const repoRoot = resolveRepoRoot(flags.root, io.cwd);
    if ((flags.baselineRun || flags.assistedRun) && flags.all) {
      io.stderr.write("Observed run ids cannot be combined with --all.\n");
      return 1;
    }
    if ((flags.baselineRun && !flags.assistedRun) || (!flags.baselineRun && flags.assistedRun)) {
      io.stderr.write("Both --baseline-run and --assisted-run are required for observed benchmark reports.\n");
      return 1;
    }
    if (flags.all) {
      const suiteResult = await runBenchmarkSuite({
        repoRoot,
        repo: path.basename(repoRoot),
        profile_slug: flags.slug ?? path.basename(repoRoot),
        provider: flags.provider,
        model: flags.model,
      });
      const persisted_reports = [];

      for (const scenarioRun of suiteResult.scenario_runs) {
        const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, scenarioRun.report, {
          baselineInput: scenarioRun.scenario.baseline,
          assistedInput: scenarioRun.scenario.assisted,
          evaluation: {
            scenario_path: scenarioRun.scenario.path,
          },
          scenario: scenarioRun.scenario,
          dataset: scenarioRun.dataset,
        });
        const reportWithEvidence = {
          ...scenarioRun.report,
          evidence_bundle: evidenceBundle,
        };
        const persisted = await writeBenchmarkReport(repoRoot, reportWithEvidence);
        const syncedDestinations = await publishBenchmarkReport({
          report: reportWithEvidence,
          repoRoot,
          portalRoot: flags.portalRoot,
          adminRoot: flags.adminRoot,
        });
        persisted_reports.push({
          report: reportWithEvidence,
          persisted,
          synced_destinations: syncedDestinations,
        });
      }

      const suitePersisted = await writeBenchmarkSuiteReport(repoRoot, suiteResult.suite);
      writeOutput(
        {
          suite: suiteResult.suite,
          suite_persisted: suitePersisted,
          scenario_reports: persisted_reports,
        },
        flags.json,
        io,
      );
      return 0;
    }

    const scenarioRef = positional[0];
    const scenario = await loadBenchmarkScenario(scenarioRef, repoRoot);
    const observedBaseline = flags.baselineRun
      ? await loadObservedRunSummary({
          serviceStorageRoot: resolveServiceStorageRoot({ repoRoot }),
          runId: flags.baselineRun,
        })
      : null;
    const observedAssisted = flags.assistedRun
      ? await loadObservedRunSummary({
          serviceStorageRoot: resolveServiceStorageRoot({ repoRoot }),
          runId: flags.assistedRun,
        })
      : null;
    const baselineInput = mergeObservedRunIntoBenchmarkInput(scenario.baseline, observedBaseline);
    const assistedInput = mergeObservedRunIntoBenchmarkInput(scenario.assisted, observedAssisted);
    const report = await runBenchmarkScenario(scenarioRef, {
      repoRoot,
      repo: path.basename(repoRoot),
      profile_slug: flags.slug ?? path.basename(repoRoot),
      scenario: flags.scenario,
      provider: flags.provider,
      model: flags.model,
      scenarioManifest: scenario,
      baselineObservedRun: observedBaseline,
      assistedObservedRun: observedAssisted,
    });
    const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, report, {
      baselineInput,
      assistedInput,
      evaluation: {
        scenario_path: scenario.path,
        baseline_run_id: flags.baselineRun,
        assisted_run_id: flags.assistedRun,
      },
      scenario,
      dataset: scenario.dataset ?? null,
    });
    const reportWithEvidence = {
      ...report,
      evidence_bundle: evidenceBundle,
    };
    const persisted = await writeBenchmarkReport(repoRoot, reportWithEvidence);
    const syncedDestinations = await publishBenchmarkReport({
      report: reportWithEvidence,
      repoRoot,
      portalRoot: flags.portalRoot,
      adminRoot: flags.adminRoot,
    });

    writeOutput(
      {
        report: reportWithEvidence,
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
      "Usage: heart benchmark run [--all] [--baseline-run RUN_ID] [--assisted-run RUN_ID] [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <scenario-name-or-path>\n",
    );
    io.stderr.write(
      "       heart benchmark capture <baseline|assisted> <scenario-name-or-path> [--json] [--root PATH] [--slug NAME] [--provider NAME] [--model NAME] --upstream-base-url URL -- <command ...>\n",
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
  const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, report, {
    baselineInput: baseline,
    assistedInput: assisted,
    evaluation: {
      baseline_source: baselinePath,
      assisted_source: assistedPath,
    },
  });
  const reportWithEvidence = {
    ...report,
    evidence_bundle: evidenceBundle,
  };
  const persisted = await writeBenchmarkReport(repoRoot, reportWithEvidence);
  const syncedDestinations = await publishBenchmarkReport({
    report: reportWithEvidence,
    repoRoot,
    portalRoot: flags.portalRoot,
    adminRoot: flags.adminRoot,
  });

  writeOutput(
    {
      report: reportWithEvidence,
      persisted,
      synced_destinations: syncedDestinations,
    },
    flags.json,
    io,
  );
  return 0;
}

async function handleAgent(subcommand, flags, positional, io) {
  if (subcommand !== "run") {
    io.stderr.write(
      "Usage: heart agent run [--json] [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME] [--scenario TEXT] [--dataset TEXT] [--mode baseline|assisted] [--provider NAME] [--model NAME] [--agent-client NAME] [--input-cost-per-1m USD] [--cached-input-cost-per-1m USD] [--output-cost-per-1m USD] --upstream-base-url URL -- <command ...>\n",
    );
    return 1;
  }

  if (!flags.upstreamBaseUrl || !Array.isArray(flags.command) || flags.command.length === 0) {
    io.stderr.write(
      "Usage: heart agent run [--json] [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME] [--scenario TEXT] [--dataset TEXT] [--mode baseline|assisted] [--provider NAME] [--model NAME] [--agent-client NAME] [--input-cost-per-1m USD] [--cached-input-cost-per-1m USD] [--output-cost-per-1m USD] --upstream-base-url URL -- <command ...>\n",
    );
    return 1;
  }

  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const payload = await executeAgentRunCapture({
    repoRoot,
    slug: flags.slug,
    workspace: flags.workspace,
    customer: flags.customer,
    scenario: flags.scenario,
    dataset: flags.dataset,
    mode: flags.mode,
    provider: flags.provider,
    model: flags.model,
    agentClient: flags.agentClient,
    upstreamBaseUrl: flags.upstreamBaseUrl,
    command: flags.command,
    pricing: createPricingConfig(flags),
  });

  writeOutput(payload, flags.json, io);
  return payload.command.exit_code === 0 ? 0 : payload.command.exit_code || 1;
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
  const payload = normalizeConnectDetectionForCli(result, repoRoot);

  if (flags.agents && !flags.models) {
    payload.models = [];
  }

  if (flags.models && !flags.agents) {
    payload.agents = [];
  }

  writeOutput(payload, flags.json, io);
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
    const payload = normalizeConnectVerificationForCli(result);

    if (flags.backup) {
      payload.backups = backups;
    }

    writeOutput(payload, flags.json, io);
    return connectVerificationExitCode(payload);
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

  const payload = normalizeConnectVerificationForCli(result);
  writeOutput(payload, flags.json, io);
  return connectVerificationExitCode(payload);
}

async function handleConnectDoctor(flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);
  const detection = await detectConnections({ repoRoot });
  const inventory = normalizeConnectDetectionForCli(detection, repoRoot);
  const result = {
    repo_root: repoRoot,
    heart_binary: {
      command: "heart",
      resolved_path: process.argv[1] ?? null,
      available: Boolean(process.argv[1]),
    },
    inventory,
    warnings: inventory.warnings,
    actions: buildConnectDoctorActions(inventory),
    status: inventory.warnings.length > 0 ? "partial" : "ready",
  };

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
      "Usage: heart auth provider-session --url BASE_URL [--provider NAME] [--surface portal|admin] [--workspace NAME] [--customer NAME] [--id-token TOKEN] [--out PATH]\n",
    );
    return 1;
  }

  const idToken = flags.idToken ?? positional[0];
  if (!flags.url || !idToken) {
    io.stderr.write(
      "Usage: heart auth provider-session --url BASE_URL [--provider NAME] [--surface portal|admin] [--workspace NAME] [--customer NAME] [--id-token TOKEN] [--out PATH]\n",
    );
    return 1;
  }

  if (flags.issuer || flags.audience) {
    io.stderr.write(
      "Hosted auth exchange no longer accepts --issuer or --audience overrides. Configure the provider on the service and use --provider NAME instead.\n",
    );
    return 1;
  }

  const result = await exchangeProviderSessionRemote({
    baseUrl: flags.url,
    idToken,
    workspaceSlug: flags.workspace ?? flags.slug,
    customerSlug: flags.customer,
    providerId: flags.provider,
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
      workspaceMetadata: {
        benchmark_runner: {
          repo_root: repoRoot,
          connected_at: profile.generated_at,
          source: "remote-profile-sync",
        },
      },
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

  const scenario = await loadBenchmarkScenario(positional[0], repoRoot);
  const scenarioReport = await runBenchmarkScenario(positional[0], {
    repoRoot,
    repo: path.basename(repoRoot),
    profile_slug: profileSlug,
    scenario: flags.scenario,
    provider: flags.provider,
    model: flags.model,
    scenarioManifest: scenario,
  });
  const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, scenarioReport, {
    baselineInput: scenario.baseline,
    assistedInput: scenario.assisted,
    evaluation: {
      scenario_path: scenario.path,
    },
    scenario,
    dataset: scenario.dataset ?? null,
  });
  const report = {
    ...prepareBenchmarkReportArtifact({
      ...scenarioReport,
      evidence_bundle: evidenceBundle,
    }),
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
  const flagDefinitions = createFlagDefinitions();

  while (tokens.length > 0) {
    const token = tokens.shift();

    if (token === "--") {
      flags.command = [...tokens];
      break;
    }

    if (token.startsWith("--")) {
      const definition = flagDefinitions[token];
      if (!definition) {
        return {
          error: `Unknown flag: ${token}`,
          command,
          subcommand,
          flags,
          positional,
        };
      }

      if (definition.type === "boolean") {
        flags[definition.key] = true;
      } else {
        const rawValue = tokens.shift();
        if (rawValue === undefined || rawValue.startsWith("--")) {
          return {
            error: `${token} requires a value.`,
            command,
            subcommand,
            flags,
            positional,
          };
        }

        if (definition.type === "positiveInteger") {
          const parsedValue = Number(rawValue);
          if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
            return {
              error: `${token} must be a positive integer.`,
              command,
              subcommand,
              flags,
              positional,
            };
          }

          flags[definition.key] = parsedValue;
        } else {
          flags[definition.key] = definition.type === "number" ? Number(rawValue) : rawValue;
        }
      }
      continue;
    }

    if (!command) {
      command = token;
      continue;
    }

    if (
      (command === "mcp" ||
        command === "connect" ||
        command === "docs" ||
        command === "diagram" ||
        command === "benchmark" ||
        command === "agent" ||
        command === "service" ||
        command === "auth" ||
        command === "sync" ||
        command === "policy" ||
        command === "find") &&
      !subcommand
    ) {
      subcommand = token;
      continue;
    }

    positional.push(token);
  }

  const validationError = validateAllowedFlags(command, subcommand, flags);
  if (validationError) {
    return {
      error: validationError,
      command,
      subcommand,
      flags,
      positional,
    };
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

Getting Started:
  heart init [--json] [--force] [--root PATH]
  heart doctor [--json] [--root PATH]
  heart scan [--json] [--rebuild] [--root PATH]
  heart overview [--json] [--root PATH]

Core Inspection:
  heart find symbol [--json] [--root PATH] <query>
  heart deps [--json] [--root PATH] <file-or-symbol>
  heart impact [--json] [--root PATH] <file-or-symbol>
  heart policy check [--json] [--root PATH]
  heart pack [--json] [--token-budget N] [--root PATH] <task description>

Agent Workflow:
  heart connect detect [--json] [--agents] [--models] [--root PATH]
  heart connect install --client NAME [--scope user|repo] [--model NAME] [--dry-run] [--backup] [--json] [--root PATH]
  heart connect verify --client NAME [--scope user|repo] [--json] [--root PATH]
  heart connect doctor [--json] [--root PATH]
  heart mcp tools [--json] [--root PATH]
  heart mcp serve [--root PATH]

Benchmark:
  heart benchmark run [--all] [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--baseline-run RUN_ID] [--assisted-run RUN_ID] [--portal-root PATH] [--admin-root PATH] <scenario-name-or-path>
  heart benchmark compare [--json] [--root PATH] [--slug NAME] [--scenario TEXT] [--provider NAME] [--model NAME] [--portal-root PATH] [--admin-root PATH] <baseline.json> <assisted.json>

Additional Commands:
  heart diagram generate [all|symbol-graph|high-level|component|class|sequence] [--json] [--task TEXT] [--target NAME] [--root PATH]
  heart diagram sync [--json] [--slug NAME] [--portal-root PATH] [--admin-root PATH] [--task TEXT] [--target NAME] [--root PATH]
  heart benchmark capture <baseline|assisted> <scenario-name-or-path> [--json] [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME] [--provider NAME] [--model NAME] [--agent-client NAME] [--input-cost-per-1m USD] [--cached-input-cost-per-1m USD] [--output-cost-per-1m USD] --upstream-base-url URL -- <command ...>
  heart agent run [--json] [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME] [--scenario TEXT] [--dataset TEXT] [--mode baseline|assisted] [--provider NAME] [--model NAME] [--agent-client NAME] [--input-cost-per-1m USD] [--cached-input-cost-per-1m USD] [--output-cost-per-1m USD] --upstream-base-url URL -- <command ...>
  heart docs search [--json] [--root PATH] <query>
  heart docs import [--json] [--root PATH] [--slug NAME] [--category NAME] [--title TEXT] [--summary TEXT] [--portal-root PATH] [--admin-root PATH] <source-file>
  heart docs sync-web [--json] [--root PATH] [--slug NAME] [--portal-root PATH] [--admin-root PATH]
  heart auth provider-session --url BASE_URL [--provider NAME] [--surface portal|admin] [--workspace NAME] [--customer NAME] [--id-token TOKEN] [--out PATH]
  heart sync profile --url BASE_URL --session TOKEN [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME]
  heart sync docs --url BASE_URL --session TOKEN [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME]
  heart sync benchmark --url BASE_URL --session TOKEN [--root PATH] [--slug NAME] [--workspace NAME] [--customer NAME] [--scenario TEXT] [--provider NAME] [--model NAME] <scenario-name-or-path>
  heart service export [--json] [--root PATH] [--out PATH]

Examples:
  heart init --root .
  heart doctor --root .
  heart pack --token-budget 1200 "add login audit logging"
  heart connect detect --root .
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

function normalizeConnectDetectionForCli(result, repoRoot) {
  const agents = Array.isArray(result?.agents)
    ? result.agents.filter((agent) => agent?.detected || agent?.configured)
    : [];
  const models = Array.isArray(result?.models) ? result.models : [];
  const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
  const recommendations =
    Array.isArray(result?.recommendations) && result.recommendations.length > 0
      ? result.recommendations
      : agents.length === 0 && models.length === 0
        ? [`heart connect install --client cursor --scope repo --root ${repoRoot}`]
        : [];

  return {
    repo_root: result?.repo_root ?? repoRoot,
    agents,
    models,
    warnings,
    recommendations,
  };
}

function normalizeConnectVerificationForCli(result) {
  const normalizeStep = (value) => (value === "ok" ? "ready" : value);
  return {
    ...result,
    config_status: normalizeStep(result?.config_status),
    spawn_status: normalizeStep(result?.spawn_status),
    initialize_status: normalizeStep(result?.initialize_status),
    tools_list_status: normalizeStep(result?.tools_list_status),
    model_runtime_status: normalizeStep(result?.model_runtime_status),
  };
}

function buildConnectDoctorActions(inventory) {
  if ((inventory?.agents?.length ?? 0) === 0) {
    return [`Run ${inventory.recommendations?.[0] ?? "heart connect install --client cursor --scope repo"}`];
  }

  if (!inventory.agents.some((agent) => agent.configured)) {
    const firstAgent = inventory.agents[0];
    return [
      `Install BeHeart MCP for ${firstAgent.display_name ?? firstAgent.id} before running verification.`,
      `Run heart connect install --client ${firstAgent.id} --scope repo --root ${inventory.repo_root}`,
    ];
  }

  const configured = inventory.agents.find((agent) => agent.configured) ?? inventory.agents[0];
  return [
    `Run heart connect verify --client ${configured.id} --scope repo --root ${inventory.repo_root}`,
  ];
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

async function executeAgentRunCapture({
  repoRoot,
  slug,
  workspace,
  customer,
  scenario,
  dataset,
  mode,
  provider,
  model,
  agentClient,
  upstreamBaseUrl,
  command,
  pricing,
} = {}) {
  const monorepoRoot = resolveMonorepoRoot(repoRoot);
  const serviceStorageRoot = resolveServiceStorageRoot({ repoRoot });
  const runId = createAgentRunId(slug ?? path.basename(repoRoot));
  const normalizedProvider = String(provider ?? "openai").trim().toLowerCase();
  const normalizedModel = String(model ?? "").trim();
  const profileSlug = String(slug ?? path.basename(repoRoot));
  const workspaceSlug = String(workspace ?? profileSlug);
  const customerSlug = String(customer ?? workspaceSlug);
  const normalizedMode = String(mode ?? "baseline");
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  const serviceHost = await startServiceHost({
    monorepoRoot,
    serviceStorageRoot,
    port: 0,
  });
  let commandResult = {
    exit_code: 1,
    signal: null,
    stdout: "",
    stderr: "",
  };

  await writeAgentRunRecord({
    serviceStorageRoot,
    run: {
      run_id: runId,
      profile_slug: profileSlug,
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
      repo: path.basename(repoRoot),
      scenario_id: String(scenario ?? ""),
      dataset_id: String(dataset ?? ""),
      mode: normalizedMode,
      status: "running",
      provider: normalizedProvider,
      model: normalizedModel,
      agent_client: String(agentClient ?? "shell"),
      upstream_base_url: String(upstreamBaseUrl ?? ""),
      created_at: startedAtIso,
      started_at: startedAtIso,
      pricing: pricing ?? {},
      command: {
        argv: command,
        cwd_hash: hashValue(repoRoot),
      },
    },
  });

  const proxyBaseUrl = `${serviceHost.url}/proxy/openai/runs/${runId}/v1`;
  try {
    commandResult = await runObservedCommand(command, {
      cwd: repoRoot,
      env: {
        ...process.env,
        OPENAI_BASE_URL: proxyBaseUrl,
        OPENAI_API_BASE: proxyBaseUrl,
        OPENAI_API_BASE_URL: proxyBaseUrl,
        BE_AI_HEART_AGENT_RUN_ID: runId,
        BE_AI_HEART_BENCHMARK_MODE: normalizedMode,
        BE_AI_HEART_BENCHMARK_SCENARIO: String(scenario ?? ""),
      },
    });
  } finally {
    await closeServiceHost(serviceHost.server);
  }

  const endedAtIso = new Date().toISOString();
  const capture = await loadAgentRunCapture({
    serviceStorageRoot,
    runId,
  });
  const persistedRun = await writeAgentRunRecord({
    serviceStorageRoot,
    run: {
      ...(capture?.run ?? {}),
      run_id: runId,
      profile_slug: profileSlug,
      workspace_slug: workspaceSlug,
      customer_slug: customerSlug,
      repo: path.basename(repoRoot),
      scenario_id: String(scenario ?? ""),
      dataset_id: String(dataset ?? ""),
      mode: normalizedMode,
      status: commandResult.exit_code === 0 ? "completed" : "failed",
      provider: normalizedProvider,
      model: normalizedModel,
      agent_client: String(agentClient ?? "shell"),
      upstream_base_url: String(upstreamBaseUrl ?? ""),
      created_at: startedAtIso,
      started_at: startedAtIso,
      ended_at: endedAtIso,
      exit_code: commandResult.exit_code,
      total_tokens: capture?.summary?.total_tokens ?? 0,
      token_cost_usd: capture?.summary?.token_cost_usd ?? 0,
      observed_usage_coverage_pct: capture?.summary?.observed_usage_coverage_pct ?? 0,
      pricing: pricing ?? capture?.run?.pricing ?? {},
      measurement: capture?.summary ?? {},
      command: {
        argv: command,
        cwd_hash: hashValue(repoRoot),
      },
    },
  });
  const refreshedCapture = await loadAgentRunCapture({
    serviceStorageRoot,
    runId,
  });
  const summary = refreshedCapture?.summary ?? {
    run_id: runId,
    measurement_mode: "estimated",
    total_tokens: 0,
  };

  return {
    run: persistedRun,
    proxy: {
      provider: normalizedProvider,
      base_url: proxyBaseUrl,
      upstream_base_url: upstreamBaseUrl,
      service_url: serviceHost.url,
    },
    command: {
      argv: command,
      exit_code: commandResult.exit_code,
      signal: commandResult.signal,
      duration_ms: Date.now() - startedAt,
      stdout: commandResult.stdout,
      stderr: commandResult.stderr,
    },
    summary,
  };
}

async function writeAgentRunCaptureArtifact(repoRoot, capture = {}) {
  const captureRoot = path.join(repoRoot, ".heart", "benchmarks", "captures");
  await fs.mkdir(captureRoot, { recursive: true });

  const payload = {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    scenario: compactObject({
      id: capture.scenario?.id ?? capture.run?.scenario_id,
      title: capture.scenario?.title,
      path: capture.scenario?.path,
      dataset_id: capture.scenario?.dataset_id ?? capture.scenario?.dataset?.id ?? capture.run?.dataset_id,
    }),
    mode: String(capture.mode ?? capture.run?.mode ?? ""),
    run: capture.run ?? null,
    summary: capture.summary ?? null,
    proxy: capture.proxy ?? null,
    command: capture.command ?? null,
  };
  const capturePath = path.join(captureRoot, `${capture.run?.run_id ?? createAgentRunId("capture")}.json`);
  await fs.writeFile(capturePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return {
    capture_root: captureRoot,
    capture_path: capturePath,
  };
}

async function loadObservedRunSummary({ serviceStorageRoot, runId } = {}) {
  const capture = await loadAgentRunCapture({
    serviceStorageRoot,
    runId,
  });
  if (!capture) {
    throw new Error(`Observed agent run not found: ${runId}`);
  }
  return {
    ...capture.summary,
    run_id: capture.run.run_id,
    provider: capture.run.provider || capture.summary.provider,
    model: capture.run.model || capture.summary.model,
    source: "agent_run",
  };
}

function createPricingConfig(flags = {}) {
  const pricing = compactObject({
    input_cost_per_1m: finiteNumberOrNull(flags.inputCostPer1m),
    cached_input_cost_per_1m: finiteNumberOrNull(flags.cachedInputCostPer1m),
    output_cost_per_1m: finiteNumberOrNull(flags.outputCostPer1m),
  });
  return Object.keys(pricing).length > 0 ? pricing : {};
}

function createAgentRunId(slug) {
  return `${sanitizeSlug(slug || "agent-run")}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function resolveMonorepoRoot(repoRoot) {
  const normalizedRepoRoot = path.resolve(repoRoot);
  return hasServiceApi(normalizedRepoRoot) ? normalizedRepoRoot : path.dirname(normalizedRepoRoot);
}

function hasServiceApi(root) {
  try {
    return Boolean(process.getBuiltinModule("fs").existsSync(path.join(root, "services", "api")));
  } catch {
    return false;
  }
}

async function closeServiceHost(server) {
  await new Promise((resolve) => server.close(resolve));
}

function hashValue(value) {
  return Buffer.from(String(value ?? ""), "utf8").toString("base64url");
}

async function runObservedCommand(command, { cwd, env }) {
  return await new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      stderr += String(error?.message ?? error);
      resolve({
        exit_code: 1,
        signal: null,
        stdout,
        stderr,
      });
    });
    child.on("close", (code, signal) => {
      resolve({
        exit_code: code ?? 1,
        signal: signal ?? null,
        stdout,
        stderr,
      });
    });
  });
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundNumber(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(numberOrZero(value) * factor) / factor;
}

function finiteNumberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""));
}

function sanitizeSlug(value) {
  return String(value ?? "heart")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "heart";
}

function createFlagDefinitions() {
  return {
    "--json": { key: "json", type: "boolean" },
    "--help": { key: "help", type: "boolean" },
    "--force": { key: "force", type: "boolean" },
    "--rebuild": { key: "rebuild", type: "boolean" },
    "--all": { key: "all", type: "boolean" },
    "--agents": { key: "agents", type: "boolean" },
    "--models": { key: "models", type: "boolean" },
    "--dry-run": { key: "dryRun", type: "boolean" },
    "--backup": { key: "backup", type: "boolean" },
    "--root": { key: "root", type: "string" },
    "--task": { key: "task", type: "string" },
    "--target": { key: "target", type: "string" },
    "--token-budget": { key: "tokenBudget", type: "positiveInteger" },
    "--scope": { key: "scope", type: "string" },
    "--slug": { key: "slug", type: "string" },
    "--category": { key: "category", type: "string" },
    "--title": { key: "title", type: "string" },
    "--summary": { key: "summary", type: "string" },
    "--scenario": { key: "scenario", type: "string" },
    "--dataset": { key: "dataset", type: "string" },
    "--mode": { key: "mode", type: "string" },
    "--provider": { key: "provider", type: "string" },
    "--model": { key: "model", type: "string" },
    "--client": { key: "client", type: "string" },
    "--agent-client": { key: "agentClient", type: "string" },
    "--baseline-run": { key: "baselineRun", type: "string" },
    "--assisted-run": { key: "assistedRun", type: "string" },
    "--upstream-base-url": { key: "upstreamBaseUrl", type: "string" },
    "--input-cost-per-1m": { key: "inputCostPer1m", type: "number" },
    "--cached-input-cost-per-1m": { key: "cachedInputCostPer1m", type: "number" },
    "--output-cost-per-1m": { key: "outputCostPer1m", type: "number" },
    "--url": { key: "url", type: "string" },
    "--session": { key: "session", type: "string" },
    "--workspace": { key: "workspace", type: "string" },
    "--customer": { key: "customer", type: "string" },
    "--surface": { key: "surface", type: "string" },
    "--id-token": { key: "idToken", type: "string" },
    "--issuer": { key: "issuer", type: "string" },
    "--audience": { key: "audience", type: "string" },
    "--portal-root": { key: "portalRoot", type: "string" },
    "--admin-root": { key: "adminRoot", type: "string" },
    "--out": { key: "out", type: "string" },
  };
}

function validateAllowedFlags(command, subcommand, flags) {
  if (!command) {
    return null;
  }

  const allowedFlags = resolveAllowedFlags(command, subcommand);
  if (!allowedFlags) {
    return null;
  }

  const invalidFlag = Object.keys(flags).find((flag) => flag !== "command" && !allowedFlags.has(flag));
  if (!invalidFlag) {
    return null;
  }

  return `Flag --${toKebabCase(invalidFlag)} is not supported for ${formatCommandPath(command, subcommand)}.`;
}

function resolveAllowedFlags(command, subcommand) {
  const directAllowlists = {
    init: new Set(["json", "force", "root"]),
    doctor: new Set(["json", "root"]),
    scan: new Set(["json", "rebuild", "root"]),
    overview: new Set(["json", "root"]),
    deps: new Set(["json", "root"]),
    impact: new Set(["json", "root"]),
    pack: new Set(["json", "root", "tokenBudget"]),
  };

  if (directAllowlists[command]) {
    return directAllowlists[command];
  }

  const nestedAllowlists = {
    find: {
      symbol: new Set(["json", "root"]),
    },
    policy: {
      check: new Set(["json", "root"]),
    },
    diagram: {
      generate: new Set(["json", "task", "target", "root"]),
      sync: new Set(["json", "slug", "portalRoot", "adminRoot", "task", "target", "root"]),
    },
    benchmark: {
      run: new Set([
        "all",
        "json",
        "root",
        "slug",
        "scenario",
        "provider",
        "model",
        "portalRoot",
        "adminRoot",
        "baselineRun",
        "assistedRun",
      ]),
      compare: new Set(["json", "root", "slug", "scenario", "provider", "model", "portalRoot", "adminRoot"]),
      capture: new Set([
        "json",
        "root",
        "slug",
        "workspace",
        "customer",
        "provider",
        "model",
        "agentClient",
        "upstreamBaseUrl",
        "inputCostPer1m",
        "cachedInputCostPer1m",
        "outputCostPer1m",
      ]),
    },
    agent: {
      run: new Set([
        "json",
        "root",
        "slug",
        "workspace",
        "customer",
        "scenario",
        "dataset",
        "mode",
        "provider",
        "model",
        "agentClient",
        "upstreamBaseUrl",
        "inputCostPer1m",
        "cachedInputCostPer1m",
        "outputCostPer1m",
      ]),
    },
    docs: {
      search: new Set(["json", "root"]),
      import: new Set(["json", "root", "slug", "category", "title", "summary", "portalRoot", "adminRoot"]),
      "sync-web": new Set(["json", "root", "slug", "portalRoot", "adminRoot"]),
    },
    auth: {
      "provider-session": new Set(["json", "url", "provider", "surface", "workspace", "customer", "idToken", "out"]),
    },
    sync: {
      profile: new Set(["json", "url", "session", "root", "slug", "workspace", "customer"]),
      docs: new Set(["json", "url", "session", "root", "slug", "workspace", "customer"]),
      benchmark: new Set(["json", "url", "session", "root", "slug", "workspace", "customer", "scenario", "provider", "model"]),
    },
    service: {
      export: new Set(["json", "root", "out"]),
    },
    mcp: {
      tools: new Set(["json", "root"]),
      serve: new Set(["root"]),
    },
    connect: {
      detect: new Set(["json", "root", "agents", "models"]),
      install: new Set(["json", "root", "client", "scope", "model", "dryRun", "backup"]),
      verify: new Set(["json", "root", "client", "scope", "model"]),
      doctor: new Set(["json", "root"]),
    },
  };

  return nestedAllowlists[command]?.[subcommand ?? defaultSubcommandFor(command)] ?? null;
}

function defaultSubcommandFor(command) {
  if (command === "mcp") {
    return "tools";
  }

  return null;
}

function formatCommandPath(command, subcommand) {
  return subcommand ? `heart ${command} ${subcommand}` : `heart ${command}`;
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function formatInitOutput(payload) {
  const lines = [
    payload.created === false ? `Heart already initialized in ${payload.repo_root}` : `Initialized heart in ${payload.repo_root}`,
    `Config: ${payload.config_path}`,
    `Policies: ${payload.policy_path}`,
    `Detected: ${formatDetectedEnvironment(payload.detected)}`,
    "Next:",
    ...payload.next_commands.map((command) => `  ${command}`),
  ];

  if (payload.created === false && payload.message) {
    lines.splice(1, 0, payload.message);
  }

  return lines.join("\n");
}

function formatDoctorOutput(payload) {
  return [
    `Doctor summary for ${payload.repo_root}`,
    `Config: ${payload.config.status} (${payload.config.path})`,
    `Policies: ${payload.policy.status} (${payload.policy.path})`,
    `Detected: ${formatDetectedEnvironment(payload.detected)}`,
    `Document roots: ${payload.document_roots.join(", ") || "none"}`,
    `Ignore paths: ${payload.ignore_paths.join(", ") || "none"}`,
    `Cache: ${payload.cache.status} (${payload.cache.path})`,
    `MCP tools: ${payload.mcp.effective_enabled_tools.join(", ") || "none enabled"}`,
    `Warnings: ${payload.warnings.length > 0 ? payload.warnings.join(" | ") : "none"}`,
    "Next:",
    ...payload.actions.map((action) => `  ${action}`),
  ].join("\n");
}

function formatPackOutput(payload, repoRoot) {
  const topFiles = payload.relevant_files.slice(0, 3).map((file) => file.path).join(", ") || "none";
  const topSymbols = payload.relevant_symbols.slice(0, 4).map((symbol) => symbol.name).join(", ") || "none";
  const topDocs = payload.relevant_documents.slice(0, 2).map((document) => document.path).join(", ") || "none";

  return [
    `Summary: ${payload.summary}`,
    `Top files: ${topFiles}`,
    `Top symbols: ${topSymbols}`,
    `Top docs: ${topDocs}`,
    `Warnings: ${payload.risks.join(" | ")}`,
    "Next:",
    `  heart deps --root ${repoRoot} ${payload.relevant_files[0]?.path ?? "path/to/file"}`,
    `  heart policy check --root ${repoRoot}`,
  ].join("\n");
}

function formatNotFoundAwareOutput(command, payload, repoRoot) {
  if (payload.found !== false) {
    return formatObject(payload);
  }

  return [
    `Target not found for ${command}: ${payload.target}`,
    `Next: heart find symbol --root ${repoRoot} ${payload.target}`,
  ].join("\n");
}

function formatMcpToolsOutput(payload) {
  return [
    `MCP tools for ${payload.repo_root}`,
    `Enabled: ${payload.enabled_tools.join(", ") || "none"}`,
    `Disabled: ${payload.disabled_tools.join(", ") || "none"}`,
  ].join("\n");
}

function formatConnectDetectOutput(payload) {
  return [
    `Connect detect for ${payload.repo_root}`,
    `Agents: ${payload.agents.length > 0 ? payload.agents.map((agent) => agent.display_name).join(", ") : "none detected"}`,
    `Models: ${payload.models.length > 0 ? payload.models.map((model) => model.display_name).join(", ") : "none detected"}`,
    `Next: heart connect doctor --root ${payload.repo_root}`,
  ].join("\n");
}

function formatConnectInstallPlanOutput(plan) {
  return [
    `Connect install plan for ${plan.client}`,
    `Scope: ${plan.scope}`,
    `Config: ${plan.config_path}`,
    `Command: ${plan.mcp_entry.command} ${plan.mcp_entry.args.join(" ")}`,
  ].join("\n");
}

function formatConnectInstallOutput(payload) {
  return [
    `Connect install status: ${payload.status}`,
    `Config: ${payload.plan.config_path}`,
    `Verification: ${payload.verification.status}`,
  ].join("\n");
}

function formatConnectVerifyOutput(payload) {
  return [
    `Connect verify for ${payload.client}`,
    `Config: ${payload.config_status}`,
    `Initialize: ${payload.initialize_status}`,
    `Tools: ${payload.tools_list_status}`,
    `Status: ${payload.status}`,
  ].join("\n");
}

function formatConnectDoctorOutput(payload) {
  return [
    `Connect doctor for ${payload.repo_root}`,
    `Heart binary: ${payload.heart_binary.available ? "available" : "missing"} (${payload.heart_binary.resolved_path ?? "unresolved"})`,
    `Agents detected: ${payload.inventory.agents.length}`,
    "Next:",
    ...payload.actions.map((action) => `  ${action}`),
  ].join("\n");
}

function formatDetectedEnvironment(detected) {
  const language = detected?.primary_language ?? "unknown";
  const runtime = detected?.runtime ?? "unknown";
  return `${language} on ${runtime}`;
}
