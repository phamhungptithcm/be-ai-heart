"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchPortalJson } from "../src/api-client.js";
import { PortalRepositoryServicesWorkspace } from "./PortalRepositoryServicesWorkspace.jsx";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalRepositoryProfileClient({ slug }) {
  const [graphMode, setGraphMode] = useState("focused");
  const [state, setState] = useState({
    status: "loading",
    payload: null,
    error: "",
    graphError: "",
    refreshingGraph: false,
  });

  useEffect(() => {
    setGraphMode("focused");
  }, [slug]);

  useEffect(() => {
    let active = true;

    setState((current) =>
      current.payload
        ? { ...current, refreshingGraph: true, graphError: "" }
        : { ...current, status: "loading", error: "", graphError: "", refreshingGraph: false },
    );

    async function load() {
      try {
        const payload = await fetchPortalJson(
          `/api/repositories/${slug}?graph_mode=${encodeURIComponent(graphMode)}`,
        );

        if (!payload?.profile?.profile_slug) {
          throw new Error("Repository profile not found.");
        }

        if (active) {
          setState({
            status: "ready",
            payload,
            error: "",
            graphError: "",
            refreshingGraph: false,
          });
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setState((current) =>
          current.payload
            ? {
                ...current,
                graphError: error.message,
                refreshingGraph: false,
              }
            : {
                status: "error",
                payload: null,
                error: error.message,
                graphError: "",
                refreshingGraph: false,
              },
        );
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [slug, graphMode]);

  if (state.status === "loading" && !state.payload) {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Repository"
        title="Loading repository profile"
        description="The portal is assembling the latest project memory, graph snapshot, diagrams, documents, and benchmark evidence."
      />
    );
  }

  if ((state.status === "error" || !state.payload?.profile) && !state.payload) {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Repository"
        title="Repository profile not found"
        description={state.error || "This repository has not been published into the portal yet, or your session is scoped to a different workspace."}
        actions={[
          { href: "/repositories", label: "Back to repositories", primary: true },
          { href: "/sign-in", label: "Review access" },
        ]}
      />
    );
  }

  const payload = state.payload ?? {};
  const profile = payload.profile;
  const repositoryServices = payload.repository_services ?? {};
  const summary = repositoryServices.summary ?? {};
  const benchmarkSummary = summary.benchmark_summary ?? {};

  return (
    <div className="portal-enterprise-stack">
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Repository profile</span>
            <h3>{profile.repo}</h3>
            <p>{profile.overview.summary}</p>
          </div>
          <div className="portal-enterprise-panel-actions">
            <Link href="/repositories" className="portal-button-link">
              All repositories
            </Link>
            <Link
              href={`/benchmarks?workspace=${encodeURIComponent(profile.workspace_slug ?? "")}`}
              className="portal-button-link portal-button-link-primary"
            >
              Run benchmark
            </Link>
          </div>
        </div>
        <div className="portal-kpi-grid">
          <article className="portal-kpi-card"><span>Readiness</span><strong>{summary.readiness_pct ?? 0}%</strong></article>
          <article className="portal-kpi-card"><span>Files</span><strong>{profile.overview.file_count}</strong></article>
          <article className="portal-kpi-card"><span>Symbols</span><strong>{profile.overview.symbol_count}</strong></article>
          <article className="portal-kpi-card"><span>Documents</span><strong>{summary.document_count ?? profile.documents.document_count}</strong></article>
          <article className="portal-kpi-card"><span>Visible graph nodes</span><strong>{payload.code_graph?.view?.node_count ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Mapped graph nodes</span><strong>{payload.code_graph?.view?.total_node_count ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Diagrams</span><strong>{repositoryServices.diagrams?.items?.length ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Heart links</span><strong>{profile.heart.relationship_count}</strong></article>
          <article className="portal-kpi-card"><span>Benchmarks</span><strong>{summary.benchmark_report_count ?? 0}</strong></article>
          <article className="portal-kpi-card"><span>Avg token save</span><strong>{benchmarkSummary.avg_token_savings_pct ?? 0}%</strong></article>
          <article className="portal-kpi-card"><span>Cleanup reduction</span><strong>{benchmarkSummary.avg_review_cleanup_reduction_pct ?? 0}%</strong></article>
          <article className="portal-kpi-card"><span>Cache status</span><strong>{profile.cache?.status ?? "unknown"}</strong></article>
        </div>
      </section>

      <PortalRepositoryServicesWorkspace
        profile={profile}
        repositoryServices={repositoryServices}
        graphMode={graphMode}
        onGraphModeChange={setGraphMode}
        graphRefreshing={state.refreshingGraph}
        graphError={state.graphError}
      />
    </div>
  );
}
