"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buildAdminBenchmarkArchiveSummary } from "../src/dashboard-visuals.js";
import { fetchAdminJson } from "../src/api-client.js";
import {
  buildAdminBenchmarkTableRows,
  queryAdminBenchmarkRows,
} from "../src/table-state.js";
import { AdminBenchmarkTrendPanel } from "./AdminBenchmarkVisuals.jsx";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminBenchmarkHistoryClient() {
  const [state, setState] = useState({
    status: "loading",
    reports: [],
    error: "",
  });
  const [archiveState, setArchiveState] = useState({
    query: "",
    roi: "all",
    sortKey: "runtime",
    sortDirection: "desc",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchAdminJson("/api/benchmarks");

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

  if (state.status === "loading") {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Benchmarks"
        title="Loading benchmark history"
        description="The admin plane is pulling published ROI evidence across customer repositories."
      />
    );
  }

  if (state.status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Benchmarks"
        title="Benchmark history unavailable"
        description={state.error}
        actions={[{ href: "/ops-health", label: "Check platform health" }]}
      />
    );
  }

  if (state.reports.length === 0) {
    return (
      <AdminStateBlock
        tone="neutral"
        eyebrow="Benchmarks"
        title="No published benchmark report yet"
        description="Commercial proof is still empty. Run or publish a benchmark so support and sales have evidence tied to real repository work."
        actions={[{ href: "/support", label: "Open support" }]}
      />
    );
  }

  const summary = buildAdminBenchmarkArchiveSummary(state.reports);
  const archiveRows = queryAdminBenchmarkRows(buildAdminBenchmarkTableRows(state.reports), archiveState);
  const repositoryRows = buildRepositoryRows(archiveRows);
  const scenarioRows = buildScenarioRows(archiveRows);

  return (
    <div className="admin-stack-block">
      <div className="admin-command-grid">
        <section className="admin-command-panel admin-command-panel-wide">
          <header className="admin-command-head">
            <div>
              <span>Archive trend</span>
              <h3>Published benchmark history should be easy to scan by repository and scenario</h3>
              <p>The archive is not just a log. It is a commercial memory lane for what proof exists, where it clusters, and which accounts still need broader coverage.</p>
            </div>
          </header>
          <AdminBenchmarkTrendPanel reports={state.reports} />
        </section>

        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Repository coverage</span>
              <h3>Which repositories carry the proof right now</h3>
            </div>
          </header>
          <div className="admin-risk-list">
            {repositoryRows.slice(0, 5).map((row) => (
              <article key={row.repo} className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>{row.repo}</strong>
                  <span>{row.count} report(s) · {row.scenarioCount} scenario(s)</span>
                </div>
                <div className="admin-risk-meta">
                  <b>{row.avgRoi}</b>
                  <small>{row.avgTokenSave}% save</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${Math.min(100, row.avgRoi) }%` }} />
                </div>
              </article>
            ))}
          </div>
          <div className="admin-pill-grid">
            <ValuePill label="Reports" value={summary.reportCount} progress={Math.min(100, summary.reportCount * 10)} />
            <ValuePill label="Repos covered" value={summary.repositoryCount} progress={Math.min(100, summary.repositoryCount * 16)} />
            <ValuePill label="Avg token save" value={`${summary.avgTokenSave}%`} progress={summary.avgTokenSave} />
            <ValuePill label="Avg ROI" value={summary.avgRoi} progress={Math.min(100, summary.avgRoi)} />
          </div>
        </section>
      </div>

      <div className="admin-command-grid">
        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Scenario coverage</span>
              <h3>Which benchmark motions are actually represented</h3>
              <p>Commercial proof is stronger when multiple scenario types repeat across the customer base.</p>
            </div>
          </header>
          <div className="admin-data-table-shell">
            <table className="admin-data-table">
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
                    <td className="admin-table-primary">
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

        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Coverage leaders</span>
              <h3>Archive signals the owner should read first</h3>
            </div>
          </header>
          <div className="admin-summary-list">
            <article>
              <span>Repository leader</span>
              <strong>{summary.topRepository?.label ?? "Waiting on broader coverage"}</strong>
              <p>
                {summary.topRepository
                  ? `${summary.topRepository.report_count} report(s) · ${summary.topRepository.avg_token_savings_pct}% average token savings · ROI ${summary.topRepository.avg_roi_score}.`
                  : "No repository has published enough reports yet."}
              </p>
            </article>
            <article>
              <span>Scenario leader</span>
              <strong>{summary.topScenario?.label ?? "Waiting on scenario breadth"}</strong>
              <p>
                {summary.topScenario
                  ? `${summary.topScenario.report_count} report(s) · ${summary.topScenario.avg_token_savings_pct}% average token savings · ROI ${summary.topScenario.avg_roi_score}.`
                  : "Publish more benchmark scenarios before using this archive as pipeline proof."}
              </p>
            </article>
            <article>
              <span>Coverage posture</span>
              <strong>{summary.reportCount} reports across {summary.repositoryCount} repositories</strong>
              <p>{summary.scenarioCount} scenarios are currently represented in the internal benchmark archive.</p>
            </article>
          </div>
        </section>
      </div>

      <div className="admin-data-table-shell">
        <div className="admin-table-toolbar">
          <div className="admin-table-controls">
            <label className="admin-field">
              <span>Search reports</span>
              <input
                className="admin-input"
                type="search"
                value={archiveState.query}
                onChange={(event) =>
                  setArchiveState((current) => ({ ...current, query: event.target.value }))
                }
                placeholder="Scenario, repo, profile, or summary"
              />
            </label>
            <label className="admin-field">
              <span>ROI posture</span>
              <select
                className="admin-input"
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
          <p className="admin-table-summary">
            Showing {archiveRows.length} of {state.reports.length} reports.
          </p>
        </div>
        <table className="admin-data-table">
          <thead>
            <tr>
              <th aria-sort={getSortAria(archiveState, "scenario")}><button type="button" className="admin-table-sort" data-active={archiveState.sortKey === "scenario"} onClick={() => setArchiveState((current) => nextSortState(current, "scenario"))}>Scenario<span>{getSortLabel(archiveState, "scenario")}</span></button></th>
              <th aria-sort={getSortAria(archiveState, "repository")}><button type="button" className="admin-table-sort" data-active={archiveState.sortKey === "repository"} onClick={() => setArchiveState((current) => nextSortState(current, "repository"))}>Repository<span>{getSortLabel(archiveState, "repository")}</span></button></th>
              <th aria-sort={getSortAria(archiveState, "profile")}><button type="button" className="admin-table-sort" data-active={archiveState.sortKey === "profile"} onClick={() => setArchiveState((current) => nextSortState(current, "profile"))}>Profile<span>{getSortLabel(archiveState, "profile")}</span></button></th>
              <th aria-sort={getSortAria(archiveState, "token-save")}><button type="button" className="admin-table-sort" data-active={archiveState.sortKey === "token-save"} onClick={() => setArchiveState((current) => nextSortState(current, "token-save"))}>Token save<span>{getSortLabel(archiveState, "token-save")}</span></button></th>
              <th aria-sort={getSortAria(archiveState, "money-save")}><button type="button" className="admin-table-sort" data-active={archiveState.sortKey === "money-save"} onClick={() => setArchiveState((current) => nextSortState(current, "money-save"))}>Money save<span>{getSortLabel(archiveState, "money-save")}</span></button></th>
              <th aria-sort={getSortAria(archiveState, "memory-save")}><button type="button" className="admin-table-sort" data-active={archiveState.sortKey === "memory-save"} onClick={() => setArchiveState((current) => nextSortState(current, "memory-save"))}>Memory save<span>{getSortLabel(archiveState, "memory-save")}</span></button></th>
              <th aria-sort={getSortAria(archiveState, "roi")}><button type="button" className="admin-table-sort" data-active={archiveState.sortKey === "roi"} onClick={() => setArchiveState((current) => nextSortState(current, "roi"))}>ROI<span>{getSortLabel(archiveState, "roi")}</span></button></th>
              <th aria-sort={getSortAria(archiveState, "runtime")}><button type="button" className="admin-table-sort" data-active={archiveState.sortKey === "runtime"} onClick={() => setArchiveState((current) => nextSortState(current, "runtime"))}>Run time<span>{getSortLabel(archiveState, "runtime")}</span></button></th>
              <th />
            </tr>
          </thead>
          <tbody>
            {archiveRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="admin-table-empty">
                  No benchmark report matches the current search and filter state.
                </td>
              </tr>
            ) : (
              archiveRows.map((report) => (
                <tr key={report.report_id}>
                  <td className="admin-table-primary">
                    <strong>{report.scenarioLabel}</strong>
                    <small>{report.manager_summary}</small>
                  </td>
                  <td>{report.repo}</td>
                  <td>{report.profile_slug}</td>
                  <td>{report.tokenSavingsPct}%</td>
                  <td>${report.tokenCostSavingsUsd}</td>
                  <td>{report.memoryRefreshReductionPct}%</td>
                  <td>
                    <span className="admin-table-badge" data-tone={report.roiLabel === "Strong" ? "positive" : "neutral"}>
                      {report.roiScore}
                    </span>
                  </td>
                  <td>{formatTimestamp(report.generated_at)}</td>
                  <td className="admin-table-link">
                    <Link href={`/benchmarks/${report.report_id}`}>Inspect</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summarizeReports(reports) {
  const archiveSummary = buildAdminBenchmarkArchiveSummary(reports);
  return {
    reportCount: reports.length,
    repositoryCount: archiveSummary.repository_count,
    scenarioCount: archiveSummary.scenario_count,
    avgTokenSave: archiveSummary.avg_token_savings_pct,
    avgRoi: archiveSummary.avg_roi_score,
    topRepository: archiveSummary.top_repository,
    topScenario: archiveSummary.top_scenario,
  };
}

function buildRepositoryRows(reports) {
  const grouped = new Map();
  for (const report of reports) {
    const key = String(report.repo ?? "unknown");
    const existing = grouped.get(key) ?? {
      repo: key,
      count: 0,
      scenarios: new Set(),
      tokenSavings: [],
      roiScores: [],
    };
    existing.count += 1;
    existing.scenarios.add(String(report.scenario ?? ""));
    existing.tokenSavings.push(Number(report.metrics?.token_savings_pct ?? 0));
    existing.roiScores.push(Number(report.metrics?.composite_roi_score ?? 0));
    grouped.set(key, existing);
  }

  return [...grouped.values()]
    .map((entry) => ({
      repo: entry.repo,
      count: entry.count,
      scenarioCount: entry.scenarios.size,
      avgTokenSave: average(entry.tokenSavings),
      avgRoi: average(entry.roiScores),
    }))
    .sort((left, right) => right.avgRoi - left.avgRoi);
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

function average(values) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return Math.round((total / Math.max(values.length, 1)) * 10) / 10;
}

function ValuePill({ label, value, progress }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress ?? 0)));
  return (
    <article className="admin-value-pill">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="admin-mini-track" aria-hidden="true">
        <i className="admin-mini-fill" style={{ width: `${safeProgress}%` }} />
      </div>
    </article>
  );
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
    sortDirection: ["scenario", "repository", "profile"].includes(sortKey) ? "asc" : "desc",
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
