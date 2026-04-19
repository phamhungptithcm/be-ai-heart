"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAdminJson } from "../src/api-client.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

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
        const payload = await fetchAdminJson("/api/repositories");

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

export function AdminProfilesClient() {
  const { status, profiles, error } = useProfiles();

  if (status === "loading") {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Customers"
        title="Loading mirrored customer profiles"
        description="The admin plane is pulling the current support inventory across tenant-scoped repository profiles."
      />
    );
  }

  if (status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Customers"
        title="Customer profiles could not be loaded"
        description={error}
        actions={[{ href: "/support", label: "Open support" }, { href: "/ops-health", label: "Check ops health" }]}
      />
    );
  }

  if (profiles.length === 0) {
    return (
      <AdminStateBlock
        tone="neutral"
        eyebrow="Customers"
        title="No customer profile has been mirrored yet"
        description="Support inventory will appear here after the first repository profile is published through the hosted service layer."
        actions={[{ href: "/documents", label: "Review document lane" }]}
      />
    );
  }

  const summary = summarizeProfiles(profiles);
  const rows = profiles
    .map((profile) => {
      const documentCount = Number(profile.documents?.document_count ?? 0);
      const warningCount = Number(profile.overview?.policy_warnings ?? 0);
      const benchmarkCount = Number(profile.benchmark_report_count ?? 0);
      const syncStatus = String(profile.cache?.status ?? "unknown");
      const readinessScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (documentCount > 0 ? 36 : 14) +
              Math.min(18, benchmarkCount * 16) +
              Math.min(26, Number(profile.heart?.relationship_count ?? 0) / 30) -
              Math.min(18, warningCount * 9) -
              (syncStatus === "stale" || syncStatus === "rebuild" ? 18 : 0),
          ),
        ),
      );

      return {
        ...profile,
        documentCount,
        warningCount,
        benchmarkCount,
        syncStatus,
        readinessScore,
      };
    })
    .sort((left, right) => right.readinessScore - left.readinessScore);
  const actions = [
    {
      label: "Stale mirrored repos",
      count: summary.staleCount,
      note:
        summary.staleCount > 0
          ? "Support should not trust repository profiles that need resync or rebuild."
          : "No mirrored profile is currently marked stale.",
      progress: Math.min(100, summary.staleCount * 18),
    },
    {
      label: "Missing document memory",
      count: summary.missingDocumentCount,
      note:
        summary.missingDocumentCount > 0
          ? "Some mirrored repositories still lack business or technical memory context."
          : "All mirrored repositories already include document memory.",
      progress: Math.min(100, summary.missingDocumentCount * 16),
    },
    {
      label: "Policy warnings",
      count: summary.warningCount,
      note:
        summary.warningCount > 0
          ? "Architecture or policy warnings should be resolved before support treats these repos as rollout-ready."
          : "No policy warnings are attached to current mirrored profiles.",
      progress: Math.min(100, summary.warningCount * 10),
    },
  ];

  return (
    <div className="admin-stack-block">
      <div className="admin-command-metrics">
        <div className="admin-command-metric"><span>Profiles</span><strong>{summary.total}</strong><p>Mirrored repository profiles currently available for support, rollout, and escalation review.</p></div>
        <div className="admin-command-metric"><span>Documents</span><strong>{summary.documentCount}</strong><p>Total synced project documents visible across the support inventory.</p></div>
        <div className="admin-command-metric"><span>Benchmarks</span><strong>{summary.benchmarkCount}</strong><p>Published benchmark artifacts already attached to mirrored repositories.</p></div>
        <div className="admin-command-metric"><span>Warnings</span><strong>{summary.warningCount}</strong><p>Policy or architecture warnings still attached to the current profile set.</p></div>
        <div className="admin-command-metric"><span>Heart links</span><strong>{summary.relationshipCount}</strong><p>Cross-code and document relationships available for guided support and investigation.</p></div>
      </div>

      <div className="admin-command-grid">
        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Support posture</span>
              <h3>How complete the mirrored profile inventory really is</h3>
              <p>Support and product ops should be able to tell whether each repository has enough memory, benchmark proof, and graph depth to be trustworthy.</p>
            </div>
          </header>
          <div className="admin-risk-list">
            {rows.slice(0, 4).map((profile) => (
              <article key={profile.profile_slug} className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>{profile.repo}</strong>
                  <span>{profile.customer_slug ?? "unknown"} · {profile.syncStatus}</span>
                </div>
                <div className="admin-risk-meta">
                  <b>{profile.readinessScore}%</b>
                  <small>{profile.documentCount} docs · {profile.benchmarkCount} benchmarks</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${profile.readinessScore}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Action queue</span>
              <h3>What support or platform ops should address next</h3>
              <p>Mirrored profile gaps should drive follow-through before they become customer-facing trust problems.</p>
            </div>
          </header>
          <div className="admin-risk-list">
            {actions.map((action) => (
              <article key={action.label} className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>{action.label}</strong>
                  <span>{action.note}</span>
                </div>
                <div className="admin-risk-meta">
                  <b>{action.count}</b>
                  <small>{action.progress}%</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${action.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="admin-data-table-shell">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Customer</th>
              <th>Readiness</th>
              <th>Files</th>
              <th>Symbols</th>
              <th>Docs</th>
              <th>Warnings</th>
              <th>Heart links</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((profile) => (
              <tr key={profile.profile_slug}>
                <td className="admin-table-primary">
                  <strong>{profile.repo}</strong>
                  <small>{profile.overview.summary}</small>
                </td>
                <td>{profile.customer_slug ?? "unknown"}</td>
                <td>
                  <div className="admin-table-stat">
                    <strong>{profile.readinessScore}%</strong>
                    <div className="admin-mini-track" aria-hidden="true">
                      <i className="admin-mini-fill" style={{ width: `${profile.readinessScore}%` }} />
                    </div>
                  </div>
                </td>
                <td>{profile.overview.file_count}</td>
                <td>{profile.overview.symbol_count}</td>
                <td>{profile.documentCount}</td>
                <td>{profile.warningCount}</td>
                <td>{profile.heart?.relationship_count ?? 0}</td>
                <td className="admin-table-link">
                  <Link href={`/customers/${profile.profile_slug}`}>Inspect</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminSupportSummaryClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return (
      <AdminStateBlock
        tone={status === "error" ? "error" : "loading"}
        eyebrow="Support"
        title={status === "error" ? "Support summary unavailable" : "Loading support summary"}
        description={
          status === "error"
            ? error
            : "Admin is aggregating profile warnings and support-critical sync inventory."
        }
      />
    );
  }

  const warningCount = profiles.reduce((total, profile) => total + (profile.overview?.policy_warnings ?? 0), 0);

  return (
    <div className="admin-metric-strip">
      <div className="admin-metric-cell"><span>Profiles</span><strong>{profiles.length}</strong></div>
      <div className="admin-metric-cell"><span>Warnings</span><strong>{warningCount}</strong></div>
      <div className="admin-metric-cell"><span>Sync health</span><strong>{profiles.length > 0 ? "Observed" : "Waiting"}</strong></div>
      <div className="admin-metric-cell"><span>Priority</span><strong>Customer-facing</strong></div>
    </div>
  );
}

export function AdminRevenueSummaryClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return <p className="admin-empty">{status === "error" ? error : "Loading revenue summary..."}</p>;
  }

  return (
    <div className="admin-metric-strip">
      <div className="admin-metric-cell"><span>Mirrored profiles</span><strong>{profiles.length}</strong></div>
      <div className="admin-metric-cell"><span>Commercial stage</span><strong>Design partner</strong></div>
      <div className="admin-metric-cell"><span>Expansion model</span><strong>Usage + value</strong></div>
      <div className="admin-metric-cell"><span>Owner surface</span><strong>Internal</strong></div>
    </div>
  );
}

export function AdminOpsHealthSummaryClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return (
      <AdminStateBlock
        tone={status === "error" ? "error" : "loading"}
        eyebrow="Operations"
        title={status === "error" ? "Ops summary unavailable" : "Loading ops summary"}
        description={
          status === "error"
            ? error
            : "The admin plane is checking mirrored heart-link depth and overall supportability."
        }
      />
    );
  }

  const relationshipCount = profiles.reduce((total, profile) => total + (profile.heart?.relationship_count ?? 0), 0);

  return (
    <div className="admin-metric-strip">
      <div className="admin-metric-cell"><span>Profiles</span><strong>{profiles.length}</strong></div>
      <div className="admin-metric-cell"><span>Heart links</span><strong>{relationshipCount}</strong></div>
      <div className="admin-metric-cell"><span>Environment</span><strong>Local-first</strong></div>
      <div className="admin-metric-cell"><span>Readiness</span><strong>Hosted pilot</strong></div>
    </div>
  );
}

export function AdminOpsHealthCommandCenterClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return (
      <AdminStateBlock
        tone={status === "error" ? "error" : "loading"}
        eyebrow="Operations"
        title={status === "error" ? "Ops command center unavailable" : "Loading ops command center"}
        description={
          status === "error"
            ? error
            : "Admin is assembling platform reliability, memory depth, and support escalation signals."
        }
      />
    );
  }

  const summary = summarizeProfiles(profiles);
  const rows = profiles
    .map((profile) => {
      const syncStatus = String(profile.cache?.status ?? "unknown").toLowerCase();
      const warningCount = Number(profile.overview?.policy_warnings ?? 0);
      const relationshipCount = Number(profile.heart?.relationship_count ?? 0);
      const documentCount = Number(profile.documents?.document_count ?? 0);
      const benchmarkCount = Number(profile.benchmark_report_count ?? 0);
      const healthScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            42 +
              Math.min(20, relationshipCount / 36) +
              Math.min(14, documentCount * 6) +
              Math.min(12, benchmarkCount * 8) -
              Math.min(24, warningCount * 8) -
              (syncStatus === "stale" || syncStatus === "rebuild" ? 28 : 0),
          ),
        ),
      );

      return {
        profile_slug: profile.profile_slug,
        repo: profile.repo,
        customer_slug: profile.customer_slug ?? "unknown",
        syncStatus,
        warningCount,
        relationshipCount,
        documentCount,
        benchmarkCount,
        healthScore,
      };
    })
    .sort((left, right) => left.healthScore - right.healthScore);

  const actions = [
    {
      label: "Stale or rebuilding repos",
      count: summary.staleCount,
      note:
        summary.staleCount > 0
          ? "These repositories need fresh sync or republish before trust and support decisions are made."
          : "No mirrored repository is currently flagged stale.",
      progress: Math.min(100, summary.staleCount * 18),
    },
    {
      label: "Missing benchmark proof",
      count: profiles.filter((profile) => Number(profile.benchmark_report_count ?? 0) === 0).length,
      note:
        "Repositories without benchmark proof are harder to defend during rollout or commercial expansion.",
      progress: Math.min(
        100,
        profiles.filter((profile) => Number(profile.benchmark_report_count ?? 0) === 0).length * 14,
      ),
    },
    {
      label: "Low heart-link depth",
      count: profiles.filter((profile) => Number(profile.heart?.relationship_count ?? 0) < 80).length,
      note:
        "Thin relationship graphs usually mean lower retrieval quality and weaker architecture understanding.",
      progress: Math.min(
        100,
        profiles.filter((profile) => Number(profile.heart?.relationship_count ?? 0) < 80).length * 16,
      ),
    },
  ];

  return (
    <div className="admin-stack-block">
      <div className="admin-command-metrics">
        <div className="admin-command-metric">
          <span>Mirrored repos</span>
          <strong>{summary.total}</strong>
          <p>Repository surfaces the admin plane can actively support today.</p>
        </div>
        <div className="admin-command-metric">
          <span>Stale repos</span>
          <strong>{summary.staleCount}</strong>
          <p>Repos that need refresh before ops or support should trust the published state.</p>
        </div>
        <div className="admin-command-metric">
          <span>Heart links</span>
          <strong>{summary.relationshipCount}</strong>
          <p>Total code-to-doc relationships available across the mirrored inventory.</p>
        </div>
        <div className="admin-command-metric">
          <span>Warnings</span>
          <strong>{summary.warningCount}</strong>
          <p>Policy or architecture signals still blocking cleaner enterprise rollout.</p>
        </div>
        <div className="admin-command-metric">
          <span>Documents</span>
          <strong>{summary.documentCount}</strong>
          <p>Synced business and technical memory supporting the current tenant set.</p>
        </div>
      </div>

      <div className="admin-command-grid">
        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Intervention lanes</span>
              <h3>What platform ops should address next</h3>
              <p>Operational pressure should be obvious before it leaks into support load or customer trust issues.</p>
            </div>
          </header>
          <div className="admin-risk-list">
            {actions.map((action) => (
              <article key={action.label} className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>{action.label}</strong>
                  <span>{action.note}</span>
                </div>
                <div className="admin-risk-meta">
                  <b>{action.count}</b>
                  <small>{action.progress}%</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${action.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Supportability heatmap</span>
              <h3>Which mirrored repositories are currently the weakest</h3>
              <p>The lowest-health repositories deserve intervention first because they combine sync risk, thin graph depth, or warning-heavy output.</p>
            </div>
          </header>
          <div className="admin-risk-list">
            {rows.slice(0, 4).map((row) => (
              <article key={row.profile_slug} className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>{row.repo}</strong>
                  <span>{row.customer_slug} · {row.syncStatus}</span>
                </div>
                <div className="admin-risk-meta">
                  <b>{row.healthScore}%</b>
                  <small>{row.warningCount} warnings · {row.relationshipCount} links</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${row.healthScore}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="admin-data-table-shell">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Customer</th>
              <th>Health</th>
              <th>Sync</th>
              <th>Warnings</th>
              <th>Docs</th>
              <th>Benchmarks</th>
              <th>Heart links</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.profile_slug}>
                <td className="admin-table-primary">
                  <strong>{row.repo}</strong>
                  <small>Ops health view</small>
                </td>
                <td>{row.customer_slug}</td>
                <td>
                  <div className="admin-table-stat">
                    <strong>{row.healthScore}%</strong>
                    <div className="admin-mini-track" aria-hidden="true">
                      <i className="admin-mini-fill" style={{ width: `${row.healthScore}%` }} />
                    </div>
                  </div>
                </td>
                <td>{row.syncStatus}</td>
                <td>{row.warningCount}</td>
                <td>{row.documentCount}</td>
                <td>{row.benchmarkCount}</td>
                <td>{row.relationshipCount}</td>
                <td className="admin-table-link">
                  <Link href={`/customers/${row.profile_slug}`}>Inspect</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summarizeProfiles(profiles) {
  return {
    total: profiles.length,
    documentCount: profiles.reduce(
      (total, profile) => total + Number(profile.documents?.document_count ?? 0),
      0,
    ),
    benchmarkCount: profiles.reduce(
      (total, profile) => total + Number(profile.benchmark_report_count ?? 0),
      0,
    ),
    warningCount: profiles.reduce(
      (total, profile) => total + Number(profile.overview?.policy_warnings ?? 0),
      0,
    ),
    relationshipCount: profiles.reduce(
      (total, profile) => total + Number(profile.heart?.relationship_count ?? 0),
      0,
    ),
    staleCount: profiles.filter((profile) => {
      const status = String(profile.cache?.status ?? "").toLowerCase();
      return status === "stale" || status === "rebuild";
    }).length,
    missingDocumentCount: profiles.filter(
      (profile) => Number(profile.documents?.document_count ?? 0) === 0,
    ).length,
  };
}
