import { existsSync } from "node:fs";
import { Buffer } from "node:buffer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

import {
  loadBenchmarkScenario,
  listBenchmarkScenarios,
  mergeObservedRunIntoBenchmarkInput,
  prepareBenchmarkReportArtifact,
  runBenchmarkScenario,
  writeBenchmarkEvidenceBundle,
  writeBenchmarkReport,
} from "../../../packages/benchmark/src/index.js";
import { loadWorkspaceIdentity } from "./identity.js";
import {
  loadAgentRunCapture,
  loadAgentRunRecord,
  loadBenchmarkLaunchRecord,
  listBenchmarkLaunchRecords,
  writeAgentRunRecord,
  writeAuditEvent,
  writeBenchmarkLaunchRecord,
} from "./storage.js";
import { writeBenchmarkReportForActor } from "./write-access.js";

const DEFAULT_LAUNCH_LIMIT = 20;

export async function resolveWorkspaceBenchmarkRunnerCapability({
  serviceStorageRoot,
  workspaceIdentity,
} = {}) {
  const identity = workspaceIdentity;
  const runnerMetadata = identity?.metadata?.benchmark_runner ?? {};
  const repoRoot = resolveAccessibleRepoRoot(runnerMetadata.repo_root);
  const repoConnected = Boolean(repoRoot);
  const scenarios = repoConnected ? await listBenchmarkScenarios(repoRoot) : [];

  let runnerStatus = "ready";
  let reason = "";
  if (!identity?.workspace_slug) {
    runnerStatus = "workspace_unavailable";
    reason = "The requested workspace is not available to the current session.";
  } else if (!runnerMetadata.repo_root) {
    runnerStatus = "repo_path_missing";
    reason = "This workspace has not registered a local repository path with the service yet.";
  } else if (!repoConnected) {
    runnerStatus = "repo_unreachable";
    reason = "The service cannot access the synced local repository path on this host.";
  } else if (scenarios.length === 0) {
    runnerStatus = "scenario_missing";
    reason = "No benchmark scenarios were found under benchmarks/scenarios for this repository.";
  }

  return {
    workspace_slug: identity?.workspace_slug ?? "",
    profile_slug: identity?.profile_slug ?? identity?.workspace_slug ?? "",
    customer_slug: identity?.customer_slug ?? "",
    repo: identity?.repo ?? "",
    runner_status: runnerStatus,
    reason,
    local_repo_connected: repoConnected,
    can_launch_observed: repoConnected && scenarios.length > 0,
    can_launch_estimated: repoConnected && scenarios.length > 0,
    measurement_modes: [
      ...(repoConnected && scenarios.length > 0 ? ["observed", "estimated"] : []),
    ],
    connected_at: String(runnerMetadata.connected_at ?? ""),
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      category: scenario.category,
      description: scenario.description,
      dataset_id: scenario.dataset_id,
      provider: scenario.provider,
      model: scenario.model,
    })),
  };
}

export async function listWorkspaceBenchmarkLaunches({
  serviceStorageRoot,
  workspaceSlug,
  customerSlug,
  profileSlug,
  limit = DEFAULT_LAUNCH_LIMIT,
} = {}) {
  return listBenchmarkLaunchRecords({
    serviceStorageRoot,
    workspaceSlug,
    customerSlug,
    profileSlug,
    limit,
    offset: 0,
  }).then((launches) => launches.map((launch) => summarizeBenchmarkLaunchRecord(launch)));
}

export async function loadWorkspaceBenchmarkLaunchDetail({
  serviceStorageRoot,
  launchId,
} = {}) {
  const launch = await loadBenchmarkLaunchRecord({
    serviceStorageRoot,
    launchId,
  });
  if (!launch) {
    return null;
  }

  return hydrateBenchmarkLaunch({
    serviceStorageRoot,
    launch,
  });
}

