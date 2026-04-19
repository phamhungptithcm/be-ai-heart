"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAdminJson } from "../src/api-client.js";
import { AdminBenchmarkTrendPanel } from "./AdminBenchmarkVisuals.jsx";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminBenchmarkHistoryClient() {
  const [state, setState] = useState({
    status: "loading",
    reports: [],
    error: "",
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

  const summary = summarizeReports(state.reports);
  const repositoryRows = buildRepositoryRows(state.reports);

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

      <div className="admin-data-table-shell">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Repository</th>
              <th>Profile</th>
              <th>Token save</th>
              <th>Money save</th>
              <th>Memory save</th>
              <th>ROI</th>
              <th>Run time</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.reports.map((report) => (
              <tr key={report.report_id}>
                <td className="admin-table-primary">
                  <strong>{formatScenarioLabel(report.scenario)}</strong>
                  <small>{report.manager_summary}</small>
                </td>
                <td>{report.repo}</td>
                <td>{report.profile_slug}</td>
                <td>{report.metrics?.token_savings_pct ?? 0}%</td>
                <td>${report.metrics?.token_cost_savings_usd ?? 0}</td>
                <td>{report.metrics?.memory_refresh_reduction_pct ?? 0}%</td>
                <td>
                  <span className="admin-table-badge" data-tone={(report.metrics?.composite_roi_score ?? 0) >= 55 ? "positive" : "neutral"}>
                    {report.metrics?.composite_roi_score ?? 0}
                  </span>
                </td>
                <td>{formatTimestamp(report.generated_at)}</td>
                <td className="admin-table-link">
                  <Link href={`/benchmarks/${report.report_id}`}>Inspect</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summarizeReports(reports) {
  return {
    reportCount: reports.length,
    repositoryCount: new Set(reports.map((report) => String(report.repo ?? ""))).size,
    avgTokenSave: average(reports.map((report) => Number(report.metrics?.token_savings_pct ?? 0))),
    avgRoi: average(reports.map((report) => Number(report.metrics?.composite_roi_score ?? 0))),
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
