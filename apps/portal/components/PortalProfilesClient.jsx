"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchPortalJson } from "../src/api-client.js";
import { buildPortalRepositoryInventorySummary } from "../src/dashboard-visuals.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

function useProfiles() {
  const [state, setState] = useState({
    status: "loading",
    profiles: [],
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchPortalJson("/api/repositories");

        if (active) {
          setState({
            status: "ready",
            profiles: payload.profiles ?? [],
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            profiles: [],
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

export function PortalProfilesClient() {
  const { status, profiles, error } = useProfiles();

  if (status === "loading") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Profiles"
        title="Loading synced repository profiles"
        description="The portal is checking tenant-scoped repository memory and mirrored diagram artifacts."
      />
    );
  }

  if (status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Profiles"
        title="Repository profiles could not be loaded"
        description={error}
        actions={[{ href: "/documents", label: "Check documents" }, { href: "/sign-in", label: "Review session" }]}
      />
    );
  }

  if (profiles.length === 0) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Profiles"
        title="No repository profile has been synced yet"
        description="Run heart scan and heart diagram sync from the CLI, then come back here to inspect diagrams, docs, and efficiency signals."
        actions={[{ href: "/documents", label: "Review document flow" }, { href: "/usage", label: "Open usage" }]}
      />
    );
  }

  const summary = buildPortalRepositoryInventorySummary(profiles);
  const rows = profiles
    .map((profile) => {
      const documentCount = Number(profile.documents?.document_count ?? 0);
      const warningCount = Number(profile.overview?.policy_warnings ?? 0);
      const benchmarkCount = Number(profile.benchmark_report_count ?? 0);
      const memoryReady = documentCount > 0;
      const status = String(profile.cache?.status ?? "unknown");
      const readinessScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (memoryReady ? 42 : 16) +
              Math.min(20, benchmarkCount * 18) +
              Math.min(24, Number(profile.heart?.relationship_count ?? 0) / 35) -
              Math.min(22, warningCount * 11) -
              (status === "stale" || status === "rebuild" ? 18 : 0),
          ),
        ),
      );

      return {
        ...profile,
        documentCount,
        warningCount,
        benchmarkCount,
        memoryReady,
        status,
        readinessScore,
        readinessLabel:
          readinessScore >= 78
            ? "Ready"
            : readinessScore >= 55
              ? "Watch"
              : "Needs work",
      };
    })
    .sort((left, right) => right.readinessScore - left.readinessScore);

  const actions = [
    {
      key: "stale",
      label: "Repos needing resync",
      count: summary.stale_count,
      href: "/documents",
      severity: summary.stale_count > 0 ? "warning" : "healthy",
      summary:
        summary.stale_count > 0
          ? "Refresh stale or rebuilt repositories before trusting current diagrams or memory coverage."
          : "No repository is currently marked stale.",
    },
    {
      key: "memory",
      label: "Missing document memory",
      count: Math.max(0, summary.total - summary.memory_ready_count),
      href: "/documents",
      severity:
        summary.total - summary.memory_ready_count > 0 ? "warning" : "healthy",
      summary:
        summary.total - summary.memory_ready_count > 0
          ? "Some repositories still lack synced requirements or business memory."
          : "All mirrored repositories have document memory attached.",
    },
    {
      key: "benchmarks",
      label: "Missing benchmark proof",
      count: Math.max(0, summary.total - summary.benchmark_backed_count),
      href: "/benchmarks",
      severity:
        summary.total - summary.benchmark_backed_count > 0
          ? "critical"
          : "healthy",
      summary:
        summary.total - summary.benchmark_backed_count > 0
          ? "Publish benchmark evidence before treating these repos as rollout-ready."
          : "Every repository already has benchmark coverage.",
    },
    {
      key: "warnings",
      label: "Policy warnings to resolve",
      count: summary.warning_count,
      href: "/usage",
      severity: summary.warning_count > 0 ? "critical" : "healthy",
      summary:
        summary.warning_count > 0
          ? "Architecture or policy warnings are still attached to mirrored repository profiles."
          : "No active policy warnings are attached to current profiles.",
    },
  ];

  return (
    <div className="portal-enterprise-stack">
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Repository coverage</span>
            <h3>Memory readiness and sync truth across the tenant</h3>
            <p>
              Repository inventory should tell a platform lead which codebases are
              current, benchmarked, and safe to scale with BeHeart-assisted AI.
            </p>
          </div>
          <div className="portal-enterprise-panel-actions">
            <Link href="/documents" className="portal-button-link">
              Document lane
            </Link>
            <Link href="/benchmarks" className="portal-button-link portal-button-link-primary">
              Benchmark proof
            </Link>
          </div>
        </div>
        <div className="portal-kpi-grid">
          <article className="portal-kpi-card"><span>Repositories</span><strong>{summary.total}</strong></article>
          <article className="portal-kpi-card"><span>Memory ready</span><strong>{summary.memory_ready_count}</strong></article>
          <article className="portal-kpi-card"><span>Stale repos</span><strong>{summary.stale_count}</strong></article>
          <article className="portal-kpi-card"><span>Benchmark backed</span><strong>{summary.benchmark_backed_count}</strong></article>
          <article className="portal-kpi-card"><span>Document count</span><strong>{summary.document_count}</strong></article>
          <article className="portal-kpi-card"><span>Heart links</span><strong>{summary.relationship_count}</strong></article>
          <article className="portal-kpi-card"><span>Policy warnings</span><strong>{summary.warning_count}</strong></article>
          <article className="portal-kpi-card"><span>Readiness pct</span><strong>{summary.memory_ready_pct}%</strong></article>
        </div>
      </section>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Readiness mix</span>
              <h3>How complete the repository lane really is</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            <article>
              <span>Memory coverage</span>
              <strong>{summary.memory_ready_pct}% of repositories have synced docs</strong>
              <p>Document memory is the minimum bar before AI work can claim durable project understanding.</p>
            </article>
            <article>
              <span>Benchmark coverage</span>
              <strong>{summary.benchmark_backed_pct}% of repositories have ROI evidence</strong>
              <p>Expansion should follow measured benchmark proof, not just successful scans.</p>
            </article>
            <article>
              <span>Stability</span>
              <strong>{summary.stale_count === 0 ? "Fresh sync posture" : `${summary.stale_count} repo(s) need refresh`}</strong>
              <p>Stale syncs weaken trust in diagrams, documents, and reuse guidance.</p>
            </article>
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Action queue</span>
              <h3>What should the tenant fix next</h3>
            </div>
          </div>
          <div className="portal-action-list">
            {actions.map((action) => (
              <article key={action.key} className="portal-action-item">
                <div className="portal-action-copy">
                  <span className={`portal-action-severity portal-action-severity-${action.severity}`}>
                    {action.severity}
                  </span>
                  <strong>{action.label}</strong>
                  <p>{action.summary}</p>
                </div>
                <div className="portal-action-meta">
                  <b>{action.count}</b>
                  <Link href={action.href} className="portal-table-link">
                    Open
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Repository table</span>
            <h3>Operational inventory for sync, architecture, and benchmark follow-through</h3>
            <p>
              This table should be dense enough for engineering leads to decide
              where to resync, where to benchmark, and which repositories are safe
              to expand next.
            </p>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Readiness</th>
                <th>Sync truth</th>
                <th>Documents</th>
                <th>Heart links</th>
                <th>Benchmarks</th>
                <th>Warnings</th>
                <th>Last sync</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((profile) => (
                <tr key={profile.profile_slug}>
                  <td className="portal-table-primary">
                    <strong>{profile.repo}</strong>
                    <small>{profile.overview.summary}</small>
                  </td>
                  <td>
                    <div className="portal-table-stat">
                      <strong>{profile.readinessScore}%</strong>
                      <div className="portal-mini-track" aria-hidden="true">
                        <i className="portal-mini-fill" style={{ width: `${profile.readinessScore}%` }} />
                      </div>
                      <span className="portal-table-badge" data-tone={profile.readinessLabel === "Ready" ? "positive" : "neutral"}>
                        {profile.readinessLabel}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="portal-table-badge" data-tone={profile.status === "updated" || profile.status === "hit" ? "positive" : "neutral"}>
                      {profile.status}
                    </span>
                  </td>
                  <td>{profile.documentCount}</td>
                  <td>{profile.heart?.relationship_count ?? 0}</td>
                  <td>{profile.benchmarkCount}</td>
                  <td>{profile.warningCount}</td>
                  <td>{formatTimestamp(profile.generated_at)}</td>
                  <td className="portal-table-link">
                    <Link href={`/repositories/${profile.profile_slug}`}>Open</Link>
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

function formatTimestamp(value) {
  const safeValue = String(value ?? "").trim();
  return safeValue ? safeValue.slice(0, 16).replace("T", " ") : "Not yet";
}

export function PortalBenchmarkSummaryClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return <p className="portal-empty">{status === "error" ? error : "Loading benchmark summary..."}</p>;
  }

  const documentCount = profiles.reduce((total, profile) => total + (profile.documents?.document_count ?? 0), 0);
  const symbolCount = profiles.reduce((total, profile) => total + (profile.overview?.symbol_count ?? 0), 0);

  return (
    <div className="portal-metric-strip">
      <div className="portal-metric-cell"><span>Profiles</span><strong>{profiles.length}</strong></div>
      <div className="portal-metric-cell"><span>Documents</span><strong>{documentCount}</strong></div>
      <div className="portal-metric-cell"><span>Symbols</span><strong>{symbolCount}</strong></div>
      <div className="portal-metric-cell"><span>Status</span><strong>{profiles.length > 0 ? "Synced" : "Waiting"}</strong></div>
    </div>
  );
}

export function PortalUsageSummaryClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return <p className="portal-empty">{status === "error" ? error : "Loading usage summary..."}</p>;
  }

  const relationshipCount = profiles.reduce((total, profile) => total + (profile.heart?.relationship_count ?? 0), 0);
  const domainCount = profiles.reduce((total, profile) => total + (profile.heart?.domain_count ?? 0), 0);

  return (
    <div className="portal-metric-strip">
      <div className="portal-metric-cell"><span>Profiles</span><strong>{profiles.length}</strong></div>
      <div className="portal-metric-cell"><span>Heart links</span><strong>{relationshipCount}</strong></div>
      <div className="portal-metric-cell"><span>Domains</span><strong>{domainCount}</strong></div>
      <div className="portal-metric-cell"><span>Workspace</span><strong>Tenant-scoped</strong></div>
    </div>
  );
}
