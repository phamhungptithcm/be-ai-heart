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

  return (
    <div className="portal-stack-block">
      <div className="portal-stat-grid">
        <div><span>Reports</span><strong>{summary.report_count}</strong></div>
        <div><span>Avg Token Save</span><strong>{summary.avg_token_savings_pct}%</strong></div>
        <div><span>Avg Cost Save</span><strong>${summary.avg_cost_savings_usd}</strong></div>
        <div><span>Avg Memory Save</span><strong>{summary.avg_memory_refresh_reduction_pct}%</strong></div>
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

  return (
    <div className="portal-stack-block">
      <PortalBenchmarkTrendPanel reports={reports} />
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
                  {report.provider}/{report.model}
                </td>
                <td>{report.metrics?.token_savings_pct ?? 0}%</td>
                <td>${report.metrics?.token_cost_savings_usd ?? 0}</td>
                <td>{report.metrics?.memory_refresh_reduction_pct ?? 0}%</td>
                <td>{report.metrics?.composite_roi_score ?? 0}</td>
                <td>{formatTimestamp(report.generated_at)}</td>
                <td className="portal-table-link">
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
      avg_token_savings_pct: 0,
      avg_cost_savings_usd: 0,
      avg_memory_refresh_reduction_pct: 0,
    };
  }

  return {
    report_count: reports.length,
    avg_token_savings_pct: average(reports.map((report) => report.metrics?.token_savings_pct ?? 0)),
    avg_cost_savings_usd: average(reports.map((report) => report.metrics?.token_cost_savings_usd ?? 0)),
    avg_memory_refresh_reduction_pct: average(
      reports.map((report) => report.metrics?.memory_refresh_reduction_pct ?? 0),
    ),
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