export async function requestWorkspaceBenchmarkLaunch({
  serviceStorageRoot,
  portalRoot,
  adminRoot,
  apiBaseUrl,
  surface,
  authContext,
  workspaceSlug,
  payload,
} = {}) {
  const safeWorkspaceSlug = sanitizeSlug(workspaceSlug ?? payload?.workspace_slug ?? "");
  if (!safeWorkspaceSlug) {
    throw new Error("workspace_slug is required.");
  }

  const workspaceIdentity =
    authContext?.workspace_identity?.workspace_slug === safeWorkspaceSlug
      ? authContext.workspace_identity
      : await loadWorkspaceIdentity({
          serviceStorageRoot,
          workspaceSlug: safeWorkspaceSlug,
        });
  if (!workspaceIdentity) {
    throw new Error(`Workspace ${safeWorkspaceSlug} is not registered in the hosted service.`);
  }

  const capability = await resolveWorkspaceBenchmarkRunnerCapability({
    serviceStorageRoot,
    workspaceIdentity,
  });
  const measurementMode = normalizeMeasurementMode(payload?.measurement_mode);
  if (measurementMode === "observed" && !capability.can_launch_observed) {
    throw new Error(capability.reason || "Observed benchmark launching is not available for this workspace.");
  }
  if (measurementMode === "estimated" && !capability.can_launch_estimated) {
    throw new Error(capability.reason || "Estimated benchmark launching is not available for this workspace.");
  }

  const scenarioId = String(payload?.scenario ?? "").trim();
  const selectedScenario = capability.scenarios.find((scenario) => scenario.id === scenarioId);
  if (!selectedScenario) {
    throw new Error("A valid benchmark scenario is required.");
  }

  const observedInputs =
    measurementMode === "observed"
      ? {
          upstream_base_url: normalizeHttpUrl(payload?.upstream_base_url, "upstream_base_url"),
          provider: String(payload?.provider ?? selectedScenario.provider ?? "openai").trim().toLowerCase(),
          model: String(payload?.model ?? selectedScenario.model ?? "").trim(),
          agent_client: String(payload?.agent_client ?? "portal-launcher").trim(),
          pricing: normalizePricing(payload?.pricing),
          baseline_command: normalizeCommandArgv(payload?.baseline_command, "baseline_command"),
          assisted_command: normalizeCommandArgv(payload?.assisted_command, "assisted_command"),
        }
      : null;

  const launchId = createBenchmarkLaunchId(workspaceIdentity.profile_slug ?? workspaceIdentity.workspace_slug);
  const launch = await writeBenchmarkLaunchRecord({
    serviceStorageRoot,
    launch: {
      launch_id: launchId,
      workspace_slug: workspaceIdentity.workspace_slug,
      customer_slug: workspaceIdentity.customer_slug,
      profile_slug: workspaceIdentity.profile_slug,
      repo: workspaceIdentity.repo,
      actor_slug: authContext?.actor_slug ?? authContext?.actor?.actor_slug ?? "",
      scenario_id: selectedScenario.id,
      scenario_title: selectedScenario.title,
      measurement_mode: measurementMode,
      status: "queued",
      phase: "queued",
      capability: {
        runner_status: capability.runner_status,
        local_repo_connected: capability.local_repo_connected,
      },
      inputs: {
        provider: observedInputs?.provider ?? selectedScenario.provider ?? "",
        model: observedInputs?.model ?? selectedScenario.model ?? "",
        agent_client: observedInputs?.agent_client ?? "",
        upstream_base_url: observedInputs?.upstream_base_url ?? "",
        pricing: observedInputs?.pricing ?? {},
        baseline_command: observedInputs
          ? summarizeCommandInput(observedInputs.baseline_command)
          : null,
        assisted_command: observedInputs
          ? summarizeCommandInput(observedInputs.assisted_command)
          : null,
      },
      baseline: {
        status: measurementMode === "observed" ? "queued" : "not_applicable",
      },
      assisted: {
        status: measurementMode === "observed" ? "queued" : "not_applicable",
      },
      metadata: {
        requested_from_surface: surface,
      },
    },
  });

  await writeAuditEvent({
    serviceStorageRoot,
    event: {
      action: "benchmark.launch_requested",
      outcome: "accepted",
      surface,
      actor_slug: authContext?.actor?.actor_slug,
      workspace_slug: workspaceIdentity.workspace_slug,
      customer_slug: workspaceIdentity.customer_slug,
      customer_id: workspaceIdentity.customer_id,
      target_type: "benchmark_launch",
      target_id: launchId,
      metadata: {
        scenario: selectedScenario.id,
        measurement_mode: measurementMode,
      },
    },
  });

  queueMicrotask(() => {
    runWorkspaceBenchmarkLaunch({
      serviceStorageRoot,
      portalRoot,
      adminRoot,
      apiBaseUrl,
      surface,
      authContext,
      workspaceIdentity,
      launchId,
      scenarioId: selectedScenario.id,
      measurementMode,
      observedInputs,
    }).catch(() => null);
  });

  return hydrateBenchmarkLaunch({
    serviceStorageRoot,
    launch,
  });
}

