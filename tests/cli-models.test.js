import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cliPath = path.resolve("packages/cli/bin/heart.js");

test("CLI models providers and list keep JSON clean without keys", async (t) => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-models-"));
  t.after(() => fs.rm(fakeHome, { recursive: true, force: true }));
  const env = { ...process.env, BEHEART_CONFIG_HOME: fakeHome };

  const providers = runCli(["models", "providers", "--json"], { env });
  assert.equal(providers.status, 0);
  const providerPayload = JSON.parse(providers.stdout);
  assert.ok(providerPayload.providers.some((provider) => provider.provider_id === "openai"));

  const list = runCli(["models", "list", "--json"], { env });
  assert.equal(list.status, 0);
  const listPayload = JSON.parse(list.stdout);
  assert.equal(listPayload.providers[0].source, "versioned_fallback");
});

test("CLI models pricing and validate keep JSON clean without live credentials", async (t) => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-model-pricing-"));
  t.after(() => fs.rm(fakeHome, { recursive: true, force: true }));
  const env = { ...process.env, BEHEART_CONFIG_HOME: fakeHome };

  const pricing = runCli(["models", "pricing", "--provider", "openai", "--json"], { env });
  assert.equal(pricing.status, 0);
  const pricingPayload = JSON.parse(pricing.stdout);
  assert.equal(pricingPayload.governance.status, "partial_overlay");
  assert.equal(pricingPayload.providers.openai.models["gpt-5.1"].input_per_1m, 1.25);

  const validate = runCli(["models", "validate", "--json"], { env });
  assert.equal(validate.status, 0);
  const validatePayload = JSON.parse(validate.stdout);
  assert.equal(validatePayload.providers.find((provider) => provider.provider_id === "openai").status, "needs_provider_key");
  assert.equal(validatePayload.providers.find((provider) => provider.provider_id === "ollama").status, "needs_local_runtime");
});

test("CLI model key add/select/remove masks secrets in output", async (t) => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-model-key-"));
  t.after(() => fs.rm(fakeHome, { recursive: true, force: true }));
  const env = { ...process.env, BEHEART_CONFIG_HOME: fakeHome };

  const add = runCli(["models", "add-key", "--provider", "openai", "--api-key", "sk-test-local-secret", "--json"], { env });
  assert.equal(add.status, 0);
  assert.doesNotMatch(add.stdout, /sk-test-local-secret/);
  assert.match(add.stdout, /sk-t\.\.\.cret/);

  const select = runCli(["models", "select", "openai/gpt-test", "--json"], { env });
  assert.equal(select.status, 0);
  assert.equal(JSON.parse(select.stdout).selected.model_id, "gpt-test");

  const credentialPath = path.join(fakeHome, "beheart", "model-credentials.json");
  const stat = await fs.stat(credentialPath);
  assert.equal((stat.mode & 0o777), 0o600);

  const remove = runCli(["models", "remove-key", "--provider", "openai", "--json"], { env });
  assert.equal(remove.status, 0);
  assert.equal(JSON.parse(remove.stdout).key_status, "removed");
});

test("CLI chat exits cleanly without configured model key", async (t) => {
  const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-chat-no-key-"));
  t.after(() => fs.rm(fakeHome, { recursive: true, force: true }));
  const env = { ...process.env, BEHEART_CONFIG_HOME: fakeHome };

  const result = runCli(["chat", "--model", "openai/gpt-test", "hello"], { env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /No API key for OpenAI/);
  assert.equal(result.stdout, "");
});

function runCli(args, options = {}) {
  return spawnSync("node", [cliPath, ...args], {
    encoding: "utf8",
    env: options.env,
  });
}
