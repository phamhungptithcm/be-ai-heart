"use client";

import { useEffect, useState } from "react";

import { fetchPortalJson } from "../src/api-client.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalWorkspaceSummaryClient() {
  const [state, setState] = useState({
    status: "loading",
    workspaces: [],
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchPortalJson("/api/workspaces");

        if (active) {
          setState({
            status: "ready",
            workspaces: payload.workspaces ?? [],
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            workspaces: [],
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
      <PortalStateBlock
        tone={state.status === "error" ? "error" : "loading"}
        eyebrow="Workspace"
        title={state.status === "error" ? "Workspace summary unavailable" : "Loading workspace summary"}
        description={
          state.status === "error"
            ? state.error
            : "The portal is compiling tenant-scoped freshness, submission, and benchmark indicators."
        }
      />
    );
  }

  const summary = summarizeWorkspaces(state.workspaces);

  return (
    <div className="portal-stack-block">
      <div className="portal-metric-strip">
        <div className="portal-metric-cell"><span>Workspaces</span><strong>{summary.workspace_count}</strong></div>
        <div className="portal-metric-cell"><span>Queued updates</span><strong>{summary.queued_submission_count}</strong></div>
        <div className="portal-metric-cell"><span>Benchmark reports</span><strong>{summary.benchmark_report_count}</strong></div>
        <div className="portal-metric-cell"><span>Avg token save</span><strong>{summary.avg_token_savings_pct}%</strong></div>
      </div>

      <div className="portal-data-table-shell">
        <table className="portal-data-table">
          <thead>
            <tr>
              <th>Workspace</th>
              <th>Coverage</th>
              <th>Reports</th>
              <th>Queued</th>
              <th>Token save</th>
              <th>Memory save</th>
              <th>Last sync</th>
            </tr>
          </thead>
          <tbody>
            {state.workspaces.map((workspace) => (
              <tr key={workspace.workspace_slug}>
                <td className="portal-table-primary">
                  <strong>{workspace.repo}</strong>
                  <small>{workspace.workspace_slug}</small>
                </td>
                <td>
                  <span className="portal-table-badge" data-tone={workspace.profile_available && workspace.document_available ? "positive" : "neutral"}>
                    {workspace.profile_available && workspace.document_available ? "Ready" : "Partial"}
                  </span>
                </td>
                <td>{workspace.benchmark_report_count ?? 0}</td>
                <td>{workspace.queued_submission_count ?? 0}</td>
                <td>
                  <MetricBar value={workspace.avg_token_savings_pct ?? 0} suffix="%" />
                </td>
                <td>
                  <MetricBar value={workspace.avg_memory_refresh_reduction_pct ?? 0} suffix="%" />
                </td>
                <td>{formatTimestamp(workspace.latest_sync_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summarizeWorkspaces(workspaces) {
  return {
    workspace_count: workspaces.length,
    queued_submission_count: workspaces.reduce(
      (total, workspace) => total + Number(workspace.queued_submission_count ?? 0),
      0,
    ),
    benchmark_report_count: workspaces.reduce(
      (total, workspace) => total + Number(workspace.benchmark_report_count ?? 0),
      0,
    ),
    avg_token_savings_pct: average(
      workspaces
        .map((workspace) => Number(workspace.avg_token_savings_pct ?? 0))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  };
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function MetricBar({ value, suffix = "" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value ?? 0)));
  return (
    <div className="portal-table-stat">
      <strong>
        {safeValue}
        {suffix}
      </strong>
      <div className="portal-mini-track">
        <i className="portal-mini-fill" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function formatTimestamp(value) {
  if (!value) {
    return "Waiting for sync";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
