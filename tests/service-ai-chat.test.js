import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import {
  issueWorkspaceSession,
  replaceActorMemberships,
  upsertActor,
  upsertWorkspaceIdentity,
} from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("portal model key storage is encrypted and chat session sends provider-backed response", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const previousSecret = process.env.BE_AI_HEART_PORTAL_SECRET_KEY;
  process.env.BE_AI_HEART_PORTAL_SECRET_KEY = "test-portal-secret";
  t.after(() => {
    if (previousSecret === undefined) {
      delete process.env.BE_AI_HEART_PORTAL_SECRET_KEY;
    } else {
      process.env.BE_AI_HEART_PORTAL_SECRET_KEY = previousSecret;
    }
  });

  const requests = [];
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({
        model: "gpt-test",
        output_text: "Source-backed portal answer.",
        usage: { input_tokens: 8, output_tokens: 5, total_tokens: 13 },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  const headers = {
    "Content-Type": "application/json",
    "x-be-ai-heart-session": "portal-demo-session",
  };

  const keyResponse = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/model-provider-keys", {
    method: "POST",
    headers,
    body: JSON.stringify({ provider_id: "openai", api_key: "sk-test-portal-secret" }),
  }), config);
  const keyPayload = await keyResponse.json();
  assert.equal(keyResponse.status, 201);
  assert.equal(keyPayload.provider_id, "openai");
  assert.doesNotMatch(JSON.stringify(keyPayload), /sk-test-portal-secret/);

  const sessionResponse = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/chat/sessions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      workspace_slug: "demo-workspace",
      repo_slug: "be-ai-heart",
      provider_id: "openai",
      model_id: "gpt-test",
      mode: "code_context",
    }),
  }), config);
  const chatSession = await sessionResponse.json();
  assert.equal(sessionResponse.status, 201);

  const messageResponse = await handleServiceHttpRequest(new Request(`http://127.0.0.1:4010/api/chat/sessions/${chatSession.session_id}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: "Explain auth risks",
      provider_id: "openai",
      model_id: "gpt-test",
      context_sources: ["repo", "docs", "graph"],
    }),
  }), config);
  const messagePayload = await messageResponse.json();

  assert.equal(messageResponse.status, 201);
  assert.equal(messagePayload.assistant_message.content, "Source-backed portal answer.");
  assert.equal(messagePayload.usage.total_tokens, 13);
  assert.equal(requests[0].url, "https://api.openai.com/v1/responses");
  assert.equal(requests[0].options.headers.Authorization, "Bearer sk-test-portal-secret");
  assert.doesNotMatch(JSON.stringify(messagePayload), /sk-test-portal-secret/);
});

test("portal chat streams provider responses with context pack attachment metadata", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const previousSecret = process.env.BE_AI_HEART_PORTAL_SECRET_KEY;
  process.env.BE_AI_HEART_PORTAL_SECRET_KEY = "test-portal-secret";
  t.after(() => {
    if (previousSecret === undefined) {
      delete process.env.BE_AI_HEART_PORTAL_SECRET_KEY;
    } else {
      process.env.BE_AI_HEART_PORTAL_SECRET_KEY = previousSecret;
    }
  });

  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
    fetchImpl: async () =>
      new Response(JSON.stringify({
        model: "gpt-test",
        output_text: "Streaming source-backed answer.",
        usage: { input_tokens: 10, output_tokens: 7, total_tokens: 17 },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });
  const headers = {
    "Content-Type": "application/json",
    "x-be-ai-heart-session": "portal-demo-session",
  };

  await fs.mkdir(path.join(config.serviceStorageRoot, "context-packs", "repositories", "be-ai-heart"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(config.serviceStorageRoot, "context-packs", "repositories", "be-ai-heart", "ctx-be-ai-heart-onboarding.json"),
    `${JSON.stringify(
      {
        schema_version: 1,
        pack_id: "ctx-be-ai-heart-onboarding",
        profile_slug: "be-ai-heart",
        task: "prepare enterprise onboarding slice",
        status: "ready",
        estimated_tokens: 900,
        citations: [{ type: "document", label: "PRD", ref: "docs/02-prd.md" }],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/model-provider-keys", {
    method: "POST",
    headers,
    body: JSON.stringify({ provider_id: "openai", api_key: "sk-test-stream-secret" }),
  }), config);

  const sessionResponse = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/chat/sessions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      workspace_slug: "demo-workspace",
      repo_slug: "be-ai-heart",
      provider_id: "openai",
      model_id: "gpt-test",
      mode: "code_context",
    }),
  }), config);
  const session = await sessionResponse.json();

  const streamResponse = await handleServiceHttpRequest(new Request(`http://127.0.0.1:4010/api/chat/sessions/${session.session_id}/messages/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: "Use the onboarding context pack",
      provider_id: "openai",
      model_id: "gpt-test",
      context_sources: ["repo", "docs", "graph"],
      context_pack_id: "ctx-be-ai-heart-onboarding",
    }),
  }), config);
  const raw = await streamResponse.text();
  const events = parseSseEvents(raw);
  const completed = events.find((event) => event.event === "run_completed");

  assert.equal(streamResponse.status, 200);
  assert.match(streamResponse.headers.get("content-type") ?? "", /text\/event-stream/);
  assert.ok(events.some((event) => event.event === "assistant_delta"));
  assert.ok(completed);
  assert.equal(completed.data.assistant_message.content, "Streaming source-backed answer.");
  assert.equal(completed.data.usage.total_tokens, 17);
  assert.ok(completed.data.context_attachments.some((attachment) => attachment.type === "context_pack"));
  assert.doesNotMatch(raw, /sk-test-stream-secret/);
});

test("portal chat stream stays tenant scoped", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });

  await Promise.all([
    upsertWorkspaceIdentity({
      serviceStorageRoot: config.serviceStorageRoot,
      workspaceSlug: "alpha-workspace",
      customerSlug: "customer-alpha",
      profileSlug: "alpha-workspace",
      repo: "repo-alpha",
      source: "test-seed",
    }),
    upsertWorkspaceIdentity({
      serviceStorageRoot: config.serviceStorageRoot,
      workspaceSlug: "beta-workspace",
      customerSlug: "customer-beta",
      profileSlug: "beta-workspace",
      repo: "repo-beta",
      source: "test-seed",
    }),
    upsertActor({
      serviceStorageRoot: config.serviceStorageRoot,
      actor: {
        actor_slug: "alpha-admin",
        surface: "portal",
        role: "org_admin",
        roles: ["org_admin"],
        access_mode: "memberships",
        customer_slug: "customer-alpha",
      },
    }),
    upsertActor({
      serviceStorageRoot: config.serviceStorageRoot,
      actor: {
        actor_slug: "beta-admin",
        surface: "portal",
        role: "org_admin",
        roles: ["org_admin"],
        access_mode: "memberships",
        customer_slug: "customer-beta",
      },
    }),
  ]);
  await Promise.all([
    replaceActorMemberships({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "alpha-admin",
      memberships: [{ workspace_slug: "alpha-workspace" }],
    }),
    replaceActorMemberships({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "beta-admin",
      memberships: [{ workspace_slug: "beta-workspace" }],
    }),
  ]);
  const [alphaSession, betaSession] = await Promise.all([
    issueWorkspaceSession({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "alpha-admin",
      surface: "portal",
      workspaceSlug: "alpha-workspace",
      customerSlug: "customer-alpha",
      sessionToken: "portal-alpha-session",
    }),
    issueWorkspaceSession({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: "beta-admin",
      surface: "portal",
      workspaceSlug: "beta-workspace",
      customerSlug: "customer-beta",
      sessionToken: "portal-beta-session",
    }),
  ]);

  const betaCreateResponse = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/chat/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-be-ai-heart-session": betaSession.session_token,
    },
    body: JSON.stringify({
      workspace_slug: "beta-workspace",
      repo_slug: "beta-workspace",
      provider_id: "openai",
      model_id: "gpt-test",
      mode: "code_context",
    }),
  }), config);
  const betaChat = await betaCreateResponse.json();

  const crossTenantResponse = await handleServiceHttpRequest(new Request(`http://127.0.0.1:4010/api/chat/sessions/${betaChat.session_id}/messages/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-be-ai-heart-session": alphaSession.session_token,
    },
    body: JSON.stringify({ message: "try beta chat" }),
  }), config);

  assert.equal(betaCreateResponse.status, 201);
  assert.equal(crossTenantResponse.status, 404);
});