async function runWorkspaceBenchmarkLaunch({
  serviceStorageRoot,
  portalRoot,
  adminRoot,
  apiBaseUrl,
  surface,
  authContext,
  workspaceIdentity,
  launchId,
  scenarioId,
  measurementMode,
  observedInputs,
} = {}) {
  const capability = await resolveWorkspaceBenchmarkRunnerCapability({
    serviceStorageRoot,
    workspaceIdentity,
  });
  const repoRoot = resolveAccessibleRepoRoot(workspaceIdentity?.metadata?.benchmark_runner?.repo_root);
  const startedAt = new Date().toISOString();

  try {
    if (!repoRoot) {
      throw new Error(capability.reason || "Benchmark runner is not connected to a local repository.");
    }

    const scenario = await loadBenchmarkScenario(scenarioId, repoRoot);
    await updateBenchmarkLaunch({
      serviceStorageRoot,
      launchId,
      patch: {
        status: "running",
        phase: measurementMode === "observed" ? "baseline" : "report",
        started_at: startedAt,
      },
    });

    if (measurementMode === "estimated") {
      const report = await persistBenchmarkScenarioReport({
        repoRoot,
        serviceStorageRoot,
        portalRoot,
        adminRoot,
        surface,
        authContext,
        workspaceIdentity,
        launchId,
        scenario,
      });
      await finishBenchmarkLaunch({
        serviceStorageRoot,
        surface,
        authContext,
        workspaceIdentity,
        launchId,
        status: "completed",
        report,
      });
      return;
    }

    const baselineResult = await executeObservedAgentRun({
      serviceStorageRoot,
      repoRoot,
      workspaceIdentity,
      launchId,
      scenario,
      phase: "baseline",
      mode: "baseline",
      apiBaseUrl,
      provider: observedInputs.provider,
      model: observedInputs.model,
      agentClient: observedInputs.agent_client,
      upstreamBaseUrl: observedInputs.upstream_base_url,
      command: observedInputs.baseline_command,
      pricing: observedInputs.pricing,
    });
    await updateBenchmarkLaunch({
      serviceStorageRoot,
      launchId,
      patch: {
        phase: "assisted",
        baseline: summarizeObservedLaunchPhase("completed", baselineResult),
      },
    });
    if (baselineResult.command.exit_code !== 0) {
      throw createLaunchFailure("baseline_command_failed", "Baseline command exited with a non-zero status.", {
        baseline: summarizeObservedLaunchPhase("failed", baselineResult),
      });
    }

    const assistedResult = await executeObservedAgentRun({
      serviceStorageRoot,
      repoRoot,
      workspaceIdentity,
      launchId,
      scenario,
      phase: "assisted",
      mode: "assisted",
      apiBaseUrl,
      provider: observedInputs.provider,
      model: observedInputs.model,
      agentClient: observedInputs.agent_client,
      upstreamBaseUrl: observedInputs.upstream_base_url,
      command: observedInputs.assisted_command,
      pricing: observedInputs.pricing,
    });
    await updateBenchmarkLaunch({
      serviceStorageRoot,
      launchId,
      patch: {
        phase: "report",
        assisted: summarizeObservedLaunchPhase("completed", assistedResult),
      },
    });
    if (assistedResult.command.exit_code !== 0) {
      throw createLaunchFailure("assisted_command_failed", "Assisted command exited with a non-zero status.", {
        baseline: summarizeObservedLaunchPhase("completed", baselineResult),
        assisted: summarizeObservedLaunchPhase("failed", assistedResult),
      });
    }

    const report = await persistObservedBenchmarkReport({
      repoRoot,
      serviceStorageRoot,
      portalRoot,
      adminRoot,
      surface,
      authContext,
      workspaceIdentity,
      launchId,
      scenario,
      baselineResult,
      assistedResult,
      provider: observedInputs.provider,
      model: observedInputs.model,
    });
    await finishBenchmarkLaunch({
      serviceStorageRoot,
      surface,
      authContext,
      workspaceIdentity,
      launchId,
      status: "completed",
      baseline: summarizeObservedLaunchPhase("completed", baselineResult),
      assisted: summarizeObservedLaunchPhase("completed", assistedResult),
      report,
    });
  } catch (error) {
    await finishBenchmarkLaunch({
      serviceStorageRoot,
      surface,
      authContext,
      workspaceIdentity,
      launchId,
      status: "failed",
      error,
      baseline: error?.details?.baseline,
      assisted: error?.details?.assisted,
    });
  }
}

