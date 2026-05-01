"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchPortalJson } from "../src/api-client.js";
import { buildPortalBenchmarkArchiveSummary } from "../src/dashboard-visuals.js";
import {
  buildPortalBenchmarkTableRows,
  queryPortalBenchmarkRows,
} from "../src/table-state.js";
import { PortalBenchmarkTrendPanel } from "./PortalBenchmarkVisuals.jsx";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalBenchmarkSummaryClient() {
  const { status, reports, error } = useBenchmarkIndex();

  if (status !== "ready") {
    return (
      <PortalStateBlock
        tone={status === "error" ? "error" : "loading"}
        eyebrow="Benchmarks"
        title={status === "error" ? "Benchmark summary unavailable" : "Loading benchmark summary"}
        description={status === "error" ? error : "The portal is aggregating report evidence for token, cost, and memory savings."}
      />
    );
  }

  const summary = summarizeReports(reports);
  const latestReport =
    [...reports].sort((left, right) =>
      String(right.generated_at ?? "").localeCompare(String(left.generated_at ?? "")),
    )[0] ?? null;

  return (
    <div className="portal-enterprise-stack">
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Benchmark snapshot</span>
            <h3>Published ROI proof should be immediately legible to both buyers and delivery leads</h3>
            <p>Benchmark reports exist to justify spend, rollout, and governance. This page should make the proof easy to scan before anyone opens a detailed report.</p>
          </div>
        </div>
        <div className="portal-kpi-grid">
          <article className="portal-kpi-card"><span>Reports</span><strong>{summary.report_count}</strong></article>
          <article className="portal-kpi-card"><span>Repositories</span><strong>{summary.repository_count}</strong></article>
          <article className="portal-kpi-card"><span>Scenarios</span><strong>{summary.scenario_count}</strong></article>
          <article className="portal-kpi-card"><span>Providers</span><strong>{summary.provider_count}</strong></article>
          <article className="portal-kpi-card"><span>Avg token save</span><strong>{summary.avg_token_savings_pct}%</strong></article>
          <article className="portal-kpi-card"><span>Avg cost save</span><strong>${summary.avg_cost_savings_usd}</strong></article>
          <article className="portal-kpi-card"><span>Avg memory save</span><strong>{summary.avg_memory_refresh_reduction_pct}%</strong></article>
          <article className="portal-kpi-card"><span>Avg ROI</span><strong>{summary.avg_roi_score}</strong></article>
        </div>
      </section>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Latest proof</span>
              <h3>{latestReport ? formatScenarioLabel(latestReport.scenario) : "Waiting for benchmark drill-down"}</h3>
              <p>
                {latestReport?.manager_summary ??
                  "The newest benchmark should explain why the result matters, not just what number improved."}
              </p>
            </div>
          </div>
          {latestReport ? (
            <div className="portal-summary-list">
              <article>
                <span>Repository</span>
                <strong>{latestReport.repo}</strong>
                <p>{latestReport.provider}/{latestReport.model} · {formatTimestamp(latestReport.generated_at)}</p>
              </article>
              <article>
                <span>Commercial readout</span>
                <strong>{latestReport.metrics?.token_savings_pct ?? 0}% token save with ${latestReport.metrics?.token_cost_savings_usd ?? 0} cost delta</strong>
                <p>{latestReport.metrics?.memory_refresh_reduction_pct ?? 0}% fewer memory refreshes and ROI score {latestReport.metrics?.composite_roi_score ?? 0}.</p>
              </article>
              <article>
                <span>Coverage leader</span>
                <strong>{summary.top_repository?.label ?? "No repository coverage yet"}</strong>
                <p>
                  {summary.top_repository
                    ? `${summary.top_repository.report_count} report(s) at ${summary.top_repository.avg_token_savings_pct}% average token savings.`
                    : "Publish multiple repository reports before using this lane as expansion proof."}
                </p>
              </article>
            </div>
          ) : null}
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Coverage leaders</span>
              <h3>Which repositories and scenarios carry the strongest archive</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            <article>
              <span>Repository leader</span>
              <strong>{summary.top_repository?.label ?? "Waiting on coverage"}</strong>
              <p>
                {summary.top_repository
                  ? `${summary.top_repository.report_count} report(s) · ${summary.top_repository.avg_token_savings_pct}% average token savings · ROI ${summary.top_repository.avg_roi_score}.`
                  : "No repository has published enough evidence yet."}
              </p>
            </article>
            <article>
              <span>Scenario leader</span>
              <strong>{summary.top_scenario?.label ?? "Waiting on scenario breadth"}</strong>
              <p>
                {summary.top_scenario
                  ? `${summary.top_scenario.report_count} report(s) · ${summary.top_scenario.avg_token_savings_pct}% average token savings · ROI ${summary.top_scenario.avg_roi_score}.`
                  : "Publish more than one scenario before using this page as rollout proof."}
              </p>
            </article>
            <article>
              <span>Archive posture</span>
              <strong>{summary.report_count} reports across {summary.repository_count} repositories</strong>
              <p>{summary.scenario_count} scenarios and {summary.provider_count} providers are currently represented in the customer-facing archive.</p>
            </article>
          </div>
        </section>
      </div>

      <PortalBenchmarkTrendPanel reports={reports} />
    </div>
  );
}

