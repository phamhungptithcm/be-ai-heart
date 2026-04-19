"use client";

import { useEffect, useState } from "react";

import { fetchAdminJson } from "../src/api-client.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";
import {
  AdminBenchmarkTrendPanel,
  AdminRunComparisonBars,
} from "./AdminBenchmarkVisuals.jsx";

export function AdminRevenueCommandCenterClient() {
  const [state, setState] = useState({
    status: "loading",
    requests: [],
    requestSummary: null,
    reports: [],
    workspaces: [],
    lastLoadedAt: "",
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [intakePayload, benchmarkPayload, workspacePayload] = await Promise.all([
          fetchAdminJson("/api/intake"),
          fetchAdminJson("/api/benchmarks"),
          fetchAdminJson("/api/workspaces"),
        ]);

        if (!active) {
          return;
        }

        setState({
          status: "ready",
          requests: intakePayload.requests ?? [],
          requestSummary: intakePayload.summary ?? null,
          reports: benchmarkPayload.reports ?? [],
          workspaces: workspacePayload.workspaces ?? [],
          lastLoadedAt: new Date().toISOString(),
          error: "",
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          status: "error",
          requests: [],
          requestSummary: null,
          reports: [],
          workspaces: [],
          lastLoadedAt: "",
          error: error.message,
        });
      }
    }

    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (state.status === "loading") {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Revenue cockpit"
        title="Loading commercial and ops signals"
        description="BeHeart admin is aggregating intake, benchmark proof, and workspace posture into an owner-ready control view."
      />
    );
  }

  if (state.status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Revenue cockpit"
        title="Commercial and ops signals unavailable"
        description={state.error}
      />
    );
  }

  const summary = summarizeRevenueCommandCenter(state);
  const stageRows = buildStageRows(state);
  const workspaceRows = buildRevenueWorkspaceRows(state.workspaces);
  const requestRows = buildRequestRows(state.requests);
  const latestReport = [...state.reports]
    .sort((left, right) => String(right.generated_at ?? "").localeCompare(String(left.generated_at ?? "")))[0] ?? null;

  return (
    <div className="admin-dashboard-stack">
      <div className="admin-dashboard-livebar">
        <StatusPill label="Live sync cadence" value="30s poll" tone="positive" />
        <StatusPill label="Commercial source" value="Hosted API + intake DB" />
        <StatusPill label="Last refresh" value={formatTimestamp(state.lastLoadedAt)} />
        <StatusPill label="Pipeline posture" value={`${summary.pipeline_count} active accounts`} />
      </div>

      <div className="admin-command-metrics">
        <MetricCell
          label="Open pipeline"
          value={summary.pipeline_count}
          detail={`${summary.demo_count} demo requests · ${summary.trial_count} trial requests`}
        />
        <MetricCell
          label="Benchmark-backed accounts"
          value={summary.benchmark_backed_workspace_count}
          detail={`${summary.report_count} published ROI reports available`}
        />
        <MetricCell
          label="Average ROI"
          value={summary.avg_roi_score}
          detail={`${summary.avg_token_savings_pct}% token save across benchmarked scenarios`}
        />
        <MetricCell
          label="Expansion-ready workspaces"
          value={summary.expansion_ready_workspace_count}
          detail="Ready means memory coverage exists and benchmark proof is already visible"
        />
        <MetricCell
          label="Queue pressure"
          value={summary.queued_submission_count}
          detail="Customer submissions still waiting on follow-through or support"
        />
      </div>

      <div className="admin-command-grid">
        <section className="admin-command-panel admin-command-panel-wide">
          <header className="admin-command-head">
            <div>
              <span>Commercial proof</span>
              <h3>Revenue posture must stay tied to benchmark evidence</h3>
              <p>BeHeart should not look healthy just because leads exist. Admin needs proof that accounts are seeing ROI and can justify expansion.</p>
            </div>
          </header>
          {state.reports.length > 0 ? (
            <AdminBenchmarkTrendPanel reports={state.reports} />
          ) : (
            <p className="admin-command-empty">Publish benchmark reports before using this surface to judge expansion or pricing readiness.</p>
          )}
          <div className="admin-analytics-grid">
            {latestReport ? (
              <div className="admin-analytics-panel">
                <div className="admin-analytics-head">
                  <div>
                    <span>Latest benchmark</span>
                    <strong>{formatScenarioLabel(latestReport.scenario)}</strong>
                  </div>
                  <small>
                    {latestReport.provider}/{latestReport.model}
                  </small>
                </div>
                <AdminRunComparisonBars report={latestReport} />
              </div>
            ) : null}
            <div className="admin-analytics-panel">
              <div className="admin-analytics-head">
                <div>
                  <span>Demand mix</span>
                  <strong>Who is asking for help and what kind of motion fits</strong>
                </div>
                <small>{summary.demo_count} demo · {summary.trial_count} trial</small>
              </div>
              <div className="admin-pill-grid">
                <ValuePill
                  label="Demo share"
                  value={`${percentage(summary.demo_count, summary.pipeline_count)}%`}
                  progress={percentage(summary.demo_count, summary.pipeline_count)}
                />
                <ValuePill
                  label="Trial share"
                  value={`${percentage(summary.trial_count, summary.pipeline_count)}%`}
                  progress={percentage(summary.trial_count, summary.pipeline_count)}
                />
                <ValuePill
                  label="Avg team size"
                  value={summary.avg_team_size}
                  progress={Math.min(100, Number(summary.avg_team_size ?? 0) * 5)}
                />
                <ValuePill
                  label="Avg repo count"
                  value={summary.avg_repo_count}
                  progress={Math.min(100, Number(summary.avg_repo_count ?? 0) * 12)}
                />
              </div>
            </div>
          </div>
          <div className="admin-stage-board">
            {stageRows.map((stage) => (
              <article key={stage.label} className="admin-stage-row">
                <div className="admin-stage-copy">
                  <strong>{stage.label}</strong>
                  <span>{stage.description}</span>
                </div>
                <div className="admin-stage-metric">
                  <b>{stage.count}</b>
                  <small>{stage.share}%</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${stage.share}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Customer risk</span>
              <h3>Which workspaces are worth expansion and which ones need intervention?</h3>
              <p>Queue depth, missing memory, and weak ROI should appear here before they become churn or support drag.</p>
            </div>
          </header>
          <div className="admin-risk-list">
            {workspaceRows.slice(0, 6).map((workspace) => (
              <article key={workspace.workspace_slug} className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>{workspace.repo}</strong>
                  <span>{workspace.workspace_slug}</span>
                </div>
                <div className="admin-risk-meta">
                  <b>{workspace.score}%</b>
                  <small>{workspace.status}</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${workspace.score}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-command-panel">
        <header className="admin-command-head">
          <div>
            <span>Pipeline review</span>
            <h3>Qualification table for revenue, support, and rollout judgment</h3>
            <p>This should help the owner decide which inbound accounts deserve a guided pilot, which need self-serve nurture, and which are too early.</p>
          </div>
        </header>
        <div className="admin-data-table-shell">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Intent</th>
                <th>Team</th>
                <th>Repos</th>
                <th>Qualification</th>
                <th>Suggested motion</th>
              </tr>
            </thead>
            <tbody>
              {requestRows.map((request) => (
                <tr key={request.request_id}>
                  <td className="admin-table-primary">
                    <strong>{request.company}</strong>
                    <small>{request.full_name} · {request.work_email}</small>
                  </td>
                  <td>{request.primary_goal}</td>
                  <td>{request.team_size}</td>
                  <td>{request.repo_count}</td>
                  <td>
                    <div className="admin-table-stat">
                      <strong>{request.qualification_score}%</strong>
                      <div className="admin-mini-track" aria-hidden="true">
                        <i className="admin-mini-fill" style={{ width: `${request.qualification_score}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="admin-table-badge" data-tone={request.motion_tone}>
                      {request.motion}
                    </span>
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

function MetricCell({ label, value, detail }) {
  return (
    <div className="admin-command-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

function StatusPill({ label, value, tone = "neutral" }) {
  return (
    <div className="admin-status-pill" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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

function summarizeRevenueCommandCenter({ requests, requestSummary, reports, workspaces }) {
  const benchmarkBackedWorkspaceCount = workspaces.filter(
    (workspace) => Number(workspace.benchmark_report_count ?? 0) > 0,
  ).length;
  const expansionReadyWorkspaceCount = workspaces.filter((workspace) => computeWorkspaceScore(workspace) >= 70).length;

  return {
    pipeline_count: Number(requestSummary?.total_count ?? requests.length),
    demo_count: Number(requestSummary?.demo_count ?? 0),
    trial_count: Number(requestSummary?.trial_count ?? 0),
    avg_team_size: Number(requestSummary?.avg_team_size ?? 0),
    avg_repo_count: Number(requestSummary?.avg_repo_count ?? 0),
    report_count: reports.length,
    avg_roi_score: average(reports.map((report) => Number(report.metrics?.composite_roi_score ?? 0))),
    avg_token_savings_pct: average(reports.map((report) => Number(report.metrics?.token_savings_pct ?? 0))),
    benchmark_backed_workspace_count: benchmarkBackedWorkspaceCount,
    expansion_ready_workspace_count: expansionReadyWorkspaceCount,
    queued_submission_count: workspaces.reduce(
      (total, workspace) => total + Number(workspace.queued_submission_count ?? 0),
      0,
    ),
  };
}

function buildStageRows({ requests, requestSummary, workspaces }) {
  const totalRequests = Math.max(Number(requestSummary?.total_count ?? requests.length), 1);
  const demoCount = Number(requestSummary?.demo_count ?? 0);
  const trialCount = Number(requestSummary?.trial_count ?? 0);
  const benchmarkBacked = workspaces.filter((workspace) => Number(workspace.benchmark_report_count ?? 0) > 0).length;
  const expansionReady = workspaces.filter((workspace) => computeWorkspaceScore(workspace) >= 70).length;

  return [
    {
      label: "Inbound demand",
      description: "All website trial and demo requests in the active queue",
      count: totalRequests,
      share: 100,
    },
    {
      label: "Guided evaluation",
      description: "Accounts asking for demo-led help rather than pure self-serve trial",
      count: demoCount,
      share: percentage(demoCount, totalRequests),
    },
    {
      label: "Benchmark-backed",
      description: "Workspaces already showing ROI evidence that sales or support can reuse",
      count: benchmarkBacked,
      share: percentage(benchmarkBacked, totalRequests),
    },
    {
      label: "Expansion-ready",
      description: "Accounts with enough memory depth and benchmark proof to justify a larger rollout",
      count: expansionReady,
      share: percentage(expansionReady, totalRequests),
    },
    {
      label: "Self-serve trial",
      description: "Teams likely better served by docs, product UX, and lower-touch onboarding",
      count: trialCount,
      share: percentage(trialCount, totalRequests),
    },
  ];
}

function buildRevenueWorkspaceRows(workspaces) {
  return [...workspaces]
    .map((workspace) => {
      const score = computeWorkspaceScore(workspace);
      return {
        workspace_slug: workspace.workspace_slug,
        repo: workspace.repo,
        score,
        status:
          score >= 78
            ? "Expansion-ready"
            : score >= 60
              ? "Watch closely"
              : "Intervention needed",
      };
    })
    .sort((left, right) => right.score - left.score);
}

function buildRequestRows(requests) {
  return [...requests]
    .map((request) => {
      const qualificationScore = computeQualificationScore(request);
      return {
        ...request,
        qualification_score: qualificationScore,
        motion:
          qualificationScore >= 75
            ? "High-touch pilot"
            : qualificationScore >= 50
              ? "Qualified nurture"
              : "Self-serve first",
        motion_tone: qualificationScore >= 75 ? "positive" : "neutral",
      };
    })
    .sort((left, right) => right.qualification_score - left.qualification_score)
    .slice(0, 8);
}

function computeQualificationScore(request) {
  const repoCount = Number(request.repo_count ?? 0);
  const teamSize = Number(request.team_size ?? 0);
  const isDemo = String(request.intake_kind ?? "") === "demo";
  let score = 20;
  score += Math.min(20, repoCount * 6);
  score += Math.min(24, teamSize * 2);
  if (isDemo) {
    score += 18;
  }
  if (/security|governance|benchmark|cost|token/i.test(String(request.primary_goal ?? ""))) {
    score += 14;
  }

  return Math.max(0, Math.min(100, round(score)));
}

function computeWorkspaceScore(workspace) {
  let score = 14;
  if (workspace.profile_available) {
    score += 18;
  }
  if (workspace.document_available) {
    score += 18;
  }
  if (Number(workspace.benchmark_report_count ?? 0) > 0) {
    score += 18;
  }
  score += Math.min(18, Number(workspace.avg_token_savings_pct ?? 0) * 0.45);
  score += Math.min(16, Number(workspace.avg_memory_refresh_reduction_pct ?? 0) * 0.25);
  score -= Math.min(18, Number(workspace.queued_submission_count ?? 0) * 5);

  return Math.max(0, Math.min(100, round(score)));
}

function average(values) {
  const safeValues = values.filter((value) => Number.isFinite(Number(value)));
  if (safeValues.length === 0) {
    return 0;
  }

  return round(
    safeValues.reduce((sum, value) => sum + Number(value), 0) / safeValues.length,
  );
}

function percentage(value, total) {
  if (!total) {
    return 0;
  }

  return Math.max(0, Math.min(100, round((Number(value ?? 0) / Number(total)) * 100)));
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function formatTimestamp(value) {
  if (!value) {
    return "Waiting for sync";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatScenarioLabel(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
