"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAdminJson } from "../src/api-client.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminDocumentsWorkspaceClient() {
  const [state, setState] = useState({
    status: "loading",
    repositories: [],
    submissions: [],
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchAdminJson("/api/documents", { allowMissing: true });

        if (active) {
          setState({
            status: "ready",
            repositories: payload.repositories ?? [],
            submissions: payload.submissions ?? [],
            error: "",
          });
        }
      } catch (loadError) {
        if (active) {
          setState({
            status: "error",
            repositories: [],
            submissions: [],
            error: loadError.message,
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
        eyebrow="Documents"
        title="Loading document operations"
        description="The admin plane is checking mirrored repository documents and queued customer submissions."
      />
    );
  }

  if (state.status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Documents"
        title="Document operations unavailable"
        description={state.error}
        actions={[{ href: "/support", label: "Open support" }]}
      />
    );
  }

  const summary = summarizeDocumentsWorkspace(state.repositories, state.submissions);

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Document operations</h2>
            <p>Admin needs visibility into what customers uploaded on the web and what has already been mirrored back from repository sync.</p>
          </div>
        </div>
        <div className="admin-stat-grid">
          <div><span>Repositories</span><strong>{summary.repository_count}</strong></div>
          <div><span>Synced Docs</span><strong>{summary.document_count}</strong></div>
          <div><span>Queued Updates</span><strong>{summary.submission_count}</strong></div>
          <div><span>Requirement Docs</span><strong>{summary.requirement_count}</strong></div>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Mirrored repository documents</h2>
            <p>Support and rollout reviews should start from what the customer repository actually published back to the platform.</p>
          </div>
        </div>
        {state.repositories.length === 0 ? (
          <AdminStateBlock
            tone="neutral"
            eyebrow="Mirrored documents"
            title="No repository document artifact available yet"
            description="Support should wait for a successful repo-side publish before investigating document-memory discrepancies."
          />
        ) : (
          <div className="admin-list">
            {state.repositories.map((repository) => (
              <Link key={repository.profile_slug} href={`/customers/${repository.profile_slug}`} className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <strong>{repository.repo}</strong>
                    <p>{repository.totals?.document_count ?? repository.documents.length} synced documents</p>
                  </div>
                  <span>{repository.profile_slug}</span>
                </div>
                <div className="admin-inline-metrics">
                  <span>{formatCategoryCounts(repository.totals?.category_counts)}</span>
                  <span>{repository.documents.slice(0, 3).map((document) => document.title).join(" · ") || "No titles yet."}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Queued customer submissions</h2>
            <p>This queue helps support see what changed on the customer side before the repo owner runs CLI sync.</p>
          </div>
        </div>
        {state.submissions.length === 0 ? (
          <AdminStateBlock
            tone="neutral"
            eyebrow="Queued submissions"
            title="No queued customer submission"
            description="The web submission queue is currently empty across mirrored customer workspaces."
          />
        ) : (
          <div className="admin-list">
            {state.submissions.map((submission) => (
              <article key={submission.submission_id} className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <strong>{submission.title}</strong>
                    <p>{submission.summary}</p>
                  </div>
                  <span>{submission.category}</span>
                </div>
                <div className="admin-inline-metrics">
                  <span>{submission.profile_slug}</span>
                  <span>{formatTimestamp(submission.updated_at)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function summarizeDocumentsWorkspace(repositories, submissions) {
  const documentCount = repositories.reduce(
    (total, repository) => total + Number(repository.totals?.document_count ?? repository.documents?.length ?? 0),
    0,
  );
  const requirementCount = repositories.reduce(
    (total, repository) => total + Number(repository.totals?.category_counts?.requirements ?? 0),
    0,
  );

  return {
    repository_count: repositories.length,
    document_count: documentCount,
    submission_count: submissions.length,
    requirement_count: requirementCount,
  };
}

function formatCategoryCounts(categoryCounts = {}) {
  const entries = Object.entries(categoryCounts);
  if (entries.length === 0) {
    return "No categorized documents yet.";
  }

  return entries
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([category, count]) => `${category}: ${count}`)
    .join(" · ");
}

function formatTimestamp(value) {
  if (!value) {
    return "Unknown update time";
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
