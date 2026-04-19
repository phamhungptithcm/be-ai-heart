"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { fetchPortalJson, postPortalJson } from "../src/api-client.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

const EMPTY_FORM = Object.freeze({
  profileSlug: "",
  title: "",
  category: "business",
  summary: "",
  body: "",
});

export function PortalDocumentsWorkspaceClient({ defaultProfileSlug = "" }) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [formState, setFormState] = useState(() => ({
    ...EMPTY_FORM,
    profileSlug: defaultProfileSlug,
  }));
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("info");
  const [isPending, startTransition] = useTransition();
  const { status, repositories, submissions, error } = useDocumentsWorkspace(refreshToken);

  useEffect(() => {
    if (!defaultProfileSlug) {
      return;
    }

    setFormState((current) => (
      current.profileSlug ? current : { ...current, profileSlug: defaultProfileSlug }
    ));
  }, [defaultProfileSlug]);

  function handleFieldChange(field, value) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setNotice("");
    setNoticeTone("info");

    startTransition(async () => {
      try {
        const payload = await postPortalJson("/api/documents/submissions", {
          profile_slug: formState.profileSlug,
          title: formState.title,
          category: formState.category,
          summary: formState.summary,
          body: formState.body,
        });

        setNotice(
          `Saved ${payload.title}. Run heart docs sync-web in the repo for ${payload.profile_slug} to import it into project memory.`,
        );
        setNoticeTone("success");
        setFormState({
          ...EMPTY_FORM,
          profileSlug: payload.profile_slug ?? formState.profileSlug,
        });
        setRefreshToken((current) => current + 1);
      } catch (submitError) {
        setNotice(submitError.message);
        setNoticeTone("error");
      }
    });
  }

  if (status === "loading") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Documents"
        title="Loading document workspace"
        description="Checking mirrored repository documents and queued web submissions for this tenant."
      />
    );
  }

  if (status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Documents"
        title="Document workspace unavailable"
        description={error}
        actions={[{ href: "/sign-in", label: "Review session" }, { href: "/repositories", label: "Open repositories" }]}
      />
    );
  }

  const summary = summarizeDocumentsWorkspace(repositories, submissions);

  return (
    <>
      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Document memory control</h2>
            <p>Business documents, requirement specs, and uploaded notes should stay visible here so teams know what the AI heart actually remembers.</p>
          </div>
        </div>
        <div className="portal-stat-grid">
          <div><span>Repositories</span><strong>{summary.repository_count}</strong></div>
          <div><span>Synced Docs</span><strong>{summary.document_count}</strong></div>
          <div><span>Queued Updates</span><strong>{summary.submission_count}</strong></div>
          <div><span>Biz + Req Docs</span><strong>{summary.business_requirement_count}</strong></div>
        </div>
      </section>

      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Sync instructions</h2>
            <p>Web uploads are queued first, then the CLI imports them into the repository and republishes the updated document memory back to the portal.</p>
          </div>
        </div>
        <div className="portal-list">
          <article className="portal-card">
            <strong>1. Upload or revise</strong>
            <p>Use the form below to add a business brief, PRD, or requirement update for a specific repository profile.</p>
          </article>
          <article className="portal-card">
            <strong>2. Sync into the repo</strong>
            <p><code>heart docs sync-web --root /path/to/repo --slug your-profile</code></p>
          </article>
          <article className="portal-card">
            <strong>3. Reuse with confidence</strong>
            <p>The imported doc lands under <code>.heart/imported-documents</code> so future context packs and diagrams see the latest business intent.</p>
          </article>
        </div>
      </section>

      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Upload or update a document</h2>
            <p>Submitting the same profile slug and title again will update the existing web draft instead of creating noise.</p>
          </div>
        </div>
        <form className="portal-form" onSubmit={handleSubmit}>
          <div className="portal-form-grid">
            <label className="portal-field">
              <span>Profile slug</span>
              <input
                className="portal-input"
                value={formState.profileSlug}
                onChange={(event) => handleFieldChange("profileSlug", event.target.value)}
                placeholder="sample-repo"
                required
              />
            </label>
            <label className="portal-field">
              <span>Category</span>
              <select
                className="portal-input"
                value={formState.category}
                onChange={(event) => handleFieldChange("category", event.target.value)}
              >
                <option value="business">Business</option>
                <option value="requirements">Requirements</option>
                <option value="technical">Technical</option>
                <option value="execution">Execution</option>
                <option value="general">General</option>
              </select>
            </label>
          </div>
          <label className="portal-field">
            <span>Title</span>
            <input
              className="portal-input"
              value={formState.title}
              onChange={(event) => handleFieldChange("title", event.target.value)}
              placeholder="Q2 checkout rewrite brief"
              required
            />
          </label>
          <label className="portal-field">
            <span>Summary</span>
            <textarea
              className="portal-textarea portal-textarea-sm"
              value={formState.summary}
              onChange={(event) => handleFieldChange("summary", event.target.value)}
              placeholder="Short summary of the business or requirement change"
            />
          </label>
          <label className="portal-field">
            <span>Document body</span>
            <textarea
              className="portal-textarea"
              value={formState.body}
              onChange={(event) => handleFieldChange("body", event.target.value)}
              placeholder="Paste the updated business document, PRD, or requirement note here."
              required
            />
          </label>
          <div className="portal-form-actions">
            <button type="submit" className="portal-button" disabled={isPending}>
              {isPending ? "Saving..." : "Save web draft"}
            </button>
            {notice ? <p className={`portal-notice portal-notice-${noticeTone}`}>{notice}</p> : null}
          </div>
        </form>
      </section>

      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Synced repository documents</h2>
            <p>These are the documents already published back from the repository after CLI sync.</p>
          </div>
        </div>
        {repositories.length === 0 ? (
          <PortalStateBlock
            tone="neutral"
            eyebrow="Repository documents"
            title="No repository document artifact has been published yet"
            description="Run heart docs import or heart diagram sync from the CLI to publish the repository document memory back to the portal."
            actions={[{ href: "/repositories", label: "Open repositories" }]}
          />
        ) : (
          <div className="portal-list">
            {repositories.map((repository) => (
              <Link key={repository.profile_slug} href={`/repositories/${repository.profile_slug}`} className="portal-card">
                <div className="portal-card-head">
                  <div>
                    <strong>{repository.repo}</strong>
                    <p>{repository.totals?.document_count ?? repository.documents.length} synced documents</p>
                  </div>
                  <span>{repository.profile_slug}</span>
                </div>
                <div className="portal-inline-metrics">
                  <span>{formatCategoryCounts(repository.totals?.category_counts)}</span>
                  <span>{repository.documents.slice(0, 3).map((document) => document.title).join(" · ") || "No titles yet."}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Queued web submissions</h2>
            <p>This queue shows edits entered on the web before they are pulled into the repository by the CLI.</p>
          </div>
        </div>
        {submissions.length === 0 ? (
          <PortalStateBlock
            tone="neutral"
            eyebrow="Queued submissions"
            title="No queued document update"
            description="The web queue is empty. Submit a brief or requirement update above when business intent changes before the next repo sync."
          />
        ) : (
          <div className="portal-list">
            {submissions.map((submission) => (
              <article key={submission.submission_id} className="portal-card">
                <div className="portal-card-head">
                  <div>
                    <strong>{submission.title}</strong>
                    <p>{submission.summary}</p>
                  </div>
                  <span>{submission.category}</span>
                </div>
                <div className="portal-inline-metrics">
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

function useDocumentsWorkspace(refreshToken) {
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
        const payload = await fetchPortalJson("/api/documents", { allowMissing: true });

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
  }, [refreshToken]);

  return state;
}

function summarizeDocumentsWorkspace(repositories, submissions) {
  const documentCount = repositories.reduce(
    (total, repository) => total + Number(repository.totals?.document_count ?? repository.documents?.length ?? 0),
    0,
  );
  const businessRequirementCount = repositories.reduce(
    (total, repository) =>
      total +
      Object.entries(repository.totals?.category_counts ?? {}).reduce((count, [category, value]) => (
        count + (category === "business" || category === "requirements" ? Number(value || 0) : 0)
      ), 0),
    0,
  );

  return {
    repository_count: repositories.length,
    document_count: documentCount,
    submission_count: submissions.length,
    business_requirement_count: businessRequirementCount,
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
