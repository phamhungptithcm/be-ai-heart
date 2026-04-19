"use client";

import { useEffect, useState } from "react";

import { fetchAdminJson } from "../src/api-client.js";
import { AdminBenchmarkTrendPanel, AdminRunComparisonBars } from "./AdminBenchmarkVisuals.jsx";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminBenchmarkSummaryClient() {
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

  if (state.status !== "ready") {
    return (
      <AdminStateBlock
        tone={state.status === "error" ? "error" : "loading"}
        eyebrow="Benchmarks"
        title={state.status === "error" ? "Benchmark summary unavailable" : "Loading benchmark summary"}
        description={state.status === "error" ? state.error : "The admin surface is aggregating benchmark proof for revenue and support review."}
      />
    );
  }

  const reportCount = state.reports.length;
  const avgTokenSavings = average(state.reports.map((report) => report.metrics?.token_savings_pct ?? 0));
  const avgCostSavings = average(state.reports.map((report) => report.metrics?.token_cost_savings_usd ?? 0));
  const avgMemorySavings = average(state.reports.map((report) => report.metrics?.memory_refresh_reduction_pct ?? 0));
  const avgRoi = average(state.reports.map((report) => report.metrics?.composite_roi_score ?? 0));
  const uniqueRepositoryCount = new Set(state.reports.map((report) => String(report.repo ?? ""))).size;
  const scenarioCount = new Set(state.reports.map((report) => String(report.scenario ?? ""))).size;
  const providerCount = new Set(state.reports.map((report) => String(report.provider ?? ""))).size;
  const latestReport =
    [...state.reports].sort((left, right) =>
      String(right.generated_at ?? "").localeCompare(String(left.generated_at ?? "")),
    )[0] ?? null;

  return (
    <div className="admin-stack-block">
      <div className="admin-command-metrics">
        <div className="admin-command-metric"><span>Reports</span><strong>{reportCount}</strong><p>Published benchmark reports visible to revenue, support, and platform operations.</p></div>
        <div className="admin-command-metric"><span>Repositories</span><strong>{uniqueRepositoryCount}</strong><p>How many repositories now have commercially usable proof.</p></div>
        <div className="admin-command-metric"><span>Scenarios</span><strong>{scenarioCount}</strong><p>Distinct scenario types already benchmarked in the hosted control plane.</p></div>
        <div className="admin-command-metric"><span>Avg token save</span><strong>{avgTokenSavings}%</strong><p>Average token reduction from published benchmark evidence.</p></div>
        <div className="admin-command-metric"><span>Avg ROI</span><strong>{avgRoi}</strong><p>Composite ROI score averaged across all currently published reports.</p></div>
      </div>

      <div className="admin-command-grid">
        <section className="admin-command-panel admin-command-panel-wide">
          <header className="admin-command-head">
            <div>
              <span>Benchmark proof</span>
              <h3>Commercial evidence and technical depth should stay aligned</h3>
              <p>Revenue and support need fast pattern recognition: which repositories are covered, which scenarios repeat, and whether the ROI story remains strong enough to expand.</p>
            </div>
          </header>
          <AdminBenchmarkTrendPanel reports={state.reports} />
        </section>

        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Latest benchmark</span>
              <h3>{latestReport ? formatScenarioLabel(latestReport.scenario) : "Waiting for first benchmark"}</h3>
              <p>{latestReport?.manager_summary ?? "A newly published report should immediately show what changed, why it matters, and how defensible the result is."}</p>
            </div>
          </header>
          {latestReport ? (
            <>
              <div className="admin-pill-grid">
                <ValuePill label="Cost delta" value={`$${latestReport.metrics?.token_cost_savings_usd ?? 0}`} progress={Math.min(100, Number(latestReport.metrics?.token_savings_pct ?? 0))} />
                <ValuePill label="Memory delta" value={`${latestReport.metrics?.memory_refresh_reduction_pct ?? 0}%`} progress={Math.min(100, Number(latestReport.metrics?.memory_refresh_reduction_pct ?? 0))} />
                <ValuePill label="Provider" value={latestReport.provider} progress={providerCount > 0 ? Math.round((1 / providerCount) * 100) : 0} />
                <ValuePill label="ROI" value={latestReport.metrics?.composite_roi_score ?? 0} progress={Math.min(100, Number(latestReport.metrics?.composite_roi_score ?? 0))} />
              </div>
              <AdminRunComparisonBars report={latestReport} />
            </>
          ) : (
            <p className="admin-command-empty">No benchmark report is available yet.</p>
          )}
        </section>
      </div>

      <div className="admin-data-table-shell">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Scenario</th>
              <th>Provider</th>
              <th>Token save</th>
              <th>Money save</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>
            {state.reports.slice(0, 8).map((report) => (
              <tr key={report.report_id}>
                <td className="admin-table-primary">
                  <strong>{report.repo}</strong>
                  <small>{report.profile_slug}</small>
                </td>
                <td>{formatScenarioLabel(report.scenario)}</td>
                <td>{report.provider}/{report.model}</td>
                <td>{report.metrics?.token_savings_pct ?? 0}%</td>
                <td>${report.metrics?.token_cost_savings_usd ?? 0}</td>
                <td>
                  <span className="admin-table-badge" data-tone={(report.metrics?.composite_roi_score ?? 0) >= 55 ? "positive" : "neutral"}>
                    {report.metrics?.composite_roi_score ?? 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