export function PortalBenchmarkHistoryClient() {
  const { status, reports, error } = useBenchmarkIndex();
  const [archiveState, setArchiveState] = useState({
    query: "",
    roi: "all",
    sortKey: "runtime",
    sortDirection: "desc",
  });

  if (status === "loading") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Benchmarks"
        title="Loading benchmark history"
        description="Published reports are being pulled into the customer workspace."
      />
    );
  }

  if (status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Benchmarks"
        title="Benchmark history could not be loaded"
        description={error}
        actions={[{ href: "/usage", label: "Open usage" }]}
      />
    );
  }

  if (reports.length === 0) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Benchmarks"
        title="No published benchmark report yet"
        description="Run a benchmark scenario from the CLI, then publish the report so buyers and engineers can review the ROI together."
        actions={[{ href: "/documents", label: "Prepare project memory" }, { href: "/usage", label: "Review workspace signals" }]}
      />
    );
  }

  const summary = summarizeReports(reports);
  const archiveRows = queryPortalBenchmarkRows(buildPortalBenchmarkTableRows(reports), archiveState);
  const scenarioRows = buildScenarioRows(archiveRows);
  const repositoryRows = buildRepositoryRows(archiveRows);

  return (
    <div className="portal-enterprise-stack">
      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Coverage map</span>
              <h3>Which scenarios are actually carrying proof today</h3>
              <p>Scenario concentration matters. If proof only exists for one task type, the rollout story is still narrow.</p>
            </div>
          </div>
          <div className="portal-summary-list">
            {scenarioRows.slice(0, 4).map((row) => (
              <article key={row.label}>
                <span>{row.label}</span>
                <strong>{row.count} report(s) · {row.avgTokenSave}% average token savings</strong>
                <p>{row.repoCount} repository surface(s) covered with average ROI {row.avgRoi}.</p>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Coverage leaders</span>
              <h3>Which repositories and scenarios carry the strongest archive</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            <article>
              <span>Repository leader</span>
              <strong>{summary.top_repository?.label ?? "Waiting on coverage"}</strong>
              <p>
                {summary.top_repository
                  ? `${summary.top_repository.report_count} report(s) · ${summary.top_repository.avg_token_savings_pct}% average token savings · ROI ${summary.top_repository.avg_roi_score}.`
                  : "No repository has published enough evidence yet."}
              </p>
            </article>
            <article>
              <span>Scenario leader</span>
              <strong>{summary.top_scenario?.label ?? "Waiting on scenario breadth"}</strong>
              <p>
                {summary.top_scenario
                  ? `${summary.top_scenario.report_count} report(s) · ${summary.top_scenario.avg_token_savings_pct}% average token savings · ROI ${summary.top_scenario.avg_roi_score}.`
                  : "Publish more than one scenario before using this page as rollout proof."}
              </p>
            </article>
            <article>
              <span>Archive posture</span>
              <strong>{summary.report_count} reports across {summary.repository_count} repositories</strong>
              <p>{summary.scenario_count} scenarios and {summary.provider_count} providers are currently represented in the customer-facing archive.</p>
            </article>
          </div>
        </section>
      </div>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Scenario table</span>
              <h3>Scenario coverage and benchmark strength</h3>
            </div>
          </div>
          <div className="portal-data-table-shell">
            <table className="portal-data-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Reports</th>
                  <th>Repos</th>
                  <th>Avg token save</th>
                  <th>Avg ROI</th>
                </tr>
              </thead>
              <tbody>
                {scenarioRows.map((row) => (
                  <tr key={row.label}>
                    <td className="portal-table-primary">
                      <strong>{row.label}</strong>
                      <small>{row.repoCount} repository surface(s)</small>
                    </td>
                    <td>{row.count}</td>
                    <td>{row.repoCount}</td>
                    <td>{row.avgTokenSave}%</td>
                    <td>{row.avgRoi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Repository table</span>
              <h3>Repository coverage and commercial usefulness</h3>
            </div>
          </div>
          <div className="portal-data-table-shell">
            <table className="portal-data-table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Reports</th>
                  <th>Scenarios</th>
                  <th>Avg token save</th>
                  <th>Avg ROI</th>
                </tr>
              </thead>
              <tbody>
                {repositoryRows.map((row) => (
                  <tr key={row.repo}>
                    <td className="portal-table-primary">
                      <strong>{row.repo}</strong>
                      <small>{row.scenarioCount} scenario(s) covered</small>
                    </td>
                    <td>{row.count}</td>
                    <td>{row.scenarioCount}</td>
                    <td>{row.avgTokenSave}%</td>
                    <td>{row.avgRoi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Report archive</span>
            <h3>Published benchmark history</h3>
            <p>Dense enough for engineering leads and buyers to compare the scenario, model, and savings profile before opening a detailed report.</p>
          </div>
        </div>
        <div className="portal-table-toolbar">
          <div className="portal-table-controls">
            <label className="portal-field">
              <span>Search reports</span>
              <input
                className="portal-input"
                type="search"
                value={archiveState.query}
                onChange={(event) =>
                  setArchiveState((current) => ({ ...current, query: event.target.value }))
                }
                placeholder="Scenario, repo, model, or summary"
              />
            </label>
            <label className="portal-field">
              <span>ROI posture</span>
              <select
                className="portal-input"
                value={archiveState.roi}
                onChange={(event) =>
                  setArchiveState((current) => ({ ...current, roi: event.target.value }))
                }
              >
                <option value="all">All</option>
                <option value="strong">Strong</option>
                <option value="watch">Watch</option>
                <option value="weak">Weak</option>
              </select>
            </label>
          </div>
          <p className="portal-table-summary">
            Showing {archiveRows.length} of {reports.length} reports.
          </p>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th aria-sort={getSortAria(archiveState, "scenario")}>
                  <button type="button" className="portal-table-sort" data-active={archiveState.sortKey === "scenario"} onClick={() => setArchiveState((current) => nextSortState(current, "scenario"))}>
                    Scenario
                    <span>{getSortLabel(archiveState, "scenario")}</span>
                  </button>
                </th>
                <th aria-sort={getSortAria(archiveState, "repository")}>
                  <button type="button" className="portal-table-sort" data-active={archiveState.sortKey === "repository"} onClick={() => setArchiveState((current) => nextSortState(current, "repository"))}>
                    Repository
                    <span>{getSortLabel(archiveState, "repository")}</span>
                  </button>
                </th>
                <th aria-sort={getSortAria(archiveState, "model")}>
                  <button type="button" className="portal-table-sort" data-active={archiveState.sortKey === "model"} onClick={() => setArchiveState((current) => nextSortState(current, "model"))}>
                    Model
                    <span>{getSortLabel(archiveState, "model")}</span>
                  </button>
                </th>
                <th aria-sort={getSortAria(archiveState, "token-save")}>
                  <button type="button" className="portal-table-sort" data-active={archiveState.sortKey === "token-save"} onClick={() => setArchiveState((current) => nextSortState(current, "token-save"))}>
                    Token save
                    <span>{getSortLabel(archiveState, "token-save")}</span>
                  </button>
                </th>
                <th aria-sort={getSortAria(archiveState, "money-save")}>
                  <button type="button" className="portal-table-sort" data-active={archiveState.sortKey === "money-save"} onClick={() => setArchiveState((current) => nextSortState(current, "money-save"))}>
                    Money save
                    <span>{getSortLabel(archiveState, "money-save")}</span>
                  </button>
                </th>
                <th aria-sort={getSortAria(archiveState, "memory-save")}>
                  <button type="button" className="portal-table-sort" data-active={archiveState.sortKey === "memory-save"} onClick={() => setArchiveState((current) => nextSortState(current, "memory-save"))}>
                    Memory save
                    <span>{getSortLabel(archiveState, "memory-save")}</span>
                  </button>
                </th>
                <th aria-sort={getSortAria(archiveState, "roi")}>
                  <button type="button" className="portal-table-sort" data-active={archiveState.sortKey === "roi"} onClick={() => setArchiveState((current) => nextSortState(current, "roi"))}>
                    ROI
                    <span>{getSortLabel(archiveState, "roi")}</span>
                  </button>
                </th>
                <th aria-sort={getSortAria(archiveState, "runtime")}>
                  <button type="button" className="portal-table-sort" data-active={archiveState.sortKey === "runtime"} onClick={() => setArchiveState((current) => nextSortState(current, "runtime"))}>
                    Run time
                    <span>{getSortLabel(archiveState, "runtime")}</span>
                  </button>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {archiveRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="portal-table-empty">
                    No benchmark report matches the current search and filter state.
                  </td>
                </tr>
              ) : (
                archiveRows.map((report) => (
                  <tr key={report.report_id}>
                    <td className="portal-table-primary">
                      <strong>{report.scenarioLabel}</strong>
                      <small>{report.manager_summary}</small>
                    </td>
                    <td>{report.repo}</td>
                    <td>
                      <div className="portal-table-stat">
                        <strong>{report.model}</strong>
                        <span>{report.provider}</span>
                      </div>
                    </td>
                    <td>{report.tokenSavingsPct}%</td>
                    <td>${report.tokenCostSavingsUsd}</td>
                    <td>{report.memoryRefreshReductionPct}%</td>
                    <td>
                      <span className="portal-table-badge" data-tone={report.roiLabel === "Strong" ? "positive" : "neutral"}>
                        {report.roiScore}
                      </span>
                    </td>
                    <td>{formatTimestamp(report.generated_at)}</td>
                    <td className="portal-table-link">
                      <Link href={`/benchmarks/${report.report_id}`}>Inspect</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function useBenchmarkIndex() {
  const [state, setState] = useState({
    status: "loading",
    reports: [],
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchPortalJson("/api/benchmarks");

        if (active) {
          setState({
            status: "ready",
            reports: payload.reports ?? [],
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            reports: [],
            error: error.message,
          });
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return state;
}

function summarizeReports(reports) {
  if (reports.length === 0) {
    return {
      report_count: 0,
      repository_count: 0,
      scenario_count: 0,
      provider_count: 0,
      avg_token_savings_pct: 0,
      avg_cost_savings_usd: 0,
      avg_memory_refresh_reduction_pct: 0,
      avg_roi_score: 0,
      top_repository: null,
      top_scenario: null,
    };
  }

  const archiveSummary = buildPortalBenchmarkArchiveSummary(reports);

  return {
    report_count: reports.length,
    repository_count: new Set(reports.map((report) => String(report.repo ?? ""))).size,
    scenario_count: archiveSummary.scenario_count,
    provider_count: new Set(reports.map((report) => String(report.provider ?? ""))).size,
    avg_token_savings_pct: average(reports.map((report) => report.metrics?.token_savings_pct ?? 0)),
    avg_cost_savings_usd: average(reports.map((report) => report.metrics?.token_cost_savings_usd ?? 0)),
    avg_memory_refresh_reduction_pct: average(
      reports.map((report) => report.metrics?.memory_refresh_reduction_pct ?? 0),
    ),
    avg_roi_score: average(reports.map((report) => report.metrics?.composite_roi_score ?? 0)),
    top_repository: archiveSummary.top_repository,
    top_scenario: archiveSummary.top_scenario,
  };
}

function average(values) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return Math.round((total / Math.max(values.length, 1)) * 10) / 10;
}

function nextSortState(current, sortKey) {
  if (current.sortKey === sortKey) {
    return {
      ...current,
      sortDirection: current.sortDirection === "desc" ? "asc" : "desc",
    };
  }

  return {
    ...current,
    sortKey,
    sortDirection: ["scenario", "repository", "model"].includes(sortKey) ? "asc" : "desc",
  };
}

function getSortAria(state, sortKey) {
  if (state.sortKey !== sortKey) {
    return "none";
  }

  return state.sortDirection === "asc" ? "ascending" : "descending";
}

function getSortLabel(state, sortKey) {
  if (state.sortKey !== sortKey) {
    return "sort";
  }

  return state.sortDirection;
}

function formatScenarioLabel(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTimestamp(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function buildScenarioRows(reports) {
  const grouped = new Map();
  for (const report of reports) {
    const key = formatScenarioLabel(report.scenario);
    const existing = grouped.get(key) ?? {
      label: key,
      count: 0,
      repoSet: new Set(),
      tokenSavings: [],
      roiScores: [],
    };
    existing.count += 1;
    existing.repoSet.add(String(report.repo ?? "unknown"));
    existing.tokenSavings.push(Number(report.metrics?.token_savings_pct ?? 0));
    existing.roiScores.push(Number(report.metrics?.composite_roi_score ?? 0));
    grouped.set(key, existing);
  }

  return [...grouped.values()]
    .map((entry) => ({
      label: entry.label,
      count: entry.count,
      repoCount: entry.repoSet.size,
      avgTokenSave: average(entry.tokenSavings),
      avgRoi: average(entry.roiScores),
    }))
    .sort((left, right) => right.count - left.count);
}

function buildRepositoryRows(reports) {
  const grouped = new Map();
  for (const report of reports) {
    const key = String(report.repo ?? "unknown");
    const existing = grouped.get(key) ?? {
      repo: key,
      count: 0,
      scenarioSet: new Set(),
      tokenSavings: [],
      roiScores: [],
    };
    existing.count += 1;
    existing.scenarioSet.add(formatScenarioLabel(report.scenario));
    existing.tokenSavings.push(Number(report.metrics?.token_savings_pct ?? 0));
    existing.roiScores.push(Number(report.metrics?.composite_roi_score ?? 0));
    grouped.set(key, existing);
  }

  return [...grouped.values()]
    .map((entry) => ({
      repo: entry.repo,
      count: entry.count,
      scenarioCount: entry.scenarioSet.size,
      avgTokenSave: average(entry.tokenSavings),
      avgRoi: average(entry.roiScores),
    }))
    .sort((left, right) => right.count - left.count);
}
