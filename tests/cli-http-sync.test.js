import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { runCli } from "../packages/cli/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("CLI can exchange provider session and sync profile/docs/benchmark over HTTP", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const requests = [];
  const scenarioPath = path.join(workspaceRoot, "remote-scenario.json");
  const previousFetch = global.fetch;

  await fs.writeFile(
    scenarioPath,
    `${JSON.stringify(
      {
        id: "remote-scenario",
        repo: "sample-repo",
        baseline: {
          tokens: 2000,
          minutes: 25,
          duplicates: 3,
          review_edits: 7,
          memory_refreshes: 4,
        },
        assisted: {
          tokens: 1200,
          minutes: 15,
          duplicates: 1,
          review_edits: 2,
          memory_refreshes: 1,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  global.fetch = async (input, init = {}) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input?.url ?? "");
    const body = init.body ? JSON.parse(String(init.body)) : {};
    requests.push({
      url,
      method: init.method ?? "GET",
      headers: init.headers ?? {},
      body,
    });

    if (url.endsWith("/api/session/provider")) {
      return Response.json(
        {
          session: {
            session_token: "remote-session",
          },
        },
        { status: 201 },
      );
    }

    return Response.json(
      {
        ok: true,
        path: url,
        received: body,
      },
      { status: 201 },
    );
  };

  t.after(() => {
    global.fetch = previousFetch;
  });

  const authIo = createIo(fixtureRoot);
  const authExit = await runCli(
    ["auth", "provider-session", "--json", "--url", "https://portal.example.test", "--id-token", "dummy-provider-token"],
    authIo,
  );
  const authResult = JSON.parse(authIo.stdoutText());

  assert.equal(authExit, 0);
  assert.equal(authResult.session.session_token, "remote-session");

  const profileIo = createIo(fixtureRoot);
  const profileExit = await runCli(
    [
      "sync",
      "profile",
      "--json",
      "--url",
      "https://portal.example.test",
      "--session",
      "remote-session",
      "--root",
      fixtureRoot,
      "--slug",
      "remote-profile",
    ],
    profileIo,
  );
  assert.equal(profileExit, 0);

  const docsIo = createIo(fixtureRoot);
  const docsExit = await runCli(
    [
      "sync",
      "docs",
      "--json",
      "--url",
      "https://portal.example.test",
      "--session",
      "remote-session",
      "--root",
      fixtureRoot,
      "--slug",
      "remote-profile",
    ],
    docsIo,
  );
  assert.equal(docsExit, 0);

  const benchmarkIo = createIo(fixtureRoot);
  const benchmarkExit = await runCli(
    [
      "sync",
      "benchmark",
      "--json",
      "--url",
      "https://portal.example.test",
      "--session",
      "remote-session",
      "--root",
      fixtureRoot,
      "--slug",
      "remote-profile",
      scenarioPath,
    ],
    benchmarkIo,
  );
  assert.equal(benchmarkExit, 0);

  const sessionRequest = requests.find((entry) => entry.url.endsWith("/api/session/provider"));
  const profileRequest = requests.find((entry) => entry.url.endsWith("/api/repositories"));
  const documentsRequest = requests.find((entry) => entry.url.endsWith("/api/documents"));
  const benchmarkRequest = requests.find((entry) => entry.url.endsWith("/api/benchmarks"));

  assert.ok(sessionRequest);
  assert.equal(sessionRequest.body.id_token, "dummy-provider-token");
  assert.equal("provider_config" in sessionRequest.body, false);
  assert.equal(profileRequest.headers["x-be-ai-heart-session"], "remote-session");
  assert.equal(documentsRequest.headers["x-be-ai-heart-session"], "remote-session");
  assert.equal(benchmarkRequest.headers["x-be-ai-heart-session"], "remote-session");
  assert.equal(profileRequest.body.profile.profile_slug, "remote-profile");
  assert.equal(profileRequest.body.workspace_metadata.benchmark_runner.source, "remote-profile-sync");
  assert.equal(profileRequest.body.workspace_metadata.benchmark_runner.repo_root, fixtureRoot);
  assert.equal(documentsRequest.body.artifact.profile_slug, "remote-profile");
  assert.equal(benchmarkRequest.body.report.profile_slug, "remote-profile");
  assert.equal(benchmarkRequest.body.report.evidence_bundle.available, true);
  assert.equal(benchmarkRequest.body.report.evidence_bundle.local_manifest_path, undefined);
  assert.equal(benchmarkRequest.body.report.evidence_manifest.bundle_id, benchmarkRequest.body.report.report_id);
  assert.equal(benchmarkRequest.body.report.evidence_manifest.assisted.context_pack.top_citations.length, 0);
});

test("CLI sync setup publishes profile, docs, and a starter context pack in one JSON contract", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const requests = [];
  const previousFetch = global.fetch;

  global.fetch = async (input, init = {}) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input?.url ?? "");
    const body = init.body ? JSON.parse(String(init.body)) : {};
    requests.push({
      url,
      method: init.method ?? "GET",
      headers: init.headers ?? {},
      body,
    });

    if (url.endsWith("/context-packs")) {
      return Response.json(
        {
          schema_version: 1,
          pack_id: "ctx-remote-profile-123",
          profile_slug: "remote-profile",
          task: body.task,
          token_budget: body.token_budget,
          status: "ready",
        },
        { status: 201 },
      );
    }

    return Response.json(
      {
        ok: true,
        received: body,
      },
      { status: 201 },
    );
  };

  t.after(() => {
    global.fetch = previousFetch;
  });

  const io = createIo(fixtureRoot);
  const exitCode = await runCli(
    [
      "sync",
      "setup",
      "--json",
      "--url",
      "https://portal.example.test",
      "--session",
      "remote-session",
      "--root",
      fixtureRoot,
      "--slug",
      "remote-profile",
      "--task",
      "prepare enterprise onboarding slice",
      "--token-budget",
      "2400",
    ],
    io,
  );
  const payload = JSON.parse(io.stdoutText());

  assert.equal(exitCode, 0);
  assert.equal(payload.schema_version, 1);
  assert.equal(payload.status, "synced");
  assert.equal(payload.profile.profile_slug, "remote-profile");
  assert.equal(payload.documents.profile_slug, "remote-profile");
  assert.equal(payload.context_pack.pack_id, "ctx-remote-profile-123");
  assert.match(payload.next_actions.join("\n"), /Open portal workspace/);

  const profileRequest = requests.find((entry) => entry.url.endsWith("/api/repositories"));
  const docsRequest = requests.find((entry) => entry.url.endsWith("/api/documents"));
  const packRequest = requests.find((entry) => entry.url.endsWith("/api/repositories/remote-profile/context-packs"));

  assert.ok(profileRequest);
  assert.ok(docsRequest);
  assert.ok(packRequest);
  assert.equal(packRequest.headers["x-be-ai-heart-session"], "remote-session");
  assert.equal(packRequest.body.task, "prepare enterprise onboarding slice");
  assert.equal(packRequest.body.token_budget, 2400);
});

test("CLI login stores portal API key and sync reuses saved credentials", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const workspaceRoot = path.dirname(fixtureRoot);
  const credentialPath = path.join(workspaceRoot, "beheart-credentials.json");
  const requests = [];
  const previousFetch = global.fetch;
  const apiKey = "test-api-key-123456";

  global.fetch = async (input, init = {}) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input?.url ?? "");
    const body = init.body ? JSON.parse(String(init.body)) : {};
    requests.push({
      url,
      method: init.method ?? "GET",
      headers: init.headers ?? {},
      body,
    });

    if (url.endsWith("/api/session")) {
      return Response.json({
        actor: {
          actor_slug: "alpha-engineer",
        },
        workspace: {
          workspace_slug: "alpha-workspace",
        },
        session: {
          expires_at: "2026-06-01T00:00:00.000Z",
        },
      });
    }

    return Response.json(
      {
        ok: true,
        received: body,
      },
      { status: 201 },
    );
  };

  t.after(() => {
    global.fetch = previousFetch;
  });

  const loginIo = createIo(fixtureRoot);
  const loginExit = await runCli(
    [
      "login",
      "--json",
      `--api-key=${apiKey}`,
      "--credential-path",
      credentialPath,
    ],
    loginIo,
  );
  const loginPayload = JSON.parse(loginIo.stdoutText());
  const credentialRaw = await fs.readFile(credentialPath, "utf8");
  const credentialStat = await fs.stat(credentialPath);

  assert.equal(loginExit, 0);
  assert.equal(loginPayload.status, "authenticated");
  assert.equal(loginPayload.api_url, "https://api.beheart.dev");
  assert.equal(loginPayload.api_key.includes(apiKey), false);
  assert.equal(loginIo.stdoutText().includes(apiKey), false);
  assert.equal(JSON.parse(credentialRaw).api_key, apiKey);
  assert.equal(JSON.parse(credentialRaw).api_url, "https://api.beheart.dev");
  assert.equal(credentialStat.mode & 0o777, 0o600);

  const syncIo = createIo(fixtureRoot);
  const syncExit = await runCli(
    [
      "sync",
      "profile",
      "--json",
      "--credential-path",
      credentialPath,
      "--root",
      fixtureRoot,
      "--slug",
      "alpha-workspace",
    ],
    syncIo,
  );

  assert.equal(syncExit, 0);
  const sessionRequest = requests.find((entry) => entry.url.endsWith("/api/session"));
  const profileRequest = requests.find((entry) => entry.url.endsWith("/api/repositories"));
  assert.equal(sessionRequest.url, "https://api.beheart.dev/api/session");
  assert.equal(sessionRequest.headers["x-be-ai-heart-session"], apiKey);
  assert.equal(profileRequest.headers["x-be-ai-heart-session"], apiKey);
});

test("CLI login without a key returns hosted browser login details in JSON mode", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const previousFetch = global.fetch;
  const requests = [];

  global.fetch = async (input, init = {}) => {
    requests.push({ input, init });
    return Response.json({ ok: true });
  };

  t.after(() => {
    global.fetch = previousFetch;
  });

  const loginIo = createIo(fixtureRoot);
  const loginExit = await runCli(["login", "--json", "--no-open"], loginIo);
  const payload = JSON.parse(loginIo.stdoutText());
  const portalUrl = new URL(payload.portal_url);

  assert.equal(loginExit, 0);
  assert.equal(payload.status, "needs_browser_login");
  assert.equal(payload.api_url, "https://api.beheart.dev");
  assert.equal(portalUrl.origin, "https://portal.beheart.dev");
  assert.equal(portalUrl.searchParams.get("open"), "api-keys");
  assert.equal(portalUrl.searchParams.get("cli_api_url"), "https://api.beheart.dev");
  assert.equal(payload.next_command, "heart login --api-key=<api-key>");
  assert.equal(requests.length, 0);
});

function createIo(cwd) {
  let stdout = "";
  let stderr = "";

  return {
    cwd,
    stdout: {
      write(value) {
        stdout += String(value);
      },
    },
    stderr: {
      write(value) {
        stderr += String(value);
      },
    },
    stdoutText() {
      return stdout;
    },
    stderrText() {
      return stderr;
    },
  };
}
