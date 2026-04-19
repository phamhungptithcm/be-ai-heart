"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAdminJson } from "../src/api-client.js";
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

  return (
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
              <td>{report.metrics?.composite_roi_score ?? 0}</td>
              <td>{formatTimestamp(report.generated_at)}</td>
              <td className="admin-table-link">
                <Link href={`/benchmarks/${report.report_id}`}>Inspect</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
