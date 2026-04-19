import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import { issueWorkspaceSession } from "../services/api/src/index.js";
import { withServiceDatabase } from "../services/api/src/database.js";

test("issued workspace sessions use unpredictable random tokens by default", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-session-"));
  const serviceStorageRoot = path.join(tempRoot, "services", "api", "data");

  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const first = await issueWorkspaceSession({
    serviceStorageRoot,
    actorSlug: "demo-customer",
    surface: "portal",
  });
  const second = await issueWorkspaceSession({
    serviceStorageRoot,
    actorSlug: "demo-customer",
    surface: "portal",
  });

  assert.notEqual(first.session_token, second.session_token);
  assert.match(first.session_token, /^[a-f0-9]{32,}$/);
  assert.equal(first.session_token.includes("demo-customer"), false);
});

test("workspace sessions persist only hashed lookup keys and redacted payload tokens", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-session-"));
  const serviceStorageRoot = path.join(tempRoot, "services", "api", "data");

  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const session = await issueWorkspaceSession({
    serviceStorageRoot,
    actorSlug: "demo-customer",
    surface: "portal",
  });
  const expectedLookupKey = createHash("sha256")
    .update(session.session_token, "utf8")
    .digest("hex");
  const row = withServiceDatabase(serviceStorageRoot, (database) =>
    database
      .prepare("SELECT session_token, payload_json FROM sessions WHERE actor_slug = ? LIMIT 1")
      .get("demo-customer"),
  );
  const payload = JSON.parse(row.payload_json);

  assert.equal(row.session_token, expectedLookupKey);
  assert.notEqual(row.session_token, session.session_token);
  assert.equal(payload.session_token, "");
  assert.equal(row.payload_json.includes(session.session_token), false);
});