async function persistBenchmarkScenarioReport({
  repoRoot,
  serviceStorageRoot,
  portalRoot,
  adminRoot,
  surface,
  authContext,
  workspaceIdentity,
  launchId,
  scenario,
} = {}) {
  const report = await runBenchmarkScenario(scenario.path ?? scenario.id, {
    repoRoot,
    repo: workspaceIdentity.repo || path.basename(repoRoot),
    profile_slug: workspaceIdentity.profile_slug ?? workspaceIdentity.workspace_slug,
    scenarioManifest: scenario,
    provider: scenario.provider,
    model: scenario.model,
  });
  const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, report, {
    baselineInput: scenario.baseline,
    assistedInput: scenario.assisted,
    evaluation: {
      launch_id: launchId,
      measurement_mode: "estimated",
      scenario_path: scenario.path,
    },
    scenario,
    dataset: scenario.dataset ?? null,
  });
  const reportWithEvidence = {
    ...report,
    evidence_bundle: evidenceBundle,
  };
  await writeBenchmarkReport(repoRoot, reportWithEvidence);
  const persisted = await writeBenchmarkReportForActor({
    serviceStorageRoot,
    surface,
    authContext,
    report: prepareBenchmarkReportArtifact({
      ...reportWithEvidence,
      workspace_slug: workspaceIdentity.workspace_slug,
      customer_slug: workspaceIdentity.customer_slug,
      profile_slug: workspaceIdentity.profile_slug ?? workspaceIdentity.workspace_slug,
      repo: workspaceIdentity.repo || path.basename(repoRoot),
    }),
    portalRoot,
    adminRoot,
  });

  return summarizePersistedReport(persisted.report);
}

