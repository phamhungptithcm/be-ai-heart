"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchPortalJson } from "../src/api-client.js";
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
          <article className="portal-kpi-card"><span>Repositories</span><strong>{summary.unique_repository_count}</strong></article>
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
            </div>
          ) : null}
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Reading standard</span>
              <h3>What makes benchmark proof usable</h3>
            </div>
          </div>
          <div className="portal-readiness-list">
            <article className="portal-readiness-row">
              <div className="portal-readiness-copy">
                <strong>Manager ready</strong>
                <span>The summary should explain value in budget and delivery language, not just raw tokens.</span>
              </div>
              <div className="portal-readiness-meta">
                <b>{summary.report_count}</b>
                <small>Reports</small>
              </div>
            </article>
            <article className="portal-readiness-row">
              <div className="portal-readiness-copy">
                <strong>Engineer credible</strong>
                <span>Reports must still map back to scenarios, models, and concrete repository work.</span>
              </div>
              <div className="portal-readiness-meta">
                <b>{summary.scenario_count}</b>
                <small>Scenarios</small>
              </div>
            </article>
            <article className="portal-readiness-row">
              <div className="portal-readiness-copy">
                <strong>Expansion-worthy</strong>
                <span>Coverage across repositories matters more than one impressive isolated benchmark.</span>
              </div>
              <div className="portal-readiness-meta">
                <b>{summary.unique_repository_count}</b>
                <small>Repos</small>
              </div>
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
  const scenarioRows = buildScenarioRows(reports);

  return (
    <div className="portal-enterprise-stack">
      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Coverage map</span>
              <h3>Which scenarios are actually carrying proof today</h3>
              <p>Scenario concentration matters. If ROI only exists for one task type, the rollout story is still narrow.</p>
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
              <span>Archive posture</span>
              <h3>How complete the current proof lane is</h3>
            </div>
          </div>
          <div className="portal-readiness-list">
            <article className="portal-readiness-row">
              <div className="portal-readiness-copy">
                <strong>Report volume</strong>
                <span>Published reports should continue to grow with repository adoption.</span>
              </div>
              <div className="portal-readiness-meta">
                <b>{summary.report_count}</b>
                <small>Reports</small>
              </div>
            </article>
            <article className="portal-readiness-row">
              <div className="portal-readiness-copy">
                <strong>Repo coverage</strong>
                <span>Customers need proof across the repositories they actually want to expand.</span>
              </div>
              <div className="portal-readiness-meta">
                <b>{summary.unique_repository_count}</b>
                <small>Repos</small>
              </div>
            </article>
            <article className="portal-readiness-row">
              <div className="portal-readiness-copy">
                <strong>Provider diversity</strong>
                <span>Evidence should remain believable even if multiple models or providers are in use.</span>
              </div>
              <div className="portal-readiness-meta">
                <b>{summary.provider_count}</b>
                <small>Providers</small>
              </div>
            </article>
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
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Repository</th>
                <th>Model</th>
                <th>Token save</th>
                <th>Money save</th>
                <th>Memory save</th>
                <th>ROI</th>
                <th>Run time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.report_id}>
                  <td className="portal-table-primary">
                    <strong>{formatScenarioLabel(report.scenario)}</strong>
                    <small>{report.manager_summary}</small>
                  </td>
                  <td>{report.repo}</td>
                  <td>
                    <div className="portal-table-stat">
                      <strong>{report.model}</strong>
                      <span>{report.provider}</span>
                    </div>
                  </td>
                  <td>{report.metrics?.token_savings_pct ?? 0}%</td>
                  <td>${report.metrics?.token_cost_savings_usd ?? 0}</td>
                  <td>{report.metrics?.memory_refresh_reduction_pct ?? 0}%</td>
                  <td>
                    <span className="portal-table-badge" data-tone={(report.metrics?.composite_roi_score ?? 0) >= 55 ? "positive" : "neutral"}>
                      {report.metrics?.composite_roi_score ?? 0}
                    </span>
                  </td>
                  <td>{formatTimestamp(report.generated_at)}</td>
                  <td className="portal-table-link">
                    <Link href={`/benchmarks/${report.report_id}`}>Inspect</Link>
                  </td>
                </tr>
              ))}
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
      unique_repository_count: 0,
      scenario_count: 0,
      provider_count: 0,
      avg_token_savings_pct: 0,
      avg_cost_savings_usd: 0,
      avg_memory_refresh_reduction_pct: 0,
      avg_roi_score: 0,
    };
  }

  return {
    report_count: reports.length,
    unique_repository_count: new Set(reports.map((report) => String(report.repo ?? ""))).size,
    scenario_count: new Set(reports.map((report) => String(report.scenario ?? ""))).size,
    provider_count: new Set(reports.map((report) => String(report.provider ?? ""))).size,
    avg_token_savings_pct: average(reports.map((report) => report.metrics?.token_savings_pct ?? 0)),
    avg_cost_savings_usd: average(reports.map((report) => report.metrics?.token_cost_savings_usd ?? 0)),
    avg_memory_refresh_reduction_pct: average(
      reports.map((report) => report.metrics?.memory_refresh_reduction_pct ?? 0),
    ),
    avg_roi_score: average(reports.map((report) => report.metrics?.composite_roi_score ?? 0)),
  };
}

function average(values) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return Math.round((total / Math.max(values.length, 1)) * 10) / 10;
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