test("portal chat tools require confirmation for risky actions", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const serviceStorageRoot = path.join(workspaceRoot, "services", "api", "data");
  await fs.mkdir(path.join(serviceStorageRoot, "documents", "repositories"), { recursive: true });
  await fs.writeFile(path.join(serviceStorageRoot, "documents", "repositories", "be-ai-heart-live.json"), `${JSON.stringify({
    schema_version: 1,
    profile_slug: "be-ai-heart-live",
    documents: [{
      path: "docs/00-executive-summary.md",
      title: "Executive Summary",
      summary: "Executive summary for durable repo memory.",
    }],
  })}\n`, "utf8");
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot,
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
    localDemoAuth: true,
  });
  const response = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/chat/tools", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-be-ai-heart-session": "portal-demo-session",
    },
    body: JSON.stringify({ tool_id: "run_benchmark_scenario" }),
  }), config);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, "needs_confirmation");

  const docsResponse = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/chat/tools", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-be-ai-heart-session": "portal-demo-session",
    },
    body: JSON.stringify({
      tool_id: "search_docs",
      input: { repo_slug: "be-ai-heart-live", query: "executive summary" },
    }),
  }), config);
  const docsPayload = await docsResponse.json();

  assert.equal(docsResponse.status, 200);
  assert.equal(docsPayload.status, "completed");
  assert.ok(docsPayload.artifact_cards.length >= 1);

  const kitResponse = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/chat/tools", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-be-ai-heart-session": "portal-demo-session",
    },
    body: JSON.stringify({
      tool_id: "generate_sales_demo_kit",
      confirmed: true,
      input: { pack_id: "tolling-management", customer_requirements: "demo artifact" },
    }),
  }), config);
  const kitPayload = await kitResponse.json();

  assert.equal(kitResponse.status, 200);
  assert.equal(kitPayload.status, "generated");
  assert.ok(kitPayload.data.generated_files.length >= 1);
  assert.doesNotMatch(JSON.stringify(kitPayload), new RegExp(repoRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const proposedEditResponse = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/chat/tools", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-be-ai-heart-session": "portal-demo-session",
    },
    body: JSON.stringify({
      tool_id: "propose_file_edit",
      input: {
        target_path: "docs/specs/generated/generated-chat-artifact.md",
        content: "# Generated Chat Artifact\n\nSource-backed note.\n",
      },
    }),
  }), config);
  const proposedEditPayload = await proposedEditResponse.json();

  assert.equal(proposedEditResponse.status, 200);
  assert.equal(proposedEditPayload.status, "prepared");
  await assert.rejects(
    fs.access(path.join(workspaceRoot, "docs", "specs", "generated", "generated-chat-artifact.md")),
    { code: "ENOENT" },
  );

  const blockedEditResponse = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/chat/tools", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-be-ai-heart-session": "portal-demo-session",
    },
    body: JSON.stringify({
      tool_id: "apply_scoped_file_edit",
      confirmed: true,
      input: {
        target_path: "package.json",
        content: "{}",
      },
    }),
  }), config);
  const blockedEditPayload = await blockedEditResponse.json();

  assert.equal(blockedEditResponse.status, 403);
  assert.equal(blockedEditPayload.status, "denied");

  const unconfirmedWriteResponse = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/chat/tools", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-be-ai-heart-session": "portal-demo-session",
    },
    body: JSON.stringify({
      tool_id: "apply_scoped_file_edit",
      input: {
        target_path: "docs/specs/generated/generated-chat-artifact.md",
        content: "# Generated Chat Artifact\n\nSource-backed note.\n",
      },
    }),
  }), config);
  const unconfirmedWritePayload = await unconfirmedWriteResponse.json();

  assert.equal(unconfirmedWriteResponse.status, 200);
  assert.equal(unconfirmedWritePayload.status, "needs_confirmation");

  const confirmedWriteResponse = await handleServiceHttpRequest(new Request("http://127.0.0.1:4010/api/chat/tools", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-be-ai-heart-session": "portal-demo-session",
    },
    body: JSON.stringify({
      tool_id: "apply_scoped_file_edit",
      confirmed: true,
      input: {
        target_path: "docs/specs/generated/generated-chat-artifact.md",
        content: "# Generated Chat Artifact\n\nSource-backed note.\n",
      },
    }),
  }), config);
  const confirmedWritePayload = await confirmedWriteResponse.json();
  const generatedArtifact = await fs.readFile(path.join(workspaceRoot, "docs", "specs", "generated", "generated-chat-artifact.md"), "utf8");

  assert.equal(confirmedWriteResponse.status, 200);
  assert.equal(confirmedWritePayload.status, "generated");
  assert.match(generatedArtifact, /Source-backed note/);
});

function parseSseEvents(raw) {
  return String(raw)
    .trim()
    .split(/\n\n+/)
    .filter(Boolean)
    .map((block) => {
      const event = block.match(/^event: (.+)$/m)?.[1] ?? "message";
      const data = block.match(/^data: (.+)$/m)?.[1] ?? "{}";
      return {
        event,
        data: JSON.parse(data),
      };
    });
}