async function persistObservedBenchmarkReport({
  repoRoot,
  serviceStorageRoot,
  portalRoot,
  adminRoot,
  surface,
  authContext,
  workspaceIdentity,
  launchId,
  scenario,
  baselineResult,
  assistedResult,
  provider,
  model,
} = {}) {
  const report = await runBenchmarkScenario(scenario.path ?? scenario.id, {
    repoRoot,
    repo: workspaceIdentity.repo || path.basename(repoRoot),
    profile_slug: workspaceIdentity.profile_slug ?? workspaceIdentity.workspace_slug,
    provider: provider ?? baselineResult.summary.provider ?? assistedResult.summary.provider ?? scenario.provider,
    model: model ?? baselineResult.summary.model ?? assistedResult.summary.model ?? scenario.model,
    scenarioManifest: scenario,
    baselineObservedRun: baselineResult.summary,
    assistedObservedRun: assistedResult.summary,
  });
  const evidenceBundle = await writeBenchmarkEvidenceBundle(repoRoot, report, {
    baselineInput: mergeObservedRunIntoBenchmarkInput(scenario.baseline, baselineResult.summary),
    assistedInput: mergeObservedRunIntoBenchmarkInput(scenario.assisted, assistedResult.summary),
    evaluation: {
      launch_id: launchId,
      measurement_mode: "observed",
      scenario_path: scenario.path,
      baseline_run_id: baselineResult.run.run_id,
      assisted_run_id: assistedResult.run.run_id,
    },
    scenario,
    dataset: scenario.dataset ?? null,
  });
  const reportWithEvidence = {
    ...report,
    evidence_bundle: evidenceBundle,
  };
  await writeBenchmarkReport(repoRoot, reportWithEvidence);
  const persisted = await writeBenchmarkReportForActor({
    serviceStorageRoot,
    surface,
    authContext,
    report: prepareBenchmarkReportArtifact({
      ...reportWithEvidence,
      workspace_slug: workspaceIdentity.workspace_slug,
      customer_slug: workspaceIdentity.customer_slug,
      profile_slug: workspaceIdentity.profile_slug ?? workspaceIdentity.workspace_slug,
      repo: workspaceIdentity.repo || path.basename(repoRoot),
    }),
    portalRoot,
    adminRoot,
  });

  return summarizePersistedReport(persisted.report);
}

