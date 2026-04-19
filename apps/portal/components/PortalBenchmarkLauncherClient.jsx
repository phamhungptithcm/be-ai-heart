"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { postPortalJson } from "../src/api-client.js";
import { usePortalResource } from "../src/use-portal-resource.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

const DEFAULT_FORM = Object.freeze({
  scenario: "",
  measurementMode: "observed",
  upstreamBaseUrl: "",
  provider: "openai",
  model: "",
  agentClient: "portal-launcher",
  baselineCommandText: "",
  assistedCommandText: "",
  inputCostPer1m: "",
  cachedInputCostPer1m: "",
  outputCostPer1m: "",
});

export function PortalBenchmarkLauncherClient() {
  const searchParams = useSearchParams();
  const preferredWorkspace = String(
    searchParams.get("workspace") ?? searchParams.get("workspace_slug") ?? "",
  ).trim();
  const workspacesState = usePortalResource("/api/workspaces", {
    pollMs: 30_000,
  });
  const workspaces = workspacesState.data?.workspaces ?? [];
  const [selectedWorkspace, setSelectedWorkspace] = useState(preferredWorkspace);
  const [activeLaunchId, setActiveLaunchId] = useState("");
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [submitState, setSubmitState] = useState({
    status: "idle",
    error: "",
  });

  useEffect(() => {
    if (!workspaces.length) {
      return;
    }

    const availableSlugs = new Set(workspaces.map((workspace) => String(workspace.workspace_slug ?? "")));
    if (selectedWorkspace && availableSlugs.has(selectedWorkspace)) {
      return;
    }

    const nextWorkspace = availableSlugs.has(preferredWorkspace)
      ? preferredWorkspace
      : String(workspaces[0]?.workspace_slug ?? "");
    if (nextWorkspace) {
      setSelectedWorkspace(nextWorkspace);
    }
  }, [preferredWorkspace, selectedWorkspace, workspaces]);

  const launchesPath = selectedWorkspace
    ? `/api/benchmarks/runs?workspace=${encodeURIComponent(selectedWorkspace)}`
    : "";
  const launchesState = usePortalResource(launchesPath, {
    enabled: Boolean(selectedWorkspace),
    pollMs: 5_000,
  });
  const capability = launchesState.data?.capability ?? null;
  const launches = launchesState.data?.launches ?? [];

  useEffect(() => {
    if (!launches.length) {
      setActiveLaunchId("");
      return;
    }

    const safeActiveLaunchId = String(activeLaunchId ?? "");
    if (safeActiveLaunchId && launches.some((launch) => launch.launch_id === safeActiveLaunchId)) {
      return;
    }

    const nextLaunch =
      launches.find((launch) => ["queued", "running"].includes(String(launch.status ?? ""))) ??
      launches[0];
    setActiveLaunchId(String(nextLaunch?.launch_id ?? ""));
  }, [activeLaunchId, launches]);

  useEffect(() => {
    if (!capability) {
      return;
    }

    setForm((current) => {
      const nextMode =
        capability.measurement_modes?.includes(current.measurementMode)
          ? current.measurementMode
          : capability.measurement_modes?.[0] ?? "observed";
      const nextScenario =
        capability.scenarios?.some((scenario) => scenario.id === current.scenario)
          ? current.scenario
          : capability.scenarios?.[0]?.id ?? "";
      const nextModel = current.model || capability.scenarios?.find((scenario) => scenario.id === nextScenario)?.model || "";

      return {
        ...current,
        measurementMode: nextMode,
        scenario: nextScenario,
        model: nextModel,
      };
    });
  }, [capability]);

  const launchDetailPath =
    activeLaunchId && selectedWorkspace
      ? `/api/benchmarks/runs/${encodeURIComponent(activeLaunchId)}?workspace=${encodeURIComponent(selectedWorkspace)}`
      : "";
  const launchDetailState = usePortalResource(launchDetailPath, {
    enabled: Boolean(activeLaunchId && selectedWorkspace),
    pollMs: 5_000,
  });
  const activeLaunch = launchDetailState.data?.launch ?? null;
  const launchMetrics = activeLaunch?.live?.provisional_metrics ?? null;

  const selectedWorkspaceSummary = useMemo(
    () => workspaces.find((workspace) => workspace.workspace_slug === selectedWorkspace) ?? null,
    [selectedWorkspace, workspaces],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedWorkspace) {
      setSubmitState({
        status: "error",
        error: "Select a workspace before starting a benchmark launch.",
      });
      return;
    }

    setSubmitState({
      status: "submitting",
      error: "",
    });

    try {
      const payload = {
        scenario: form.scenario,
        measurement_mode: form.measurementMode,
        provider: form.provider,
        model: form.model,
        agent_client: form.agentClient,
      };

      if (form.measurementMode === "observed") {
        payload.upstream_base_url = form.upstreamBaseUrl;
        payload.baseline_command = parseCommandLines(form.baselineCommandText);
        payload.assisted_command = parseCommandLines(form.assistedCommandText);
        payload.pricing = compactObject({
          input_cost_per_1m: parseOptionalNumber(form.inputCostPer1m),
          cached_input_cost_per_1m: parseOptionalNumber(form.cachedInputCostPer1m),
          output_cost_per_1m: parseOptionalNumber(form.outputCostPer1m),
        });
      }

      const response = await postPortalJson(
        `/api/benchmarks/runs?workspace=${encodeURIComponent(selectedWorkspace)}`,
        payload,
      );
      setActiveLaunchId(response.launch?.launch_id ?? "");
      setSubmitState({
        status: "success",
        error: "",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        error: error.message,
      });
    }
  }

  if (workspacesState.status === "loading" || workspacesState.status === "idle") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Benchmark launcher"
        title="Loading workspace benchmark runner state"
        description="BeHeart is checking which imported repositories still have a runnable local benchmark lane on this host."
      />
    );
  }

  if (workspacesState.status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Benchmark launcher"
        title="Workspace benchmark runner is unavailable"
        description={workspacesState.error}
      />
    );
  }

  if (workspaces.length === 0) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Benchmark launcher"
        title="No imported workspace is available yet"
        description="Sync a repository profile and documents from the CLI first, then come back here to start a benchmark run."
        actions={[
          { href: "/repositories", label: "Open repositories", primary: true },
          { href: "/documents", label: "Review document flow" },
        ]}
      />
    );
  }

  if (selectedWorkspace && launchesState.status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Benchmark launcher"
        title="Workspace benchmark state could not be loaded"
        description={launchesState.error}
      />
    );
  }

  const runnerDisabled = !capability || capability.runner_status !== "ready";

  return (
    <div className="portal-stack-block portal-benchmark-launcher">
      <div className="portal-inline-banner">
        <strong>Workspace-scoped runner</strong>
        <p>
          Portal can only launch a benchmark when this service can still reach the imported
          repository on the current host. If that local path is gone, the CLI remains the fallback
          source of truth.
        </p>
      </div>

      <form className="portal-form" onSubmit={handleSubmit}>
        <div className="portal-form-grid">
          <label className="portal-field">
            <span>Workspace</span>
            <select
              className="portal-input"
              value={selectedWorkspace}
              onChange={(event) => setSelectedWorkspace(event.target.value)}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.workspace_slug} value={workspace.workspace_slug}>
                  {workspace.repo} · {workspace.workspace_slug}
                </option>
              ))}
            </select>
          </label>

          <label className="portal-field">
            <span>Measurement mode</span>
            <select
              className="portal-input"
              value={form.measurementMode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  measurementMode: event.target.value,
                }))
              }
              disabled={!capability?.measurement_modes?.length}
            >
              {(capability?.measurement_modes?.length
                ? capability.measurement_modes
                : ["observed", "estimated"]
              ).map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>

          <label className="portal-field">
            <span>Scenario</span>
            <select
              className="portal-input"
              value={form.scenario}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  scenario: event.target.value,
                }))
              }
              disabled={!capability?.scenarios?.length}
            >
              {(capability?.scenarios ?? []).map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.title}
                </option>
              ))}
            </select>
          </label>

          <label className="portal-field">
            <span>Agent client</span>
            <input
              className="portal-input"
              value={form.agentClient}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  agentClient: event.target.value,
                }))
              }
              placeholder="portal-launcher"
            />
          </label>

          <label className="portal-field">
            <span>Provider</span>
            <input
              className="portal-input"
              value={form.provider}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  provider: event.target.value,
                }))
              }
              placeholder="openai"
            />
          </label>

          <label className="portal-field">
            <span>Model</span>
            <input
              className="portal-input"
              value={form.model}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  model: event.target.value,
                }))
              }
              placeholder="gpt-5.4"
            />
          </label>
        </div>

        {form.measurementMode === "observed" ? (
          <>
            <div className="portal-form-grid">
              <label className="portal-field">
                <span>Upstream model base URL</span>
                <input
                  className="portal-input"
                  value={form.upstreamBaseUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      upstreamBaseUrl: event.target.value,
                    }))
                  }
                  placeholder="https://api.openai.com/v1"
                />
              </label>

              <div className="portal-field">
                <span>Observed note</span>
                <p className="portal-launch-note">
                  Commands run without a shell. Enter one argument per line so the portal can pass
                  the exact argv array to the local runner.
                </p>
              </div>
            </div>

            <div className="portal-form-grid">
              <label className="portal-field">
                <span>Baseline command argv</span>
                <textarea
                  className="portal-textarea portal-textarea-sm"
                  value={form.baselineCommandText}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      baselineCommandText: event.target.value,
                    }))
                  }
                  placeholder={"node\nscripts/run-agent.mjs\nbaseline"}
                />
              </label>

              <label className="portal-field">
                <span>Assisted command argv</span>
                <textarea
                  className="portal-textarea portal-textarea-sm"
                  value={form.assistedCommandText}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      assistedCommandText: event.target.value,
                    }))
                  }
                  placeholder={"node\nscripts/run-agent.mjs\nassisted"}
                />
              </label>
            </div>

            <div className="portal-form-grid">
              <label className="portal-field">
                <span>Input cost per 1M tokens</span>
                <input
                  className="portal-input"
                  value={form.inputCostPer1m}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      inputCostPer1m: event.target.value,
                    }))
                  }
                  placeholder="10"
                />
              </label>

              <label className="portal-field">
                <span>Cached input cost per 1M tokens</span>
                <input
                  className="portal-input"
                  value={form.cachedInputCostPer1m}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cachedInputCostPer1m: event.target.value,
                    }))
                  }
                  placeholder="5"
                />
              </label>

              <label className="portal-field">
                <span>Output cost per 1M tokens</span>
                <input
                  className="portal-input"
                  value={form.outputCostPer1m}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      outputCostPer1m: event.target.value,
                    }))
                  }
                  placeholder="20"
                />
              </label>
            </div>
          </>
        ) : (
          <div className="portal-inline-banner">
            <strong>Estimated report mode</strong>
            <p>
              Estimated mode skips agent execution and generates the report from the scenario
              manifests. Use it only when the agent cannot be routed through the BeHeart proxy.
            </p>
          </div>
        )}

        {selectedWorkspaceSummary ? (
          <div className="portal-stat-grid">
            <div>
              <span>Repository</span>
              <strong>{selectedWorkspaceSummary.repo}</strong>
            </div>
            <div>
              <span>Reports</span>
              <strong>{selectedWorkspaceSummary.benchmark_report_count ?? 0}</strong>
            </div>
            <div>
              <span>Avg token save</span>
              <strong>{selectedWorkspaceSummary.avg_token_savings_pct ?? 0}%</strong>
            </div>
            <div>
              <span>Runner</span>
              <strong>{formatRunnerStatus(capability)}</strong>
            </div>
          </div>
        ) : null}

        {runnerDisabled ? (
          <PortalStateBlock
            tone="neutral"
            eyebrow="Runner status"
            title="Portal launch is not available for this workspace"
            description={
              capability?.reason ||
              "This workspace can still publish benchmark reports from the CLI, but the hosted service cannot execute the local benchmark runner here."
            }
            actions={[
              { href: "/repositories", label: "Check repository sync", primary: true },
              { href: "/usage", label: "Review usage" },
            ]}
          />
        ) : null}

        <div className="portal-form-actions">
          <button
            type="submit"
            className="portal-button"
            disabled={
              runnerDisabled ||
              submitState.status === "submitting" ||
              !form.scenario
            }
          >
            {submitState.status === "submitting" ? "Launching…" : "Run benchmark"}
          </button>
          <p className={`portal-notice ${submitState.status === "error" ? "portal-notice-error" : "portal-notice-success"}`}>
            {submitState.status === "error"
              ? submitState.error
              : submitState.status === "success"
                ? "Benchmark launch accepted. Live counters will refresh automatically."
                : "Observed mode shows live token and cost counters as the proxy records LLM usage."}
          </p>
        </div>
      </form>

      {activeLaunch ? (
        <section className="portal-command-panel">
          <header className="portal-command-head">
            <div>
              <span>Live launch</span>
              <h3>{activeLaunch.scenario_title}</h3>
              <p>
                {activeLaunch.measurement_mode} · {activeLaunch.status} · phase {activeLaunch.phase}
              </p>
            </div>
          </header>

          <div className="portal-stat-grid">
            <div>
              <span>Baseline tokens</span>
              <strong>{activeLaunch.baseline?.summary?.total_tokens ?? 0}</strong>
            </div>
            <div>
              <span>Assisted tokens</span>
              <strong>{activeLaunch.assisted?.summary?.total_tokens ?? 0}</strong>
            </div>
            <div>
              <span>Live token save</span>
              <strong>{launchMetrics?.token_savings_pct ?? 0}%</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{activeLaunch.status}</strong>
            </div>
          </div>

          <div className="portal-data-table-shell">
            <table className="portal-data-table">
              <thead>
                <tr>
                  <th>Lane</th>
                  <th>Status</th>
                  <th>Calls</th>
                  <th>Tokens</th>
                  <th>Cost</th>
                  <th>Coverage</th>
                  <th>Run id</th>
                </tr>
              </thead>
              <tbody>
                {[["Baseline", activeLaunch.baseline], ["Assisted", activeLaunch.assisted]].map(([label, lane]) => (
                  <tr key={label}>
                    <td className="portal-table-primary">
                      <strong>{label}</strong>
                      <small>{lane?.status ?? "waiting"}</small>
                    </td>
                    <td>{lane?.status ?? "waiting"}</td>
                    <td>{lane?.summary?.traced_call_count ?? 0}</td>
                    <td>{lane?.summary?.total_tokens ?? 0}</td>
                    <td>${Number(lane?.summary?.token_cost_usd ?? 0).toFixed(4)}</td>
                    <td>{lane?.summary?.observed_usage_coverage_pct ?? 0}%</td>
                    <td><code>{lane?.run_id ?? "not started"}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeLaunch.error?.message ? (
            <p className="portal-notice portal-notice-error">{activeLaunch.error.message}</p>
          ) : null}
          {activeLaunch.report?.report_id ? (
            <div className="portal-inline-banner">
              <strong>Published report</strong>
              <p>
                Report <code>{activeLaunch.report.report_id}</code> is ready with {activeLaunch.report.metrics?.token_savings_pct ?? 0}% token savings and{" "}
                <a href={activeLaunch.report.href} className="portal-inline-link">customer-facing evidence</a>.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="portal-data-table-shell">
        <table className="portal-data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Workspace</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Live token save</th>
            </tr>
          </thead>
          <tbody>
            {launches.length > 0 ? (
              launches.map((launch) => (
                <tr
                  key={launch.launch_id}
                  className={launch.launch_id === activeLaunchId ? "portal-benchmark-launch-row-active" : ""}
                  onClick={() => setActiveLaunchId(launch.launch_id)}
                >
                  <td className="portal-table-primary">
                    <strong>{launch.scenario_title}</strong>
                    <small>{launch.repo}</small>
                  </td>
                  <td>{launch.workspace_slug}</td>
                  <td>{launch.measurement_mode}</td>
                  <td>{launch.status}</td>
                  <td>{formatTimestamp(launch.updated_at)}</td>
                  <td>{launch.report?.metrics?.token_savings_pct ?? 0}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No benchmark launch has been requested for this workspace yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseCommandLines(value) {
  const argv = String(value ?? "")
    .split(/\r?\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (argv.length === 0) {
    throw new Error("Observed launches require one argument per line for each command.");
  }

  return argv;
}

function parseOptionalNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid numeric pricing value: ${raw}`);
  }

  return numeric;
}

function compactObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""),
  );
}

function formatRunnerStatus(capability) {
  if (!capability) {
    return "waiting";
  }
  if (capability.runner_status === "ready") {
    return "ready";
  }

  return capability.runner_status.replace(/_/g, " ");
}

function formatTimestamp(value) {
  const safeValue = String(value ?? "").trim();
  if (!safeValue) {
    return "Waiting";
  }

  const date = new Date(safeValue);
  if (Number.isNaN(date.getTime())) {
    return safeValue;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
