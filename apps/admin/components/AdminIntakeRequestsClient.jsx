"use client";

import { useEffect, useState } from "react";

import { fetchAdminJson } from "../src/api-client.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminIntakeRequestsClient() {
  const [state, setState] = useState({
    status: "loading",
    requests: [],
    summary: null,
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchAdminJson("/api/intake");
        if (active) {
          setState({
            status: "ready",
            requests: payload.requests ?? [],
            summary: payload.summary ?? null,
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            requests: [],
            summary: null,
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
        eyebrow="Intake"
        title="Loading demo and trial requests"
        description="The admin surface is pulling lead capture requests from the canonical service host."
      />
    );
  }

  if (state.status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Intake"
        title="Intake could not be loaded"
        description={state.error}
      />
    );
  }

  if (state.requests.length === 0 || !state.summary) {
    return (
      <AdminStateBlock
        tone="neutral"
        eyebrow="Intake"
        title="No demo or trial requests yet"
        description="Website lead capture is live, but no qualified requests have been submitted yet."
      />
    );
  }

  return (
    <div className="admin-intake-stack">
      <div className="admin-metric-strip">
        <div className="admin-metric-cell"><span>Total requests</span><strong>{state.summary.total_count}</strong></div>
        <div className="admin-metric-cell"><span>Demo requests</span><strong>{state.summary.demo_count}</strong></div>
        <div className="admin-metric-cell"><span>Trial requests</span><strong>{state.summary.trial_count}</strong></div>
        <div className="admin-metric-cell"><span>Avg team size</span><strong>{state.summary.avg_team_size}</strong></div>
      </div>

      <div className="admin-data-table-shell">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Kind</th>
              <th>Role</th>
              <th>Team</th>
              <th>Repos</th>
              <th>Goal</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {state.requests.slice(0, 8).map((request) => (
              <tr key={request.request_id}>
                <td className="admin-table-primary">
                  <strong>{request.company}</strong>
                  <small>
                    {request.full_name} · {request.work_email}
                  </small>
                </td>
                <td>
                  <span className="admin-table-badge" data-tone={request.intake_kind === "demo" ? "positive" : "neutral"}>
                    {request.intake_kind}
                  </span>
                </td>
                <td>{request.role}</td>
                <td>{request.team_size}</td>
                <td>{request.repo_count}</td>
                <td>{request.primary_goal}</td>
                <td>{request.source_page}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