async function executeObservedAgentRun({
  serviceStorageRoot,
  repoRoot,
  workspaceIdentity,
  launchId,
  scenario,
  phase,
  mode,
  apiBaseUrl,
  provider,
  model,
  agentClient,
  upstreamBaseUrl,
  command,
  pricing,
} = {}) {
  const runId = createAgentRunId(`${workspaceIdentity.profile_slug ?? workspaceIdentity.workspace_slug}-${mode}`);
  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();
  const proxyBaseUrl = `${String(apiBaseUrl ?? "").replace(/\/+$/, "")}/proxy/openai/runs/${runId}/v1`;
  let commandResult = {
    exit_code: 1,
    signal: null,
    stderr: "",
  };

  await writeAgentRunRecord({
    serviceStorageRoot,
    run: {
      run_id: runId,
      profile_slug: workspaceIdentity.profile_slug ?? workspaceIdentity.workspace_slug,
      workspace_slug: workspaceIdentity.workspace_slug,
      customer_slug: workspaceIdentity.customer_slug,
      repo: workspaceIdentity.repo || path.basename(repoRoot),
      scenario_id: String(scenario?.id ?? ""),
      dataset_id: String(scenario?.dataset_id ?? scenario?.dataset?.id ?? ""),
      mode,
      status: "running",
      provider: String(provider ?? "openai"),
      model: String(model ?? ""),
      agent_client: String(agentClient ?? "portal-launcher"),
      upstream_base_url: String(upstreamBaseUrl ?? ""),
      created_at: startedAtIso,
      started_at: startedAtIso,
      pricing: pricing ?? {},
      command: {
        argv_preview: summarizeCommandInput(command),
        cwd_hash: hashValue(repoRoot),
        launch_id: launchId,
        phase,
      },
    },
  });

  commandResult = await runObservedCommand(command, {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_BASE_URL: proxyBaseUrl,
      OPENAI_API_BASE: proxyBaseUrl,
      OPENAI_API_BASE_URL: proxyBaseUrl,
      BE_AI_HEART_AGENT_RUN_ID: runId,
      BE_AI_HEART_BENCHMARK_MODE: mode,
      BE_AI_HEART_BENCHMARK_SCENARIO: String(scenario?.id ?? ""),
      BE_AI_HEART_BENCHMARK_LAUNCH_ID: launchId,
    },
  });

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
      profile_slug: workspaceIdentity.profile_slug ?? workspaceIdentity.workspace_slug,
      workspace_slug: workspaceIdentity.workspace_slug,
      customer_slug: workspaceIdentity.customer_slug,
      repo: workspaceIdentity.repo || path.basename(repoRoot),
      scenario_id: String(scenario?.id ?? ""),
      dataset_id: String(scenario?.dataset_id ?? scenario?.dataset?.id ?? ""),
      mode,
      status: commandResult.exit_code === 0 ? "completed" : "failed",
      provider: String(provider ?? "openai"),
      model: String(model ?? ""),
      agent_client: String(agentClient ?? "portal-launcher"),
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
        argv_preview: summarizeCommandInput(command),
        cwd_hash: hashValue(repoRoot),
        launch_id: launchId,
        phase,
      },
    },
  });
  const refreshedCapture = await loadAgentRunCapture({
    serviceStorageRoot,
    runId,
  });

  return {
    run: persistedRun,
    summary: refreshedCapture?.summary ?? {
      run_id: runId,
      measurement_mode: "estimated",
      total_tokens: 0,
    },
    proxy: {
      base_url: proxyBaseUrl,
      upstream_base_url: upstreamBaseUrl,
    },
    command: {
      exit_code: commandResult.exit_code,
      signal: commandResult.signal,
      duration_ms: Date.now() - startedAtMs,
      stderr_preview: summarizeStderr(commandResult.stderr),
    },
  };
}

async function hydrateBenchmarkLaunch({ serviceStorageRoot, launch } = {}) {
  const baselineLive = await hydrateLaunchPhase({
    serviceStorageRoot,
    phase: launch.baseline,
  });
  const assistedLive = await hydrateLaunchPhase({
    serviceStorageRoot,
    phase: launch.assisted,
  });

  return {
    launch: {
      ...launch,
      baseline: baselineLive,
      assisted: assistedLive,
      live: {
        provisional_metrics: buildProvisionalMetrics(baselineLive.summary, assistedLive.summary),
      },
    },
  };
}

async function hydrateLaunchPhase({ serviceStorageRoot, phase } = {}) {
  const runId = String(phase?.run_id ?? "").trim();
  if (!runId) {
    return phase ?? {};
  }

  const [capture, run] = await Promise.all([
    loadAgentRunCapture({
      serviceStorageRoot,
      runId,
    }),
    loadAgentRunRecord({
      serviceStorageRoot,
      runId,
    }),
  ]);

  return {
    ...(phase ?? {}),
    status: String(run?.status ?? phase?.status ?? ""),
    exit_code: Number.isFinite(Number(run?.exit_code)) ? Number(run.exit_code) : phase?.exit_code ?? null,
    summary: capture?.summary ?? phase?.summary ?? null,
    updated_at: run?.ended_at || run?.started_at || phase?.updated_at || "",
  };
}

async function updateBenchmarkLaunch({ serviceStorageRoot, launchId, patch } = {}) {
  const current = await loadBenchmarkLaunchRecord({
    serviceStorageRoot,
    launchId,
  });
  if (!current) {
    return null;
  }

  return writeBenchmarkLaunchRecord({
    serviceStorageRoot,
    launch: {
      ...current,
      ...patch,
      baseline: patch?.baseline ? { ...(current.baseline ?? {}), ...patch.baseline } : current.baseline,
      assisted: patch?.assisted ? { ...(current.assisted ?? {}), ...patch.assisted } : current.assisted,
      report: patch?.report ? { ...(current.report ?? {}), ...patch.report } : current.report,
      capability: patch?.capability ? { ...(current.capability ?? {}), ...patch.capability } : current.capability,
      metadata: patch?.metadata ? { ...(current.metadata ?? {}), ...patch.metadata } : current.metadata,
      error: patch?.error === null ? null : patch?.error ?? current.error,
      updated_at: new Date().toISOString(),
    },
  });
}

