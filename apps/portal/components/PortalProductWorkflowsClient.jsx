"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchPortalJson, postPortalEventStream, postPortalJson } from "../src/api-client.js";
import { PortalCodeGraphExplorer } from "./PortalCodeGraphExplorer.jsx";
import { PortalDiagramViewer } from "./PortalDiagramViewer.jsx";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

const TASK_MODES = Object.freeze([
  { value: "planning", label: "Planning" },
  { value: "code_context", label: "Code context" },
  { value: "docs_spec_sync", label: "Docs/spec sync" },
  { value: "benchmark_eval", label: "Benchmark eval" },
  { value: "admin_analysis", label: "Admin analysis" },
]);

const WORKBENCH_EXAMPLES = Object.freeze([
  "scan repo",
  "generate context pack for auth login",
  "show graph for auth module",
  "explain architecture",
  "search docs for billing spec",
  "compare latest benchmark",
  "show policy violations",
]);

export function PortalWorkspacesClient() {
  const state = usePortalResource("/api/workspaces");

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="workspaces" />;
  }

  const workspaces = state.payload.workspaces ?? [];
  if (workspaces.length === 0) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Workspaces"
        title="No workspaces are connected yet"
        description="Install the CLI, run heart init and heart scan, then run heart sync setup to create the first workspace."
        actions={[{ href: "/connect", label: "Open CLI connect", primary: true }]}
      />
    );
  }

  return (
    <div className="portal-enterprise-stack">
      <MetricStrip
        metrics={[
          ["Workspaces", workspaces.length],
          ["Profiles", sum(workspaces, "profile_available")],
          ["Docs synced", sum(workspaces, "document_available")],
          ["Benchmarks", sum(workspaces, "benchmark_report_count")],
        ]}
      />
      <div className="portal-data-table-shell">
        <table className="portal-data-table">
          <thead>
            <tr>
              <th>Workspace</th>
              <th>Sync state</th>
              <th>Artifacts</th>
              <th>Benchmark proof</th>
              <th>Last sync</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((workspace) => (
              <tr key={workspace.workspace_slug}>
                <td className="portal-table-primary">
                  <strong>{workspace.display_name ?? workspace.repo}</strong>
                  <small>{workspace.workspace_slug}</small>
                </td>
                <td>
                  <StatusBadge tone={workspace.profile_available ? "positive" : "neutral"}>
                    {workspace.profile_available ? "Profile synced" : "Waiting for profile"}
                  </StatusBadge>
                </td>
                <td>{artifactSummary(workspace)}</td>
                <td>{workspace.benchmark_report_count ?? 0} report(s)</td>
                <td>{formatTimestamp(workspace.latest_sync_at)}</td>
                <td className="portal-table-link">
                  <Link href={`/repositories/${workspace.profile_slug ?? workspace.workspace_slug}`}>Repo</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PortalRepositorySyncClient({ slug }) {
  const state = usePortalResource(`/api/repositories/${slug}/sync`);

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="repository sync status" />;
  }

  const payload = state.payload;
  return (
    <div className="portal-enterprise-stack">
      <MetricStrip
        metrics={[
          ["Scan", payload.scan_status?.state ?? "missing"],
          ["Graph nodes", payload.graph_health?.node_count ?? 0],
          ["Docs", payload.docs_freshness?.document_count ?? 0],
          ["Context packs", payload.context_pack_history?.length ?? 0],
          ["Benchmarks", payload.benchmark_evidence?.report_count ?? 0],
          ["Policy warnings", payload.policy_warnings?.warning_count ?? 0],
        ]}
      />
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Next action</span>
            <h3>{payload.next_recommended_action?.label ?? "Review repository state"}</h3>
            <p>{payload.scan_status?.local_first_note}</p>
          </div>
          <code>{payload.next_recommended_action?.command}</code>
        </div>
      </section>
      <ArtifactTable artifacts={payload.artifacts ?? []} />
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Sync timeline</span>
            <h3>Latest synced artifacts</h3>
            <p>Only synced artifact events are shown. Missing rows tell the user what still needs a CLI sync.</p>
          </div>
        </div>
        <div className="portal-readiness-list">
          {(payload.timeline ?? []).map((event) => (
            <article key={`${event.artifact_key}:${event.occurred_at}`} className="portal-readiness-row">
              <div className="portal-readiness-copy">
                <strong>{event.label}</strong>
                <span>{formatTimestamp(event.occurred_at)}</span>
              </div>
              <div className="portal-readiness-meta">
                <b>{event.status}</b>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PortalRepositoryContextPacksClient({ slug }) {
  const [state, setState] = useState({ status: "loading", payload: null, error: "" });
  const [task, setTask] = useState("add SSO login audit logging");
  const [budget, setBudget] = useState(1600);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setState((current) => ({ ...current, status: current.payload ? "ready" : "loading", error: "" }));
    try {
      const payload = await fetchPortalJson(`/api/repositories/${slug}/context-packs`);
      setState({ status: "ready", payload, error: "" });
    } catch (error) {
      setState({ status: "error", payload: null, error: error.message });
    }
  }

  useEffect(() => {
    load();
  }, [slug]);

  async function createPack(event) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    try {
      const pack = await postPortalJson(`/api/repositories/${slug}/context-packs`, {
        task,
        token_budget: budget,
      });
      setMessage(`Created ${pack.pack_id}`);
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setCreating(false);
    }
  }

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="context packs" />;
  }

  const packs = state.payload.packs ?? [];
  const preview = state.payload.suggested_preview;
  return (
    <div className="portal-enterprise-stack">
      <section className="portal-command-panel">
        <header className="portal-command-head">
          <div>
            <span>Create pack</span>
            <h4>Task memory</h4>
          </div>
        </header>
        <form className="portal-command-grid" onSubmit={createPack}>
          <label className="portal-field">
            <span>Task</span>
            <input className="portal-input" value={task} onChange={(event) => setTask(event.target.value)} />
          </label>
          <label className="portal-field">
            <span>Token budget</span>
            <input className="portal-input" type="number" min="400" max="32000" value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
          </label>
          <button type="submit" className="portal-button-link portal-button-link-primary" disabled={creating}>
            {creating ? "Creating..." : "Create context pack"}
          </button>
        </form>
        {message ? <p className="portal-form-note">{message}</p> : null}
      </section>

      {preview ? (
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Suggested preview</span>
              <h3>{preview.task}</h3>
              <p>{preview.estimated_tokens} estimated tokens from synced graph/docs metadata.</p>
            </div>
            <code>{preview.cli_command}</code>
          </div>
        </section>
      ) : null}

      {packs.length === 0 ? (
        <PortalStateBlock
          tone="neutral"
          eyebrow="Context packs"
          title="No hosted context packs yet"
          description={state.payload.empty_state}
        />
      ) : (
        <div className="portal-repository-services-grid">
          {packs.map((pack) => (
            <article key={pack.pack_id} className="portal-service-card">
              <div className="portal-service-card-head">
                <div>
                  <span>{pack.status}</span>
                  <strong>{pack.task}</strong>
                  <p>{pack.estimated_tokens} / {pack.token_budget} tokens. Confidence: {pack.confidence_label}.</p>
                </div>
                <i data-state="ready">Ready</i>
              </div>
              <div className="portal-service-card-metrics">
                <div><span>Files</span><strong>{pack.files?.length ?? 0}</strong></div>
                <div><span>Docs</span><strong>{pack.documents?.length ?? 0}</strong></div>
                <div><span>Citations</span><strong>{pack.citations?.length ?? 0}</strong></div>
              </div>
              <code>{pack.cli_command}</code>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function PortalRepositoryGraphClient({ slug }) {
  const state = usePortalResource(`/api/repositories/${slug}/graph/summary`);

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="graph summary" />;
  }

  const payload = state.payload;
  const service = {
    title: "Graph",
    state: payload.state,
    available_modes: payload.available_modes,
    default_mode: payload.mode,
    view: payload.view,
  };
  return (
    <div className="portal-enterprise-stack">
      <PortalCodeGraphExplorer service={service} requestedMode={payload.mode} />
      <MetricStrip
        metrics={[
          ["State", payload.state],
          ["Nodes", payload.node_count],
          ["Edges", payload.edge_count],
          ["Confidence", payload.confidence_label],
        ]}
      />
      <div className="portal-inline-banner portal-inline-banner-compact">
        <strong>{payload.inference_mode}</strong>
        <p>{payload.stale ? "This graph is stale. Rescan locally before using it for high-risk changes." : "This graph reflects the latest synced artifact."}</p>
      </div>
    </div>
  );
}

export function PortalRepositoryDiagramsClient({ slug }) {
  const state = usePortalResource(`/api/repositories/${slug}/diagrams`);

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="diagrams" />;
  }

  return <PortalDiagramViewer diagrams={state.payload.diagrams ?? []} emptyActionHref={`/repositories/${slug}/sync`} />;
}

export function PortalRepositoryDocsClient({ slug }) {
  const state = usePortalResource(`/api/repositories/${slug}`);

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="repository docs/specs" />;
  }

  const service = state.payload.repository_services?.document_memory ?? {};
  const docs = service.items ?? [];
  return (
    <div className="portal-enterprise-stack">
      <MetricStrip
        metrics={[
          ["Documents", service.totals?.document_count ?? 0],
          ["Requirements", service.totals?.requirement_count ?? 0],
          ["Decisions", service.totals?.decision_count ?? 0],
          ["Technical", service.totals?.technical_count ?? 0],
        ]}
      />
      {docs.length === 0 ? (
        <PortalStateBlock
          tone="neutral"
          eyebrow="Docs/spec memory"
          title="No repository docs synced"
          description="Sync PRD, architecture, user stories, decisions, and business requirements so context packs can cite them."
          actions={[{ href: "/documents", label: "Open document workspace", primary: true }]}
        />
      ) : (
        <DocumentTable documents={docs} />
      )}
    </div>
  );
}

export function PortalRepositoryBenchmarkClient({ slug }) {
  const state = usePortalResource(`/api/repositories/${slug}`);

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="benchmark evidence" />;
  }

  const service = state.payload.repository_services?.benchmark_roi ?? {};
  const summary = service.summary ?? {};
  const reports = service.reports ?? [];
  return (
    <div className="portal-enterprise-stack">
      <MetricStrip
        metrics={[
          ["Reports", summary.report_count ?? 0],
          ["Token save", `${summary.avg_token_savings_pct ?? 0}%`],
          ["Measurement", summary.latest_measurement_mode || "unknown"],
          ["Confidence", summary.latest_confidence_label || "low"],
        ]}
      />
      {reports.length === 0 ? (
        <PortalStateBlock
          tone="neutral"
          eyebrow="Benchmark ROI"
          title="No benchmark evidence for this repo"
          description="Run a baseline vs assisted benchmark before making ROI claims."
          actions={[{ href: "/benchmarks", label: "Open benchmarks", primary: true }]}
        />
      ) : (
        <BenchmarkTable reports={reports} />
      )}
    </div>
  );
}

export function PortalRepositoryPoliciesClient({ slug }) {
  const state = usePortalResource(`/api/repositories/${slug}`);

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="policy warnings" />;
  }

  const service = state.payload.repository_services?.policy_rails ?? {};
  const summary = service.summary ?? {};
  return (
    <div className="portal-enterprise-stack">
      <MetricStrip
        metrics={[
          ["Warnings", summary.warning_count ?? 0],
          ["Cache", summary.cache_status ?? "unknown"],
          ["Domains", summary.domain_count ?? 0],
          ["Relationships", summary.relationship_count ?? 0],
        ]}
      />
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Policy warning list</span>
            <h3>{service.state === "warning" ? "Review warnings before rollout" : "No active repo warnings"}</h3>
            <p>{service.note}</p>
          </div>
          <Link href="/policies" className="portal-button-link portal-button-link-primary">
            Workspace policies
          </Link>
        </div>
      </section>
    </div>
  );
}

export function PortalModelsClient() {
  const [state, setState] = useState({ status: "loading", payload: null, error: "" });
  const [message, setMessage] = useState("");
  const [keyForm, setKeyForm] = useState({ provider_id: "openai", api_key: "" });
  const [workingProvider, setWorkingProvider] = useState("");

  async function load() {
    try {
      const payload = await fetchPortalJson("/api/models");
      setState({ status: "ready", payload, error: "" });
    } catch (error) {
      setState({ status: "error", payload: null, error: error.message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveBudget(preset) {
    setMessage("");
    try {
      await postPortalJson("/api/model-settings", {
        presets: {
          [preset.preset_id]: {
            provider_id: preset.provider_id,
            model: preset.model,
            token_budget: preset.token_budget,
          },
        },
      });
      setMessage("Model preset settings saved without exposing provider secrets.");
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveProviderKey(event) {
    event.preventDefault();
    setMessage("");
    setWorkingProvider(keyForm.provider_id);
    try {
      await postPortalJson("/api/model-provider-keys", {
        provider_id: keyForm.provider_id,
        api_key: keyForm.api_key,
      });
      setKeyForm({ ...keyForm, api_key: "" });
      setMessage("Provider key saved encrypted on the API server.");
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingProvider("");
    }
  }

  async function testKey(providerId) {
    setMessage("");
    setWorkingProvider(providerId);
    try {
      const result = await postPortalJson(`/api/model-provider-keys/${providerId}/test`, {});
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingProvider("");
    }
  }

  async function deleteKey(providerId) {
    setMessage("");
    setWorkingProvider(providerId);
    try {
      await fetchPortalJson(`/api/model-provider-keys/${providerId}`, { method: "DELETE" });
      setMessage("Provider key deleted.");
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorkingProvider("");
    }
  }

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="models" />;
  }

  const providers = state.payload.providers ?? [];
  const presets = state.payload.presets ?? [];
  const configuredProviders = providers.filter((provider) => provider.configured).length;
  return (
    <div className="portal-enterprise-stack portal-model-workspace">
      <section className="portal-model-hero">
        <div>
          <span>Model routing</span>
          <h3>{configuredProviders}/{providers.length} providers ready</h3>
          <p>Keys stay masked. Presets choose the model used by portal AI actions.</p>
        </div>
        <div className="portal-model-provider-strip" aria-label="Provider status">
          {providers.map((provider) => (
            <span key={provider.provider_id} data-state={provider.configured ? "ready" : "missing"}>
              {provider.label}
            </span>
          ))}
        </div>
      </section>

      <section className="portal-enterprise-panel portal-model-presets">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Presets</span>
            <h3>Task defaults</h3>
          </div>
        </div>
        <div className="portal-model-preset-grid">
          {presets.map((preset) => (
            <article key={preset.preset_id} className="portal-model-preset-card" data-disabled={Boolean(preset.disabled)}>
              <span>{preset.label}</span>
              <strong>{preset.model}</strong>
              <small>{preset.provider_id} / {preset.token_budget} tokens</small>
              {preset.disabled ? <p>{preset.disabled_reason}</p> : null}
              <button type="button" className="portal-button-link" onClick={() => saveBudget(preset)}>
                Save
              </button>
            </article>
          ))}
        </div>
        {message ? <p className="portal-form-note">{message}</p> : null}
      </section>

      <details className="portal-enterprise-panel portal-model-keys">
        <summary>
          <span>Provider keys</span>
          <strong>Manage encrypted keys</strong>
        </summary>
        <ProviderKeySettings
          providers={providers}
          keyForm={keyForm}
          setKeyForm={setKeyForm}
          saveProviderKey={saveProviderKey}
          testKey={testKey}
          deleteKey={deleteKey}
          workingProvider={workingProvider}
          security={state.payload.security}
        />
      </details>
    </div>
  );
}

export function PortalWorkbenchClient() {
  return <ChatWorkbench />;
}

function ChatWorkbench() {
  const workspaces = usePortalResource("/api/workspaces");
  const repos = usePortalResource("/api/repositories");
  const models = usePortalResource("/api/models");
  const domainPacks = usePortalResource("/api/domain-packs");
  const tools = usePortalResource("/api/chat/tools");
  const history = usePortalResource("/api/chat/sessions");
  const [form, setForm] = useState({
    workspace_slug: "",
    repo_slug: "",
    input: "Show graph-backed implementation risks for auth module",
    mode: "code_context",
    preset: "code_context",
    budget: "standard",
    provider_id: "openai",
    model_id: "",
    domain_pack_id: "tolling-management",
    context_pack_id: "",
  });
  const contextPacks = usePortalResource(
    form.repo_slug ? `/api/repositories/${form.repo_slug}/context-packs` : "",
  );
  const [contextSources, setContextSources] = useState(["repo", "docs", "graph"]);
  const [session, setSession] = useState(null);
  const [streamingAssistant, setStreamingAssistant] = useState("");
  const [command, setCommand] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [pendingTool, setPendingTool] = useState(null);
  const [toolResult, setToolResult] = useState(null);

  const workspaceOptions = workspaces.payload?.workspaces ?? [];
  const repoOptions = repos.payload?.profiles ?? [];
  const presetOptions = models.payload?.presets ?? [];
  const providerOptions = models.payload?.providers ?? [];
  const packOptions = domainPacks.payload?.packs ?? [];
  const contextPackOptions = contextPacks.payload?.packs ?? [];
  const selectedProvider = providerOptions.find((provider) => provider.provider_id === form.provider_id) ?? providerOptions[0];
  const modelOptions = selectedProvider?.models ?? [];

  useEffect(() => {
    setForm((current) => {
      const provider = providerOptions.find((entry) => entry.provider_id === current.provider_id) ?? providerOptions[0];
      const contextPackStillAvailable = contextPackOptions.some((pack) => pack.pack_id === current.context_pack_id);
      return {
        ...current,
        workspace_slug: current.workspace_slug || workspaceOptions[0]?.workspace_slug || "",
        repo_slug: current.repo_slug || repoOptions[0]?.profile_slug || "",
        preset: current.preset || presetOptions[0]?.preset_id || "planning",
        provider_id: current.provider_id || presetOptions[0]?.provider_id || provider?.provider_id || "openai",
        model_id: current.model_id || presetOptions[0]?.model || provider?.default_model || provider?.models?.[0] || "",
        domain_pack_id: current.domain_pack_id || packOptions[0]?.pack_id || "tolling-management",
        context_pack_id: contextPackStillAvailable ? current.context_pack_id : contextPackOptions[0]?.pack_id || "",
      };
    });
  }, [workspaceOptions.length, repoOptions.length, presetOptions.length, providerOptions.length, packOptions.length, contextPackOptions.length]);

  async function submitCommand(event) {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    setStreamingAssistant("");
    try {
      let activeSession = session;
      if (!activeSession) {
        activeSession = await postPortalJson("/api/chat/sessions", {
          workspace_slug: form.workspace_slug,
          repo_slug: form.repo_slug,
          provider_id: form.provider_id,
          model_id: form.model_id,
          mode: form.mode,
          preset_id: form.preset,
        });
        setSession(activeSession);
      }
      await postPortalEventStream(`/api/chat/sessions/${activeSession.session_id}/messages/stream`, {
        message: form.input,
        provider_id: form.provider_id,
        model_id: form.model_id,
        mode: form.mode,
        context_sources: contextSources,
        context_pack_id: form.context_pack_id,
        domain_pack_id: form.domain_pack_id,
        context_budget: {
          preset: form.budget,
          max_input_tokens: form.budget === "deep" ? 16000 : 8000,
          max_output_tokens: 2000,
        },
      }, (event) => {
        if (event.event === "assistant_delta") {
          setStreamingAssistant((current) => `${current}${event.data.delta ?? ""}`);
        }
        if (event.event === "run_completed") {
          setSession(event.data.session);
          setStreamingAssistant("");
        }
        if (event.event === "run_failed") {
          throw new Error(event.data.error?.message ?? "Chat stream failed.");
        }
      });
      setCommand(null);
      setForm((current) => ({ ...current, input: "" }));
      setStatus("ready");
    } catch (submitError) {
      setError(submitError.message);
      setStatus("error");
    }
  }

  async function executeTool(tool, confirmed = false) {
    setStatus("tool-running");
    setError("");
    try {
      const result = await postPortalJson("/api/chat/tools", {
        tool_id: tool.tool_id,
        confirmed,
        input: {
          repo_slug: form.repo_slug,
          profile_slug: form.repo_slug,
          domain_pack_id: form.domain_pack_id,
          pack_id: form.domain_pack_id,
          query: form.input,
          task: form.input,
          output_type: tool.tool_id === "generate_sales_demo_kit" ? "sales-demo-kit" : "domain-pack",
        },
      });
      if (result.status === "needs_confirmation") {
        setPendingTool({ ...tool, result });
      } else {
        setToolResult(result);
        setPendingTool(null);
      }
      setStatus("ready");
    } catch (toolError) {
      setError(toolError.message);
      setStatus("error");
    }
  }

  if ([workspaces.status, repos.status, models.status, domainPacks.status, tools.status, history.status].includes("loading")) {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="AI workbench"
        title="Loading chat context"
        description="The portal is loading workspace, repository, model, tool, and chat history contracts."
      />
    );
  }

  const activeContextPack = contextPackOptions.find((pack) => pack.pack_id === form.context_pack_id);
  const activeDomainPack = packOptions.find((pack) => pack.pack_id === form.domain_pack_id);

  return (
    <div className="portal-ai-shell">
      <aside className="portal-ai-sidebar" aria-label="Workbench sessions and controls">
        <AgentStatusRail
          status={status}
          provider={selectedProvider}
          modelId={form.model_id}
          session={session}
          budget={form.budget}
          contextSources={contextSources}
        />
        <ControlDeck
          form={form}
          setForm={setForm}
          repoOptions={repoOptions}
          providerOptions={providerOptions}
          modelOptions={modelOptions}
          contextPackOptions={contextPackOptions}
          packOptions={packOptions}
        />
        <ChatHistorySidebar sessions={history.payload?.sessions ?? []} activeSessionId={session?.session_id} />
      </aside>

      <main className="portal-ai-console" aria-label="BeHeart AI chat">
        <section className="portal-ai-terminal">
          <div className="portal-ai-terminal-bar">
            <div>
              <span>beheart agent</span>
              <strong>{form.repo_slug || "repo"}:{form.mode}</strong>
            </div>
            <CostEstimateBadge session={session} budget={form.budget} />
          </div>
          <ChatMessageList session={session} streamingAssistant={streamingAssistant} />
        </section>

        <form className="portal-ai-composer" onSubmit={submitCommand}>
          <div className="portal-ai-prompt-row">
            <span>heart</span>
            <textarea
              className="portal-ai-prompt"
              rows={3}
              value={form.input}
              onChange={(event) => setForm({ ...form, input: event.target.value })}
              aria-label="Message BeHeart"
            />
          </div>
          <div className="portal-ai-composer-actions">
            <ContextSourcePicker selected={contextSources} onChange={setContextSources} />
            <button type="submit" className="portal-button-link portal-button-link-primary" disabled={status === "submitting" || !form.input.trim()}>
              {status === "submitting" ? "Streaming..." : "Send"}
            </button>
          </div>
          <div className="portal-ai-slash-row" aria-label="Command examples">
            {WORKBENCH_EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => setForm({ ...form, input: example })}>
                / {example}
              </button>
            ))}
          </div>
          {error ? <p className="portal-form-note">{error}</p> : null}
        </form>
      </main>

      <aside className="portal-ai-context" aria-label="Context and actions">
        <ContextStack
          repoSlug={form.repo_slug}
          mode={form.mode}
          contextSources={contextSources}
          contextPack={activeContextPack}
          domainPack={activeDomainPack}
          budget={form.budget}
        />
        <ToolPermissionPanel
          tools={tools.payload?.tools ?? []}
          onPick={(tool) => {
            if (tool.requires_confirmation) {
              setPendingTool(tool);
            } else {
              executeTool(tool, false);
            }
          }}
        />
        {toolResult ? <ToolCallCard result={toolResult} /> : null}
        <CitationPanel session={session} />
        <NextActionButtons
          repoSlug={form.repo_slug}
          onCommand={async (input) => {
            const payload = await postPortalJson("/api/chat/commands", {
              workspace_slug: form.workspace_slug,
              repo_slug: form.repo_slug,
              input,
              mode: form.mode,
              model_preset_id: form.preset,
              selected_pack_id: form.domain_pack_id,
            });
            setCommand(payload);
          }}
        />
        {pendingTool ? (
          <SafetyConfirmationDialog
            tool={pendingTool}
            onConfirm={() => executeTool(pendingTool, true)}
            onClose={() => setPendingTool(null)}
          />
        ) : null}
        {command ? <CommandResult command={command} /> : null}
      </aside>
    </div>
  );
}

export function PortalConnectClient() {
  const state = usePortalResource("/api/workspaces");

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="CLI connect state" />;
  }

  const workspaces = state.payload.workspaces ?? [];
  return (
    <div className="portal-enterprise-stack">
      <MetricStrip
        metrics={[
          ["Workspaces", workspaces.length],
          ["Profile synced", sum(workspaces, "profile_available")],
          ["Docs synced", sum(workspaces, "document_available")],
          ["Benchmarks", sum(workspaces, "benchmark_report_count")],
        ]}
      />
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>MCP / CLI Connect</span>
            <h3>Connect in 4 commands</h3>
            <p>CLI scans locally. Portal shows published artifacts.</p>
          </div>
        </div>
        <div className="portal-summary-list">
          <CommandArticle title="Initialize and scan" command={"heart init\nheart scan\nheart overview"} />
          <CommandArticle title="Configure model" command="heart models providers" />
          <CommandArticle title="Login and sync MVP slice" command={"heart login\nheart sync setup --task \"prepare first implementation\""} />
          <CommandArticle title="Run MCP and verify" command={"heart connect doctor\nheart mcp serve"} />
        </div>
      </section>
    </div>
  );
}

export function PortalGlobalContextPacksClient() {
  const repositories = usePortalResource("/api/repositories");
  const profiles = repositories.payload?.profiles ?? [];
  const [selectedSlug, setSelectedSlug] = useState("");
  const selectedProfile =
    profiles.find((profile) => profile.profile_slug === selectedSlug) ??
    pickDefaultProfile(profiles);

  useEffect(() => {
    if (!selectedSlug && selectedProfile?.profile_slug) {
      setSelectedSlug(selectedProfile.profile_slug);
    }
  }, [selectedSlug, selectedProfile?.profile_slug]);

  if (repositories.status !== "ready") {
    return <ResourceState state={repositories} noun="repositories" />;
  }

  if (profiles.length === 0) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Context packs"
        title="No synced repositories yet"
        description="Run heart sync setup from the CLI first."
        actions={[{ href: "/connect", label: "CLI connect", primary: true }]}
      />
    );
  }

  return (
    <div className="portal-enterprise-stack portal-live-workspace">
      <RepositorySwitchBar
        title={selectedProfile?.repo ?? "Context packs"}
        profiles={profiles}
        selectedSlug={selectedProfile?.profile_slug ?? ""}
        onChange={setSelectedSlug}
        actions={[
          { href: selectedProfile?.profile_slug ? `/repositories/${selectedProfile.profile_slug}` : "/repositories", label: "Repo" },
          { href: selectedProfile?.profile_slug ? `/repositories/${selectedProfile.profile_slug}/graph` : "/graph", label: "Graph" },
        ]}
      />
      {selectedProfile?.profile_slug ? (
        <PortalRepositoryContextPacksClient slug={selectedProfile.profile_slug} />
      ) : null}
    </div>
  );
}

export function PortalGlobalGraphClient() {
  const repositories = usePortalResource("/api/repositories");
  const profiles = repositories.payload?.profiles ?? [];
  const [selectedSlug, setSelectedSlug] = useState("");
  const selectedProfile =
    profiles.find((profile) => profile.profile_slug === selectedSlug) ??
    pickDefaultProfile(profiles);
  const graph = usePortalResource(
    selectedProfile?.profile_slug
      ? `/api/repositories/${selectedProfile.profile_slug}/graph/summary`
      : "",
  );

  useEffect(() => {
    if (!selectedSlug && selectedProfile?.profile_slug) {
      setSelectedSlug(selectedProfile.profile_slug);
    }
  }, [selectedSlug, selectedProfile?.profile_slug]);

  if (repositories.status !== "ready") {
    return <ResourceState state={repositories} noun="repositories" />;
  }

  if (profiles.length === 0) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Graph"
        title="No synced repositories yet"
        description="Run heart sync setup from the CLI first."
        actions={[{ href: "/connect", label: "CLI connect", primary: true }]}
      />
    );
  }

  const payload = graph.payload;
  const service = payload
    ? {
        title: "Graph",
        state: payload.state,
        available_modes: payload.available_modes,
        default_mode: payload.mode,
        view: payload.view,
      }
    : null;

  return (
    <div className="portal-enterprise-stack portal-live-workspace">
      <RepositorySwitchBar
        title={selectedProfile?.repo ?? "Repository graph"}
        profiles={profiles}
        selectedSlug={selectedProfile?.profile_slug ?? ""}
        onChange={setSelectedSlug}
        actions={[
          { href: selectedProfile?.profile_slug ? `/repositories/${selectedProfile.profile_slug}` : "/repositories", label: "Repo" },
          { href: selectedProfile?.profile_slug ? `/repositories/${selectedProfile.profile_slug}/diagrams` : "/diagrams", label: "Diagrams" },
        ]}
      />
      {graph.status === "ready" && service ? (
        <>
          <PortalCodeGraphExplorer service={service} requestedMode={payload.mode} />
          <MetricStrip
            metrics={[
              ["Nodes", payload.node_count],
              ["Edges", payload.edge_count],
              ["Confidence", payload.confidence_label],
              ["Mode", payload.view?.is_diagram_derived ? "diagram-derived" : payload.inference_mode],
            ]}
          />
        </>
      ) : (
        <ResourceState state={graph} noun="graph" />
      )}
    </div>
  );
}

export function PortalGlobalDiagramsClient() {
  const repositories = usePortalResource("/api/repositories");
  const profiles = repositories.payload?.profiles ?? [];
  const [selectedSlug, setSelectedSlug] = useState("");
  const selectedProfile =
    profiles.find((profile) => profile.profile_slug === selectedSlug) ??
    pickDefaultProfile(profiles);
  const diagrams = usePortalResource(
    selectedProfile?.profile_slug
      ? `/api/repositories/${selectedProfile.profile_slug}/diagrams`
      : "",
  );

  useEffect(() => {
    if (!selectedSlug && selectedProfile?.profile_slug) {
      setSelectedSlug(selectedProfile.profile_slug);
    }
  }, [selectedSlug, selectedProfile?.profile_slug]);

  if (repositories.status !== "ready") {
    return <ResourceState state={repositories} noun="repositories" />;
  }

  if (profiles.length === 0) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Diagrams"
        title="No synced repositories yet"
        description="Run heart sync setup from the CLI first."
        actions={[{ href: "/connect", label: "CLI connect", primary: true }]}
      />
    );
  }

  return (
    <div className="portal-enterprise-stack portal-live-workspace">
      <RepositorySwitchBar
        title={selectedProfile?.repo ?? "Repository diagrams"}
        profiles={profiles}
        selectedSlug={selectedProfile?.profile_slug ?? ""}
        onChange={setSelectedSlug}
        actions={[
          { href: selectedProfile?.profile_slug ? `/repositories/${selectedProfile.profile_slug}` : "/repositories", label: "Repo" },
          { href: selectedProfile?.profile_slug ? `/repositories/${selectedProfile.profile_slug}/graph` : "/graph", label: "Graph" },
        ]}
      />
      {diagrams.status === "ready" ? (
        <PortalDiagramViewer diagrams={diagrams.payload.diagrams ?? []} emptyActionHref={selectedProfile?.profile_slug ? `/repositories/${selectedProfile.profile_slug}/sync` : "/connect"} />
      ) : (
        <ResourceState state={diagrams} noun="diagrams" />
      )}
    </div>
  );
}

