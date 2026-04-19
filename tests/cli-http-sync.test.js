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
  assert.equal(profileRequest.headers["x-be-ai-heart-session"], "remote-session");
  assert.equal(documentsRequest.headers["x-be-ai-heart-session"], "remote-session");
  assert.equal(benchmarkRequest.headers["x-be-ai-heart-session"], "remote-session");
  assert.equal(profileRequest.body.profile.profile_slug, "remote-profile");
  assert.equal(documentsRequest.body.artifact.profile_slug, "remote-profile");
  assert.equal(benchmarkRequest.body.report.profile_slug, "remote-profile");
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