async function finishBenchmarkLaunch({
  serviceStorageRoot,
  surface,
  authContext,
  workspaceIdentity,
  launchId,
  status,
  baseline,
  assisted,
  report,
  error,
} = {}) {
  const launch = await updateBenchmarkLaunch({
    serviceStorageRoot,
    launchId,
    patch: {
      status,
      phase: status === "completed" ? "completed" : "failed",
      ended_at: new Date().toISOString(),
      baseline,
      assisted,
      report,
      error: error
        ? {
            code: String(error.code ?? ""),
            message: String(error.message ?? "Benchmark launch failed."),
          }
        : null,
    },
  });

  await writeAuditEvent({
    serviceStorageRoot,
    event: {
      action: status === "completed" ? "benchmark.launch_completed" : "benchmark.launch_failed",
      outcome: status === "completed" ? "success" : "failure",
      surface,
      actor_slug: authContext?.actor?.actor_slug,
      workspace_slug: workspaceIdentity.workspace_slug,
      customer_slug: workspaceIdentity.customer_slug,
      customer_id: workspaceIdentity.customer_id,
      target_type: "benchmark_launch",
      target_id: launchId,
      metadata: {
        report_id: report?.report_id ?? "",
        scenario: launch?.scenario_id ?? "",
        error_code: error?.code ?? "",
      },
    },
  });
}

function resolveAccessibleRepoRoot(repoRoot) {
  const safeRepoRoot = String(repoRoot ?? "").trim();
  if (!safeRepoRoot) {
    return "";
  }

  const resolved = path.resolve(safeRepoRoot);
  return existsSync(resolved) ? resolved : "";
}

function normalizeMeasurementMode(value) {
  const normalized = String(value ?? "observed").trim().toLowerCase();
  if (!["observed", "estimated"].includes(normalized)) {
    throw new Error("measurement_mode must be observed or estimated.");
  }

  return normalized;
}

function normalizeCommandArgv(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array of command arguments.`);
  }

  const argv = value.map((entry) => String(entry ?? ""));
  if (argv.some((entry) => !entry.trim())) {
    throw new Error(`${label} contains an empty argument.`);
  }
  if (argv.some((entry) => /[\0\r]/.test(entry))) {
    throw new Error(`${label} contains an invalid control character.`);
  }

  return argv;
}

function normalizeHttpUrl(value, label) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new Error(`${label} is required for observed launches.`);
  }

  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${label} must use http or https.`);
  }

  return parsed.toString().replace(/\/+$/, "");
}

function normalizePricing(value = {}) {
  return compactObject({
    input_cost_per_1m: finiteNumberOrNull(value.input_cost_per_1m),
    cached_input_cost_per_1m: finiteNumberOrNull(value.cached_input_cost_per_1m),
    output_cost_per_1m: finiteNumberOrNull(value.output_cost_per_1m),
  });
}

function summarizeObservedLaunchPhase(status, result) {
  return {
    status,
    run_id: result?.run?.run_id ?? "",
    exit_code: Number.isFinite(Number(result?.command?.exit_code)) ? Number(result.command.exit_code) : null,
    summary: result?.summary ?? null,
    updated_at: new Date().toISOString(),
  };
}

function summarizePersistedReport(report = {}) {
  return {
    report_id: String(report.report_id ?? ""),
    generated_at: String(report.generated_at ?? ""),
    scenario: String(report.scenario ?? ""),
    metrics: report.metrics ?? {},
    href: report.report_id ? `/benchmarks/${report.report_id}` : "",
  };
}