function RepositorySwitchBar({ title, profiles, selectedSlug, onChange, actions = [] }) {
  const selectedProfile = profiles.find((profile) => profile.profile_slug === selectedSlug);
  return (
    <section className="portal-repo-switchbar">
      <div>
        <span>Latest repo</span>
        <h3>{title}</h3>
        <p>{selectedProfile ? profileLabel(selectedProfile) : "Select a synced repository."}</p>
      </div>
      <div className="portal-repo-switchbar-actions">
        <label className="portal-field portal-repo-switch">
          <span>Repository</span>
          <select className="portal-input" value={selectedSlug} onChange={(event) => onChange(event.target.value)}>
            {profiles.map((profile) => (
              <option key={profile.profile_slug} value={profile.profile_slug}>
                {profile.repo ?? profile.profile_slug}
              </option>
            ))}
          </select>
        </label>
        {actions.filter((action) => action.href).map((action) => (
          <Link key={action.label} href={action.href} className="portal-button-link">
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function AgentStatusRail({ status, provider, modelId, session, budget, contextSources }) {
  const providerReady = provider?.configured || provider?.auth_method === "none";
  const runState = status === "idle" ? "ready" : status;
  return (
    <section className="portal-ai-panel portal-ai-status-rail">
      <div className="portal-ai-panel-head">
        <span>status</span>
        <strong>{runState}</strong>
      </div>
      <div className="portal-ai-status-grid">
        <div>
          <span>model</span>
          <strong>{provider?.provider_id ?? "provider"}/{modelId || provider?.default_model || "default"}</strong>
        </div>
        <div>
          <span>key</span>
          <strong data-state={providerReady ? "ready" : "missing"}>{providerReady ? "ready" : "missing"}</strong>
        </div>
        <div>
          <span>context</span>
          <strong>{contextSources.join(" + ")}</strong>
        </div>
        <div>
          <span>budget</span>
          <strong>{budget}</strong>
        </div>
      </div>
      <CostEstimateBadge session={session} budget={budget} />
    </section>
  );
}

function ControlDeck({ form, setForm, repoOptions, providerOptions, modelOptions, contextPackOptions, packOptions }) {
  return (
    <section className="portal-ai-panel portal-ai-control-deck">
      <div className="portal-ai-panel-head">
        <span>controls</span>
        <strong>workspace</strong>
      </div>
      <RepoPicker value={form.repo_slug} onChange={(value) => setForm({ ...form, repo_slug: value })} repos={repoOptions} />
      <TaskModeSelector value={form.mode} onChange={(value) => setForm({ ...form, mode: value })} />
      <ModelSelector
        providers={providerOptions}
        providerId={form.provider_id}
        modelId={form.model_id}
        modelOptions={modelOptions}
        onProviderChange={(value) => {
          const nextProvider = providerOptions.find((provider) => provider.provider_id === value);
          setForm({ ...form, provider_id: value, model_id: nextProvider?.default_model ?? nextProvider?.models?.[0] ?? "" });
        }}
        onModelChange={(value) => setForm({ ...form, model_id: value })}
      />
      <TokenBudgetControl value={form.budget} onChange={(value) => setForm({ ...form, budget: value })} />
      <ContextPackPicker value={form.context_pack_id} onChange={(value) => setForm({ ...form, context_pack_id: value })} packs={contextPackOptions} />
      <DomainPackPicker value={form.domain_pack_id} onChange={(value) => setForm({ ...form, domain_pack_id: value })} packs={packOptions} />
    </section>
  );
}

function ContextStack({ repoSlug, mode, contextSources, contextPack, domainPack, budget }) {
  const rows = [
    ["repo", repoSlug || "not selected"],
    ["mode", TASK_MODES.find((entry) => entry.value === mode)?.label ?? mode],
    ["sources", contextSources.join(", ")],
    ["context pack", contextPack?.task ?? contextPack?.pack_id ?? "latest synced"],
    ["domain pack", domainPack?.name ?? domainPack?.pack_id ?? "none"],
    ["budget", budget],
  ];

  return (
    <section className="portal-ai-panel portal-ai-context-stack">
      <div className="portal-ai-panel-head">
        <span>context</span>
        <strong>attached</strong>
      </div>
      <div className="portal-ai-stack-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProviderKeySettings({ providers, keyForm, setKeyForm, saveProviderKey, testKey, deleteKey, workingProvider, security }) {
  return (
    <div className="portal-provider-keys-panel">
      <div className="portal-enterprise-panel-head">
        <div>
          <span>Provider keys</span>
          <h3>Bring your own model API keys</h3>
          <p>{security?.encrypted_storage_note}</p>
        </div>
      </div>
      <form className="portal-command-grid" onSubmit={saveProviderKey}>
        <SelectField label="Provider" value={keyForm.provider_id} onChange={(value) => setKeyForm({ ...keyForm, provider_id: value })} options={providers.map((provider) => [provider.provider_id, provider.label])} />
        <label className="portal-field">
          <span>API key</span>
          <input className="portal-input" type="password" autoComplete="off" value={keyForm.api_key} onChange={(event) => setKeyForm({ ...keyForm, api_key: event.target.value })} placeholder="Paste key" />
        </label>
        <button type="submit" className="portal-button-link portal-button-link-primary" disabled={!keyForm.api_key || Boolean(workingProvider)}>
          {workingProvider === keyForm.provider_id ? "Saving..." : "Save key"}
        </button>
      </form>
      <div className="portal-readiness-list">
        {providers.map((provider) => (
          <article key={provider.provider_id} className="portal-readiness-row">
            <div className="portal-readiness-copy">
              <strong>{provider.label}</strong>
              <span>{provider.masked_key || provider.disabled_reason}</span>
            </div>
            <div className="portal-readiness-actions">
              <button type="button" className="portal-button-link" onClick={() => testKey(provider.provider_id)} disabled={workingProvider === provider.provider_id || !provider.configured}>Test</button>
              <button type="button" className="portal-button-link" onClick={() => deleteKey(provider.provider_id)} disabled={workingProvider === provider.provider_id || !provider.configured}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ModelSelector({ providers, providerId, modelId, modelOptions, onProviderChange, onModelChange }) {
  return (
    <>
      <SelectField label="Provider" value={providerId} onChange={onProviderChange} options={providers.map((provider) => [provider.provider_id, `${provider.label}${provider.configured ? "" : " (missing key)"}`])} />
      <SelectField label="Model" value={modelId} onChange={onModelChange} options={(modelOptions.length > 0 ? modelOptions : [modelId || "provider-default"]).map((model) => [model, model])} />
    </>
  );
}

function ContextSourcePicker({ selected, onChange }) {
  const options = [["repo", "repo"], ["docs", "docs"], ["graph", "graph"], ["benchmark", "benchmark"]];
  return (
    <fieldset className="portal-ai-context-toggle">
      <legend>context</legend>
      <div>
        {options.map(([value, label]) => (
          <label key={value}>
            <input type="checkbox" checked={selected.includes(value)} onChange={(event) => onChange(event.target.checked ? [...selected, value] : selected.filter((entry) => entry !== value))} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RepoPicker({ value, onChange, repos }) {
  return <SelectField label="Repository" value={value} onChange={onChange} options={repos.map((repo) => [repo.profile_slug, repo.repo ?? repo.profile_slug])} />;
}

function DomainPackPicker({ value, onChange, packs }) {
  return <SelectField label="Domain pack" value={value} onChange={onChange} options={[["", "None"], ...packs.map((pack) => [pack.pack_id, pack.name ?? pack.pack_id])]} />;
}

function ContextPackPicker({ value, onChange, packs }) {
  return (
    <SelectField
      label="Context pack"
      value={value}
      onChange={onChange}
      options={[["", "Latest synced context"], ...packs.map((pack) => [pack.pack_id, pack.task ?? pack.pack_id])]}
    />
  );
}

function TaskModeSelector({ value, onChange }) {
  return <SelectField label="Task mode" value={value} onChange={onChange} options={TASK_MODES.map((mode) => [mode.value, mode.label])} />;
}

function TokenBudgetControl({ value, onChange }) {
  return <SelectField label="Token budget" value={value} onChange={onChange} options={[["compact", "Compact"], ["standard", "Standard"], ["deep", "Deep"]]} />;
}

function CostEstimateBadge({ session, budget }) {
  const latest = [...(session?.messages ?? [])].reverse().find((message) => message.cost || message.usage);
  const usage = latest?.usage;
  const cost = latest?.cost;
  return (
    <StatusBadge tone="neutral">
      {usage?.total_tokens ? `${usage.total_tokens} tokens` : `${budget} budget`}
      {cost?.estimated_total ? ` / ${cost.currency} ${Number(cost.estimated_total).toFixed(5)}` : ""}
    </StatusBadge>
  );
}

function ChatMessageList({ session, streamingAssistant = "" }) {
  if (!session?.messages?.length && !streamingAssistant) {
    return (
      <div className="portal-ai-empty-transcript">
        <span>ready</span>
        <strong>Start from repo memory, docs, graph, packs, or benchmark evidence.</strong>
        <p>Try `/ show graph for auth module` or `/ generate context pack for auth login`.</p>
      </div>
    );
  }
  return (
    <div className="portal-ai-transcript">
      {(session?.messages ?? []).map((message) => <StreamingMessage key={message.message_id} message={message} />)}
      {streamingAssistant ? (
        <StreamingMessage message={{ message_id: "streaming-assistant", role: "assistant", content: streamingAssistant }} streaming />
      ) : null}
    </div>
  );
}

function StreamingMessage({ message, streaming = false }) {
  return (
    <article className="portal-ai-message" data-role={message.role}>
      <div className="portal-ai-message-meta">
        <span>{message.role === "assistant" ? "beheart" : "you"}</span>
        {streaming ? <i>streaming</i> : null}
        {message.usage?.total_tokens ? <i>{message.usage.total_tokens} tokens</i> : null}
      </div>
      <p>{message.content}</p>
      {(message.artifact_cards ?? []).map((card) => <ArtifactCard key={`${message.message_id}:${card.title}`} card={card} />)}
    </article>
  );
}

function ToolPermissionPanel({ tools, onPick }) {
  return (
    <section className="portal-ai-panel portal-ai-tool-panel">
      <div className="portal-ai-panel-head">
        <span>tools</span>
        <strong>allowlist</strong>
      </div>
      <div className="portal-ai-tool-grid">
        {tools.slice(0, 12).map((tool) => (
          <button key={tool.tool_id} type="button" onClick={() => onPick(tool)} data-confirm={Boolean(tool.requires_confirmation)}>
            <span>{tool.requires_confirmation ? "confirm" : "safe"}</span>
            <strong>{tool.label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function ToolCallCard({ result }) {
  return (
    <section className="portal-ai-panel portal-ai-result-card">
      <div className="portal-ai-panel-head">
        <div>
          <span>tool result</span>
          <strong>{result.definition?.label ?? result.tool_id}</strong>
        </div>
        <StatusBadge tone={result.status === "generated" || result.status === "completed" ? "positive" : result.status === "warning" ? "warning" : "neutral"}>{result.status}</StatusBadge>
      </div>
      <p>{result.message}</p>
      <div className="portal-ai-card-list">
        {(result.artifact_cards ?? []).map((card) => (
          <article key={`${card.card_type}:${card.title}`}>
            <span>{card.card_type}</span>
            <strong>{card.title}</strong>
            <p>{card.summary}</p>
          </article>
        ))}
        {(result.citations ?? []).map((citation) => (
          <article key={`${citation.type}:${citation.ref}`}>
            <span>{citation.type}</span>
            <strong>{citation.label}</strong>
            <p>{citation.ref}</p>
          </article>
        ))}
      </div>
      {result.next_actions?.length ? (
        <div className="portal-ai-next-list">
          {result.next_actions.slice(0, 4).map((action) => <span key={action}>{action}</span>)}
        </div>
      ) : null}
    </section>
  );
}

function CitationPanel({ session }) {
  const citations = (session?.messages ?? []).flatMap((message) => message.citations ?? []);
  if (citations.length === 0) return null;
  return (
    <section className="portal-ai-panel portal-ai-citations">
      <div className="portal-ai-panel-head">
        <span>citations</span>
        <strong>{citations.length} sources</strong>
      </div>
      <div className="portal-ai-card-list">
        {citations.map((citation, index) => (
          <article key={`${citation.ref}:${index}`}>
            <span>{citation.type}</span>
            <strong>{citation.label}</strong>
            <p>{citation.ref}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ArtifactCard({ card }) {
  return (
    <div className="portal-ai-artifact-card">
      <span>{card.card_type ?? "artifact"}</span>
      <strong>{card.title}</strong>
      <p>{card.summary}</p>
    </div>
  );
}

function NextActionButtons({ repoSlug, onCommand }) {
  const actions = [["show graph", "show graph for auth module"], ["search docs", "search docs for latest accepted decision"], ["compare benchmark", "compare benchmark"], ["build demo kit", "build tolling sales demo kit"]];
  return (
    <section className="portal-ai-panel portal-ai-next-actions">
      <div className="portal-ai-panel-head">
        <span>next</span>
        <strong>{repoSlug || "repo"}</strong>
      </div>
      <div>
        {actions.map(([label, command]) => (
          <button key={label} type="button" onClick={() => onCommand(command)}>{label}</button>
        ))}
      </div>
    </section>
  );
}

function ChatHistorySidebar({ sessions, activeSessionId }) {
  if (sessions.length === 0) return null;
  return (
    <section className="portal-ai-panel portal-ai-history">
      <div className="portal-ai-panel-head">
        <span>history</span>
        <strong>{sessions.length} sessions</strong>
      </div>
      <div>
        {sessions.slice(0, 8).map((entry) => (
          <article key={entry.session_id} data-active={entry.session_id === activeSessionId}>
            <div>
              <strong>{entry.title}</strong>
              <span>{entry.provider_id}/{entry.model_id} / {entry.message_count} messages</span>
            </div>
            <StatusBadge tone={entry.session_id === activeSessionId ? "positive" : "neutral"}>{entry.status}</StatusBadge>
          </article>
        ))}
      </div>
    </section>
  );
}

function SafetyConfirmationDialog({ tool, onConfirm, onClose }) {
  return (
    <section className="portal-ai-panel portal-ai-confirmation">
      <div className="portal-ai-panel-head">
        <div>
          <span>confirmation</span>
          <strong>{tool.label}</strong>
          <p>{tool.requires_confirmation ? "This action needs confirmation before execution." : tool.description}</p>
        </div>
        <div>
          <button type="button" className="portal-button-link portal-button-link-primary" onClick={onConfirm}>Confirm</button>
          <button type="button" className="portal-button-link" onClick={onClose}>Close</button>
        </div>
      </div>
    </section>
  );
}

function CommandResult({ command }) {
  return (
    <section className="portal-ai-panel portal-ai-result-card">
      <div className="portal-ai-panel-head">
        <div>
          <span>{command.intent}</span>
          <strong>{command.status}</strong>
          <p>{command.safety?.reason}</p>
        </div>
        <StatusBadge tone={command.status === "denied" ? "warning" : command.status === "needs_confirmation" ? "neutral" : "positive"}>{command.safety?.level}</StatusBadge>
      </div>
      <div className="portal-repository-services-grid">
        {(command.result_cards ?? []).map((card) => (
          <article key={`${card.card_type}:${card.title}`} className="portal-service-card">
            <div className="portal-service-card-head">
              <div>
                <span>{card.card_type}</span>
                <strong>{card.title}</strong>
                <p>{card.summary}</p>
              </div>
              <i data-state={card.status === "ready" ? "ready" : "warning"}>{card.status}</i>
            </div>
            {card.href ? <Link className="portal-table-link" href={card.href}>Open result</Link> : null}
          </article>
        ))}
      </div>
      <div className="portal-summary-list">
        {(command.citations ?? []).map((citation) => (
          <article key={`${citation.type}:${citation.ref}`}>
            <span>{citation.type}</span>
            <strong>{citation.label}</strong>
            <p>{citation.ref}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ArtifactTable({ artifacts }) {
  return (
    <section className="portal-enterprise-panel">
      <div className="portal-enterprise-panel-head">
        <div>
          <span>Artifact versions</span>
          <h3>What the portal currently knows</h3>
          <p>These rows are deterministic API contract data, not UI-only mock state.</p>
        </div>
      </div>
      <div className="portal-data-table-shell">
        <table className="portal-data-table">
          <thead>
            <tr>
              <th>Artifact</th>
              <th>Status</th>
              <th>Version</th>
              <th>Synced</th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((artifact) => (
              <tr key={artifact.key}>
                <td className="portal-table-primary"><strong>{artifact.label}</strong><small>{artifact.key}</small></td>
                <td><StatusBadge tone={artifact.status === "synced" ? "positive" : "neutral"}>{artifact.status}</StatusBadge></td>
                <td>{artifact.schema_version ?? "n/a"}</td>
                <td>{formatTimestamp(artifact.synced_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DocumentTable({ documents }) {
  return (
    <div className="portal-data-table-shell">
      <table className="portal-data-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Category</th>
            <th>Freshness</th>
            <th>Summary</th>
            <th>Path</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.path}>
              <td className="portal-table-primary"><strong>{document.title}</strong><small>{document.restricted ? "restricted" : "synced"}</small></td>
              <td>{document.category}</td>
              <td><StatusBadge tone="positive">synced</StatusBadge></td>
              <td>{document.summary || "No summary available."}</td>
              <td>{document.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BenchmarkTable({ reports }) {
  return (
    <div className="portal-data-table-shell">
      <table className="portal-data-table">
        <thead>
          <tr>
            <th>Report</th>
            <th>Scenario</th>
            <th>Evidence</th>
            <th>Token save</th>
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.report_id}>
              <td className="portal-table-primary"><strong>{report.repo}</strong><small>{formatTimestamp(report.generated_at)}</small></td>
              <td>{report.scenario}</td>
              <td>{report.provenance?.summary?.measurement_mode ?? "unknown"}</td>
              <td>{report.metrics?.token_savings_pct ?? 0}%</td>
              <td className="portal-table-link"><Link href={`/benchmarks/${report.report_id}`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="portal-field">
      <span>{label}</span>
      <select className="portal-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function CommandArticle({ title, command }) {
  return (
    <article>
      <span>{title}</span>
      <strong><code>{command}</code></strong>
      <p>Run from a trusted local checkout.</p>
    </article>
  );
}

function MetricStrip({ metrics }) {
  return (
    <div className="portal-kpi-grid">
      {metrics.map(([label, value]) => (
        <article key={label} className="portal-kpi-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function StatusBadge({ tone = "neutral", children }) {
  return <span className="portal-table-badge" data-tone={tone}>{children}</span>;
}

function ResourceState({ state, noun }) {
  return (
    <PortalStateBlock
      tone={state.status === "error" ? "error" : "loading"}
      eyebrow="Portal"
      title={state.status === "error" ? `Could not load ${noun}` : `Loading ${noun}`}
      description={state.status === "error" ? state.error : "The portal is loading tenant-scoped data from the backend API."}
    />
  );
}

function usePortalResource(resourcePath) {
  const [state, setState] = useState({ status: "loading", payload: null, error: "" });

  useEffect(() => {
    let active = true;
    if (!resourcePath) {
      setState({ status: "idle", payload: null, error: "" });
      return () => {
        active = false;
      };
    }
    setState({ status: "loading", payload: null, error: "" });
    fetchPortalJson(resourcePath)
      .then((payload) => {
        if (active) {
          setState({ status: "ready", payload, error: "" });
        }
      })
      .catch((error) => {
        if (active) {
          setState({ status: "error", payload: null, error: error.message });
        }
      });
    return () => {
      active = false;
    };
  }, [resourcePath]);

  return state;
}

function pickDefaultProfile(profiles) {
  return [...profiles].sort((left, right) => {
    const rightDate = Date.parse(right.latest_sync_at ?? right.synced_at ?? right.updated_at ?? "");
    const leftDate = Date.parse(left.latest_sync_at ?? left.synced_at ?? left.updated_at ?? "");
    return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
  })[0];
}

function profileLabel(profile) {
  const parts = [
    profile.workspace_slug,
    profile.latest_sync_at ? `synced ${formatTimestamp(profile.latest_sync_at)}` : "",
  ].filter(Boolean);
  return parts.join(" / ");
}

function artifactSummary(workspace) {
  const items = [
    workspace.profile_available ? "profile" : "",
    workspace.document_available ? "docs" : "",
    workspace.benchmark_report_count > 0 ? "benchmarks" : "",
  ].filter(Boolean);
  return items.length > 0 ? items.join(", ") : "waiting";
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] === true ? 1 : row[key] ?? 0), 0);
}

function formatTimestamp(value) {
  if (!value) {
    return "Waiting";
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
