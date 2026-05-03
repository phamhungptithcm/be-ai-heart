"use client";

import { useState } from "react";

import { postWebsiteJson } from "../src/api-client.js";

const INITIAL_FORM = Object.freeze({
  full_name: "",
  work_email: "",
  company: "",
  role: "",
  team_size: "6",
  repo_count: "1",
  primary_goal: "",
  message: "",
});

export function LeadCaptureForm({
  intakeKind,
  sourcePage,
  title,
  description,
  submitLabel,
  successTitle,
  successDescription,
}) {
  const [formState, setFormState] = useState(INITIAL_FORM);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    try {
      const payload = await postWebsiteJson("/api/public/intake", {
        intake_kind: intakeKind,
        source_page: sourcePage,
        ...formState,
        team_size: Number(formState.team_size),
        repo_count: Number(formState.repo_count),
      });

      setSubmitted(payload);
      setStatus("success");
      setFormState(INITIAL_FORM);
    } catch (submissionError) {
      setError(submissionError.message);
      setStatus("error");
    }
  }

  if (status === "success" && submitted) {
    return (
      <div className="website-form-success" role="status">
        <span>{intakeKind} request captured</span>
        <strong>{successTitle}</strong>
        <p>{successDescription}</p>
        <div className="website-inline-stat">
          <span>{submitted.company}</span>
          <span>{submitted.role}</span>
          <span>{submitted.request_id}</span>
        </div>
      </div>
    );
  }

  return (
    <form className="website-lead-form" onSubmit={handleSubmit} aria-busy={status === "submitting"}>
      <div className="website-lead-form-head">
        <div>
          <span>{intakeKind === "demo" ? "Demo intake" : "Trial intake"}</span>
          <strong>{title}</strong>
        </div>
        <p>{description}</p>
      </div>

      <div className="website-form-grid">
        <label>
          <span>Full name</span>
          <input
            required
            value={formState.full_name}
            onChange={(event) => updateField(setFormState, "full_name", event.target.value)}
            placeholder="Alex Buyer"
          />
        </label>
        <label>
          <span>Work email</span>
          <input
            required
            type="email"
            value={formState.work_email}
            onChange={(event) => updateField(setFormState, "work_email", event.target.value)}
            placeholder="alex@company.com"
          />
        </label>
        <label>
          <span>Company</span>
          <input
            required
            value={formState.company}
            onChange={(event) => updateField(setFormState, "company", event.target.value)}
            placeholder="Example Labs"
          />
        </label>
        <label>
          <span>Role</span>
          <input
            required
            value={formState.role}
            onChange={(event) => updateField(setFormState, "role", event.target.value)}
            placeholder="Engineering Manager"
          />
        </label>
        <label>
          <span>Team size</span>
          <input
            required
            type="number"
            min="1"
            value={formState.team_size}
            onChange={(event) => updateField(setFormState, "team_size", event.target.value)}
          />
        </label>
        <label>
          <span>Repository count</span>
          <input
            required
            type="number"
            min="1"
            value={formState.repo_count}
            onChange={(event) => updateField(setFormState, "repo_count", event.target.value)}
          />
        </label>
      </div>

      <label className="website-form-field">
        <span>Primary goal</span>
        <input
          required
          value={formState.primary_goal}
          onChange={(event) => updateField(setFormState, "primary_goal", event.target.value)}
          placeholder="Reduce AI token spend without losing architecture safety."
        />
      </label>

      <label className="website-form-field">
        <span>What must the first engagement prove?</span>
        <textarea
          required
          value={formState.message}
          onChange={(event) => updateField(setFormState, "message", event.target.value)}
          placeholder="Describe the repo, the current AI pain, and the benchmark outcome you need."
          rows={5}
        />
      </label>

      <div className="website-form-footer">
        <p>
          This submits directly to the `BeHeart` service host and appears in admin for follow-up,
          revenue tracking, and support qualification.
        </p>
        <button type="submit" disabled={status === "submitting"} data-loading={status === "submitting" ? "true" : "false"}>
          {status === "submitting" ? "Submitting..." : submitLabel}
        </button>
      </div>

      {status === "error" ? (
        <p className="website-form-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function updateField(setFormState, key, value) {
  setFormState((current) => ({
    ...current,
    [key]: value,
  }));
}
