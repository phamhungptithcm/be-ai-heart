import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { handleServiceHttpRequest, resolveHttpConfig } from "../services/api/src/http.js";
import {
  issueWorkspaceSession,
  replaceActorMemberships,
  upsertActor,
  upsertWorkspaceIdentity,
} from "../services/api/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

async function createPortalSession(t) {
  const repoRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(repoRoot);
  const config = resolveHttpConfig({
    monorepoRoot: workspaceRoot,
    serviceStorageRoot: path.join(workspaceRoot, "services", "api", "data"),
    portalRoot: path.join(workspaceRoot, "apps", "portal"),
    adminRoot: path.join(workspaceRoot, "apps", "admin"),
    apiBaseUrl: "http://127.0.0.1:4010",
  });

  await upsertWorkspaceIdentity({
    serviceStorageRoot: config.serviceStorageRoot,
    workspaceSlug: "alpha-workspace",
    customerSlug: "customer-alpha",
    profileSlug: "alpha-repo",
    repo: "repo-alpha",
    displayName: "Alpha Repo",
    source: "test-seed",
  });
  await upsertActor({
    serviceStorageRoot: config.serviceStorageRoot,
    actor: {
      actor_slug: "domain-pack-owner",
      surface: "portal",
      role: "org_admin",
      roles: ["org_admin"],
      access_mode: "memberships",
      customer_slug: "customer-alpha",
      display_name: "Domain Pack Owner",
    },
  });
  await replaceActorMemberships({
    serviceStorageRoot: config.serviceStorageRoot,
    actorSlug: "domain-pack-owner",
    memberships: [{ workspace_slug: "alpha-workspace" }],
  });
  const session = await issueWorkspaceSession({
    serviceStorageRoot: config.serviceStorageRoot,
    actorSlug: "domain-pack-owner",
    surface: "portal",
    workspaceSlug: "alpha-workspace",
    customerSlug: "customer-alpha",
    sessionToken: "domain-pack-session",
  });

  return {
    config,
    headers: {
      "x-be-ai-heart-session": session.session_token,
    },
  };
}

test("portal domain pack API lists, validates, generates, and reads artifacts", async (t) => {
  const { config, headers } = await createPortalSession(t);

  const listResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/domain-packs", { headers }),
    config,
  );
  assert.equal(listResponse.status, 200);
  const listPayload = await listResponse.json();
  assert.ok(listPayload.packs.some((pack) => pack.pack_id === "tolling-management"));

  const generateResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/domain-packs/tolling-management/generate", {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        output: "sales-demo-kit",
        regional_layer: "texas",
        agency_overlay: "hctra-example",
        customer_requirements: "Use fake demo accounts only.",
      }),
    }),
    config,
  );
  assert.equal(generateResponse.status, 201);
  const generated = await generateResponse.json();
  assert.equal(generated.status, "generated");
  assert.equal(generated.manifest.output_type, "sales-demo-kit");
  assert.ok(generated.manifest.source_citations.length >= 1);

  const artifactsResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/domain-packs/tolling-management/artifacts", { headers }),
    config,
  );
  assert.equal(artifactsResponse.status, 200);
  const artifactsPayload = await artifactsResponse.json();
  assert.equal(artifactsPayload.artifacts.length, 1);

  const artifactResponse = await handleServiceHttpRequest(
    new Request(`http://127.0.0.1:4010/api/domain-packs/tolling-management/artifacts/${generated.artifact_id}`, { headers }),
    config,
  );
  assert.equal(artifactResponse.status, 200);
  const artifact = await artifactResponse.json();
  assert.equal(artifact.manifest.artifact_id, generated.artifact_id);
  assert.ok(artifact.files[0].content.includes("No real PII"));
});

test("portal chat recognizes allowlisted tolling pack commands and blocks shell input", async (t) => {
  const { config, headers } = await createPortalSession(t);

  const packCommandResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/chat/commands", {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspace_slug: "alpha-workspace",
        repo_slug: "alpha-repo",
        input: "Build a sales demo kit for tolling",
        output: "sales-demo-kit",
        selected_pack_id: "tolling-management",
      }),
    }),
    config,
  );
  assert.equal(packCommandResponse.status, 201);
  const packCommand = await packCommandResponse.json();
  assert.equal(packCommand.intent, "domain_pack_generate");
  assert.equal(packCommand.result_cards[0].card_type, "domain_pack_artifact");
  assert.equal(packCommand.pack_context.selected_pack_id, "tolling-management");
  assert.ok(packCommand.citations.some((citation) => citation.type === "domain_pack_source"));

  const deniedResponse = await handleServiceHttpRequest(
    new Request("http://127.0.0.1:4010/api/chat/commands", {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspace_slug: "alpha-workspace",
        input: "run bash rm -rf . before building tolling",
      }),
    }),
    config,
  );
  assert.equal(deniedResponse.status, 202);
  const denied = await deniedResponse.json();
  assert.equal(denied.status, "denied");
});
