"use client";

import { useEffect, useState } from "react";

import { fetchAdminJson } from "../src/api-client.js";
import { AdminBenchmarkTrendPanel } from "./AdminBenchmarkVisuals.jsx";
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

  return (
    <div className="admin-stack-block">
      <div className="admin-metric-strip">
        <div className="admin-metric-cell"><span>Reports</span><strong>{reportCount}</strong></div>
        <div className="admin-metric-cell"><span>Avg token save</span><strong>{avgTokenSavings}%</strong></div>
        <div className="admin-metric-cell"><span>Avg memory save</span><strong>{avgMemorySavings}%</strong></div>
        <div className="admin-metric-cell"><span>Avg cost save</span><strong>${avgCostSavings}</strong></div>
      </div>
      <AdminBenchmarkTrendPanel reports={state.reports} />
      <div className="admin-data-table-shell">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Scenario</th>
              <th>Token save</th>
              <th>Money save</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>
            {state.reports.slice(0, 5).map((report) => (
              <tr key={report.report_id}>
                <td className="admin-table-primary">
                  <strong>{report.repo}</strong>
                  <small>{report.profile_slug}</small>
                </td>
                <td>{report.scenario}</td>
                <td>{report.metrics?.token_savings_pct ?? 0}%</td>
                <td>${report.metrics?.token_cost_savings_usd ?? 0}</td>
                <td>{report.metrics?.composite_roi_score ?? 0}</td>
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