function summarizeBenchmarkLaunchRecord(launch = {}) {
  return {
    launch_id: launch.launch_id,
    workspace_slug: launch.workspace_slug,
    profile_slug: launch.profile_slug,
    repo: launch.repo,
    scenario_id: launch.scenario_id,
    scenario_title: launch.scenario_title,
    measurement_mode: launch.measurement_mode,
    status: launch.status,
    phase: launch.phase,
    created_at: launch.created_at,
    started_at: launch.started_at,
    updated_at: launch.updated_at,
    ended_at: launch.ended_at,
    baseline: compactObject({
      status: launch.baseline?.status,
      run_id: launch.baseline?.run_id,
      total_tokens: launch.baseline?.summary?.total_tokens,
    }),
    assisted: compactObject({
      status: launch.assisted?.status,
      run_id: launch.assisted?.run_id,
      total_tokens: launch.assisted?.summary?.total_tokens,
    }),
    report: launch.report ?? {},
    error: launch.error ?? null,
  };
}

function summarizeCommandInput(command = []) {
  return {
    executable: String(command[0] ?? ""),
    argc: command.length,
    preview: previewCommandArgv(command),
  };
}

function previewCommandArgv(command = []) {
  const preview = command.slice(0, 6).join(" ");
  return command.length > 6 ? `${preview} …` : preview;
}

function summarizeStderr(stderr = "") {
  const safe = String(stderr ?? "").trim();
  if (!safe) {
    return "";
  }

  return safe.slice(-600);
}

function buildProvisionalMetrics(baselineSummary = null, assistedSummary = null) {
  const baselineTokens = Number(baselineSummary?.total_tokens ?? 0);
  const assistedTokens = Number(assistedSummary?.total_tokens ?? 0);
  if (baselineTokens <= 0 || assistedTokens <= 0) {
    return null;
  }

  const baselineCost = Number(baselineSummary?.token_cost_usd ?? 0);
  const assistedCost = Number(assistedSummary?.token_cost_usd ?? 0);

  return {
    token_savings_pct: percentReduction(baselineTokens, assistedTokens),
    token_cost_savings_usd: roundNumber(baselineCost - assistedCost, 4),
    baseline_tokens: baselineTokens,
    assisted_tokens: assistedTokens,
    baseline_cost_usd: roundNumber(baselineCost, 4),
    assisted_cost_usd: roundNumber(assistedCost, 4),
  };
}

async function runObservedCommand(command, { cwd, env }) {
  return await new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      stderr += String(error?.message ?? error);
      resolve({
        exit_code: 1,
        signal: null,
        stderr,
      });
    });
    child.on("close", (code, signal) => {
      resolve({
        exit_code: code ?? 1,
        signal: signal ?? null,
        stderr,
      });
    });
  });
}

function createBenchmarkLaunchId(slug) {
  return `${sanitizeSlug(slug || "benchmark-launch")}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function createAgentRunId(slug) {
  return `${sanitizeSlug(slug || "agent-run")}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function createLaunchFailure(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function hashValue(value) {
  return Buffer.from(String(value ?? ""), "utf8").toString("base64url");
}

function finiteNumberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function compactObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""),
  );
}

function roundNumber(value, precision = 2) {
  const numeric = Number(value ?? 0);
  const factor = 10 ** precision;
  return Number.isFinite(numeric) ? Math.round(numeric * factor) / factor : 0;
}

function percentReduction(before, after) {
  const safeBefore = Number(before ?? 0);
  const safeAfter = Number(after ?? 0);
  if (!Number.isFinite(safeBefore) || safeBefore <= 0) {
    return 0;
  }

  return Math.round(((safeBefore - safeAfter) / safeBefore) * 1000) / 10;
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
