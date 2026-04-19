# Heart Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-first `heart connect` workflow that detects supported agent hosts and model runtimes, installs MCP wiring safely, and verifies the integration with a real stdio MCP handshake.

**Architecture:** Introduce a new `packages/connect` package that owns detection, planning, install, and verification logic. Keep `packages/cli` thin by delegating subcommands to `packages/connect`, and keep `packages/mcp-server` focused on MCP transport rather than client-specific config mutation.

**Tech Stack:** Node.js ESM, built-in `fs/promises`, `child_process`, `readline`, existing `heart` CLI and MCP server, `node --test`

---

### Task 1: Scaffold `packages/connect` And Base Detect Contract

**Files:**
- Create: `packages/connect/package.json`
- Create: `packages/connect/src/index.js`
- Create: `packages/connect/src/detect.js`
- Create: `packages/connect/src/types.js`
- Create: `tests/connect-detect.test.js`

- [ ] **Step 1: Write the failing base contract test**

```js
// tests/connect-detect.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { detectConnections } from "../packages/connect/src/index.js";

test("detectConnections returns a stable empty inventory when nothing is detected", async () => {
  const result = await detectConnections({
    repoRoot: "/tmp/demo-repo",
    env: {
      HOME: "/tmp/demo-home",
      USERPROFILE: "/tmp/demo-home",
    },
    detectAgentsImpl: async () => [],
    detectModelsImpl: async () => [],
  });

  assert.deepEqual(result, {
    repo_root: "/tmp/demo-repo",
    agents: [],
    models: [],
    warnings: [],
    recommendations: [],
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/connect-detect.test.js
```

Expected:

```text
FAIL tests/connect-detect.test.js
ERR_MODULE_NOT_FOUND: Cannot find module '../packages/connect/src/index.js'
```

- [ ] **Step 3: Add the minimal package and detect implementation**

```json
// packages/connect/package.json
{
  "name": "@be-ai-heart/connect",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.js"
}
```

```js
// packages/connect/src/types.js
export function createDetectionResult(repoRoot) {
  return {
    repo_root: repoRoot,
    agents: [],
    models: [],
    warnings: [],
    recommendations: [],
  };
}
```

```js
// packages/connect/src/detect.js
import { createDetectionResult } from "./types.js";

export async function detectConnections({
  repoRoot,
  detectAgentsImpl = async () => [],
  detectModelsImpl = async () => [],
} = {}) {
  const result = createDetectionResult(repoRoot);
  result.agents = await detectAgentsImpl();
  result.models = await detectModelsImpl();
  return result;
}
```

```js
// packages/connect/src/index.js
export { detectConnections } from "./detect.js";
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
node --test tests/connect-detect.test.js
```

Expected:

```text
✔ detectConnections returns a stable empty inventory when nothing is detected
ℹ pass 1
ℹ fail 0
```

- [ ] **Step 5: Commit the scaffold**

```bash
git add packages/connect/package.json packages/connect/src/index.js packages/connect/src/detect.js packages/connect/src/types.js tests/connect-detect.test.js
git commit -m "feat(connect): scaffold detection package"
```

### Task 2: Implement Model Runtime Detection For Ollama And LM Studio

**Files:**
- Modify: `packages/connect/src/detect.js`
- Modify: `packages/connect/src/index.js`
- Modify: `packages/connect/src/types.js`
- Create: `packages/connect/src/model-adapters/ollama.js`
- Create: `packages/connect/src/model-adapters/lm-studio.js`
- Modify: `tests/connect-detect.test.js`

- [ ] **Step 1: Extend the detection test with Ollama and LM Studio cases**

```js
// tests/connect-detect.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { detectConnections } from "../packages/connect/src/index.js";

function jsonResponse(payload, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    },
  };
}

test("detectConnections includes Ollama models and running status", async () => {
  const fetchImpl = async (url) => {
    if (String(url) === "http://127.0.0.1:11434/api/tags") {
      return jsonResponse({
        models: [{ name: "qwen3.5-coder:latest", model: "qwen3.5-coder:latest" }],
      });
    }
    if (String(url) === "http://127.0.0.1:11434/api/ps") {
      return jsonResponse({
        models: [{ name: "qwen3.5-coder:latest", model: "qwen3.5-coder:latest" }],
      });
    }
    throw new Error(`unexpected url: ${url}`);
  };

  const result = await detectConnections({
    repoRoot: "/tmp/demo-repo",
    fetchImpl,
    detectAgentsImpl: async () => [],
  });

  assert.equal(result.models[0].id, "ollama");
  assert.equal(result.models[0].running, true);
  assert.deepEqual(result.models[0].models_detected, ["qwen3.5-coder:latest"]);
});

test("detectConnections includes LM Studio when the OpenAI-compatible endpoint responds", async () => {
  const fetchImpl = async (url) => {
    if (String(url) === "http://127.0.0.1:11434/api/tags") {
      throw new Error("ollama offline");
    }
    if (String(url) === "http://127.0.0.1:1234/v1/models") {
      return jsonResponse({
        data: [{ id: "qwen2.5-coder-7b-instruct" }],
      });
    }
    throw new Error(`unexpected url: ${url}`);
  };

  const result = await detectConnections({
    repoRoot: "/tmp/demo-repo",
    fetchImpl,
    detectAgentsImpl: async () => [],
  });

  assert.equal(result.models[0].id, "lm-studio");
  assert.equal(result.models[0].running, true);
  assert.deepEqual(result.models[0].models_detected, ["qwen2.5-coder-7b-instruct"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/connect-detect.test.js
```

Expected:

```text
FAIL tests/connect-detect.test.js
TypeError: Cannot read properties of undefined (reading 'id')
```

- [ ] **Step 3: Implement the two model adapters and hook them into detection**

```js
// packages/connect/src/model-adapters/ollama.js
const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export async function detectOllama({ fetchImpl }) {
  try {
    const [tagsResponse, runningResponse] = await Promise.all([
      fetchImpl(`${OLLAMA_BASE_URL}/api/tags`),
      fetchImpl(`${OLLAMA_BASE_URL}/api/ps`).catch(() => null),
    ]);

    if (!tagsResponse?.ok) {
      return null;
    }

    const tagsPayload = await tagsResponse.json();
    const runningPayload = runningResponse?.ok ? await runningResponse.json() : { models: [] };

    return {
      id: "ollama",
      display_name: "Ollama",
      transport: "http",
      endpoint: `${OLLAMA_BASE_URL}/api`,
      installed: true,
      running: Array.isArray(runningPayload.models) ? runningPayload.models.length > 0 : true,
      models_detected: (tagsPayload.models ?? []).map((model) => model.name ?? model.model).filter(Boolean),
      auth_required: false,
      discovery_confidence: "high",
      warnings: [],
    };
  } catch {
    return null;
  }
}
```

```js
// packages/connect/src/model-adapters/lm-studio.js
const LM_STUDIO_BASE_URL = "http://127.0.0.1:1234/v1";

export async function detectLmStudio({ fetchImpl }) {
  try {
    const response = await fetchImpl(`${LM_STUDIO_BASE_URL}/models`);
    if (!response?.ok) {
      return null;
    }

    const payload = await response.json();

    return {
      id: "lm-studio",
      display_name: "LM Studio",
      transport: "http",
      endpoint: LM_STUDIO_BASE_URL,
      installed: true,
      running: true,
      models_detected: (payload.data ?? []).map((model) => model.id).filter(Boolean),
      auth_required: false,
      discovery_confidence: "high",
      warnings: [],
    };
  } catch {
    return null;
  }
}
```

```js
// packages/connect/src/detect.js
import { createDetectionResult } from "./types.js";
import { detectOllama } from "./model-adapters/ollama.js";
import { detectLmStudio } from "./model-adapters/lm-studio.js";

async function detectModels({ fetchImpl = globalThis.fetch } = {}) {
  const results = await Promise.all([
    detectOllama({ fetchImpl }),
    detectLmStudio({ fetchImpl }),
  ]);

  return results.filter(Boolean);
}

export async function detectConnections({
  repoRoot,
  fetchImpl = globalThis.fetch,
  detectAgentsImpl = async () => [],
  detectModelsImpl,
} = {}) {
  const result = createDetectionResult(repoRoot);
  result.agents = await detectAgentsImpl();
  result.models = detectModelsImpl ? await detectModelsImpl() : await detectModels({ fetchImpl });
  return result;
}
```

```js
// packages/connect/src/index.js
export { detectConnections } from "./detect.js";
export { detectOllama } from "./model-adapters/ollama.js";
export { detectLmStudio } from "./model-adapters/lm-studio.js";
```

- [ ] **Step 4: Run the model detection tests**

Run:

```bash
node --test tests/connect-detect.test.js
```

Expected:

```text
✔ detectConnections returns a stable empty inventory when nothing is detected
✔ detectConnections includes Ollama models and running status
✔ detectConnections includes LM Studio when the OpenAI-compatible endpoint responds
ℹ fail 0
```

- [ ] **Step 5: Commit the model detection slice**

```bash
git add packages/connect/src/detect.js packages/connect/src/index.js packages/connect/src/types.js packages/connect/src/model-adapters/ollama.js packages/connect/src/model-adapters/lm-studio.js tests/connect-detect.test.js
git commit -m "feat(connect): detect local model runtimes"
```

### Task 3: Implement Agent Host Detection And Install Planning For Cursor, Claude Code, And Continue

**Files:**
- Create: `packages/connect/src/planner.js`
- Create: `packages/connect/src/filesystem.js`
- Create: `packages/connect/src/agent-adapters/cursor.js`
- Create: `packages/connect/src/agent-adapters/claude-code.js`
- Create: `packages/connect/src/agent-adapters/continue.js`
- Modify: `packages/connect/src/detect.js`
- Modify: `packages/connect/src/index.js`
- Create: `tests/helpers/connect-test-context.js`
- Create: `tests/connect-install.test.js`

- [ ] **Step 1: Write failing tests for agent detection and planning**

```js
// tests/helpers/connect-test-context.js
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createConnectTempContext(t) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heart-connect-"));
  const repoRoot = path.join(tempRoot, "repo");
  const homeRoot = path.join(tempRoot, "home");

  await fs.mkdir(repoRoot, { recursive: true });
  await fs.mkdir(homeRoot, { recursive: true });

  if (t?.after) {
    t.after(async () => {
      await fs.rm(tempRoot, { recursive: true, force: true });
    });
  }

  return {
    repoRoot,
    homeRoot,
    env: {
      HOME: homeRoot,
      USERPROFILE: homeRoot,
    },
  };
}
```

```js
// tests/connect-install.test.js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { detectConnections, buildInstallPlan } from "../packages/connect/src/index.js";
import { createConnectTempContext } from "./helpers/connect-test-context.js";

test("detectConnections marks Cursor as configured when .cursor/mcp.json contains heart-mcp", async (t) => {
  const context = await createConnectTempContext(t);
  const cursorConfigPath = path.join(context.repoRoot, ".cursor", "mcp.json");
  await fs.mkdir(path.dirname(cursorConfigPath), { recursive: true });
  await fs.writeFile(
    cursorConfigPath,
    JSON.stringify({
      mcpServers: {
        "heart-mcp": {
          command: "node",
          args: ["/tmp/heart.js", "mcp", "serve", "--root", context.repoRoot],
        },
      },
    }),
  );

  const result = await detectConnections({
    repoRoot: context.repoRoot,
    env: context.env,
    fetchImpl: async () => ({ ok: false, async json() { return {}; } }),
    execFileImpl: async () => ({ stdout: "", stderr: "" }),
  });

  const cursor = result.agents.find((agent) => agent.id === "cursor");
  assert.equal(cursor.configured, true);
  assert.equal(cursor.install_modes.includes("repo"), true);
});

test("buildInstallPlan returns a Continue repo-scope file plan", async (t) => {
  const context = await createConnectTempContext(t);
  const plan = await buildInstallPlan({
    client: "continue",
    scope: "repo",
    repoRoot: context.repoRoot,
    env: context.env,
  });

  assert.equal(plan.client, "continue");
  assert.equal(plan.scope, "repo");
  assert.equal(plan.files_to_modify[0].endsWith(path.join(".continue", "mcpServers", "heart-mcp.json")), true);
});
```

- [ ] **Step 2: Run the planning test to verify it fails**

Run:

```bash
node --test tests/connect-install.test.js
```

Expected:

```text
FAIL tests/connect-install.test.js
SyntaxError: The requested module '../packages/connect/src/index.js' does not provide an export named 'buildInstallPlan'
```

- [ ] **Step 3: Add the adapters, planner, and registry-based agent detection**

```js
// packages/connect/src/filesystem.js
import fs from "node:fs/promises";
import path from "node:path";

export async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureParentDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}
```

```js
// packages/connect/src/agent-adapters/cursor.js
import path from "node:path";

import { fileExists, readJsonFile } from "../filesystem.js";

function resolveCursorLocations({ repoRoot, env }) {
  const home = env.HOME ?? env.USERPROFILE ?? "";
  return [
    { scope: "repo", path: path.join(repoRoot, ".cursor", "mcp.json") },
    ...(home ? [{ scope: "user", path: path.join(home, ".cursor", "mcp.json") }] : []),
  ];
}

export async function detectCursor({ repoRoot, env, execFileImpl }) {
  const locations = resolveCursorLocations({ repoRoot, env });
  let detected = false;
  let configured = false;

  try {
    await execFileImpl("cursor-agent", ["mcp", "list"]);
    detected = true;
  } catch {}

  for (const location of locations) {
    if (!(await fileExists(location.path))) {
      continue;
    }
    detected = true;
    const payload = await readJsonFile(location.path);
    if (payload?.mcpServers?.["heart-mcp"]) {
      configured = true;
      break;
    }
  }

  return {
    id: "cursor",
    display_name: "Cursor",
    supports_mcp: true,
    supports_model_override: false,
    install_modes: ["repo", "user"],
    config_locations: locations.map((location) => location.path),
    detected,
    configured,
    discovery_confidence: detected ? "high" : "low",
    warnings: [],
  };
}

export function buildCursorInstallPlan({ repoRoot, scope, env }) {
  const targetPath =
    scope === "user"
      ? path.join(env.HOME ?? env.USERPROFILE ?? "", ".cursor", "mcp.json")
      : path.join(repoRoot, ".cursor", "mcp.json");

  return {
    client: "cursor",
    scope,
    repo_root: repoRoot,
    mcp_entry: {
      command: "node",
      args: [path.resolve("packages/cli/bin/heart.js"), "mcp", "serve", "--root", repoRoot],
    },
    model_binding: null,
    files_to_backup: [targetPath],
    files_to_modify: [targetPath],
    warnings: [],
    actions: ["write-mcp-json"],
  };
}
```

```js
// packages/connect/src/agent-adapters/claude-code.js
import path from "node:path";

export async function detectClaudeCode({ repoRoot, env, execFileImpl }) {
  try {
    await execFileImpl("claude", ["mcp", "list"]);
    return {
      id: "claude-code",
      display_name: "Claude Code",
      supports_mcp: true,
      supports_model_override: false,
      install_modes: ["repo", "user"],
      config_locations: [path.join(repoRoot, ".mcp.json"), path.join(env.HOME ?? env.USERPROFILE ?? "", ".claude.json")],
      detected: true,
      configured: false,
      discovery_confidence: "high",
      warnings: [],
    };
  } catch {
    return null;
  }
}

export function buildClaudeCodeInstallPlan({ repoRoot, scope, env }) {
  const jsonConfig = JSON.stringify({
    type: "stdio",
    command: path.resolve("packages/cli/bin/heart.js"),
    args: ["mcp", "serve", "--root", repoRoot],
    env: {},
  });

  return {
    client: "claude-code",
    scope,
    repo_root: repoRoot,
    mcp_entry: JSON.parse(jsonConfig),
    model_binding: null,
    files_to_backup: [],
    files_to_modify: [],
    warnings: [],
    actions: [
      {
        type: "run-command",
        command: "claude",
        args: ["mcp", "add-json", "heart-mcp", jsonConfig, "--scope", scope === "user" ? "user" : "project"],
      },
    ],
  };
}
```

```js
// packages/connect/src/agent-adapters/continue.js
import path from "node:path";

export async function detectContinue({ repoRoot, env }) {
  const home = env.HOME ?? env.USERPROFILE ?? "";
  const configLocations = [
    path.join(repoRoot, ".continue", "mcpServers", "heart-mcp.json"),
    path.join(home, ".continue", "config.yaml"),
  ];
  return {
    id: "continue",
    display_name: "Continue",
    supports_mcp: true,
    supports_model_override: true,
    install_modes: ["repo", "user"],
    config_locations: configLocations,
    detected: false,
    configured: false,
    discovery_confidence: "low",
    warnings: ["Continue detection is config-hinted in V1 unless a local config already exists."],
  };
}

export function buildContinueInstallPlan({ repoRoot, scope, env, modelRuntime = null }) {
  const home = env.HOME ?? env.USERPROFILE ?? "";
  const mcpConfigPath =
    scope === "user"
      ? path.join(home, ".continue", "mcpServers", "heart-mcp.json")
      : path.join(repoRoot, ".continue", "mcpServers", "heart-mcp.json");

  return {
    client: "continue",
    scope,
    repo_root: repoRoot,
    mcp_entry: {
      mcpServers: [
        {
          name: "heart-mcp",
          command: path.resolve("packages/cli/bin/heart.js"),
          args: ["mcp", "serve", "--root", repoRoot],
        },
      ],
    },
    model_binding: modelRuntime,
    files_to_backup: [mcpConfigPath],
    files_to_modify: [mcpConfigPath],
    warnings: [],
    actions: ["write-continue-mcp-json"],
  };
}
```

```js
// packages/connect/src/planner.js
import { buildCursorInstallPlan } from "./agent-adapters/cursor.js";
import { buildClaudeCodeInstallPlan } from "./agent-adapters/claude-code.js";
import { buildContinueInstallPlan } from "./agent-adapters/continue.js";

export async function buildInstallPlan({ client, scope, repoRoot, env, modelRuntime = null } = {}) {
  if (client === "cursor") {
    return buildCursorInstallPlan({ repoRoot, scope, env });
  }
  if (client === "claude-code") {
    return buildClaudeCodeInstallPlan({ repoRoot, scope, env });
  }
  if (client === "continue") {
    return buildContinueInstallPlan({ repoRoot, scope, env, modelRuntime });
  }
  throw new Error(`Unsupported client: ${client}`);
}
```

```js
// packages/connect/src/detect.js
import { createDetectionResult } from "./types.js";
import { detectOllama } from "./model-adapters/ollama.js";
import { detectLmStudio } from "./model-adapters/lm-studio.js";
import { detectCursor } from "./agent-adapters/cursor.js";
import { detectClaudeCode } from "./agent-adapters/claude-code.js";
import { detectContinue } from "./agent-adapters/continue.js";

async function detectAgents({ repoRoot, env, execFileImpl }) {
  const results = await Promise.all([
    detectCursor({ repoRoot, env, execFileImpl }),
    detectClaudeCode({ repoRoot, env, execFileImpl }),
    detectContinue({ repoRoot, env }),
  ]);

  return results.filter(Boolean);
}

async function detectModels({ fetchImpl = globalThis.fetch } = {}) {
  const results = await Promise.all([
    detectOllama({ fetchImpl }),
    detectLmStudio({ fetchImpl }),
  ]);

  return results.filter(Boolean);
}

export async function detectConnections({
  repoRoot,
  env = process.env,
  fetchImpl = globalThis.fetch,
  execFileImpl = async () => ({ stdout: "", stderr: "" }),
  detectAgentsImpl,
  detectModelsImpl,
} = {}) {
  const result = createDetectionResult(repoRoot);
  result.agents = detectAgentsImpl
    ? await detectAgentsImpl()
    : await detectAgents({ repoRoot, env, execFileImpl });
  result.models = detectModelsImpl ? await detectModelsImpl() : await detectModels({ fetchImpl });
  return result;
}
```

```js
// packages/connect/src/index.js
export { detectConnections } from "./detect.js";
export { buildInstallPlan } from "./planner.js";
export { detectOllama } from "./model-adapters/ollama.js";
export { detectLmStudio } from "./model-adapters/lm-studio.js";
```

- [ ] **Step 4: Run the agent planning tests**

Run:

```bash
node --test tests/connect-install.test.js tests/connect-detect.test.js
```

Expected:

```text
✔ detectConnections marks Cursor as configured when .cursor/mcp.json contains heart-mcp
✔ buildInstallPlan returns a Continue repo-scope file plan
ℹ fail 0
```

- [ ] **Step 5: Commit the planning layer**

```bash
git add packages/connect/src/planner.js packages/connect/src/filesystem.js packages/connect/src/agent-adapters/cursor.js packages/connect/src/agent-adapters/claude-code.js packages/connect/src/agent-adapters/continue.js packages/connect/src/detect.js packages/connect/src/index.js tests/helpers/connect-test-context.js tests/connect-install.test.js
git commit -m "feat(connect): add agent detection and planning"
```

### Task 4: Implement Install Flows And Safe Continue Model Binding

**Files:**
- Create: `packages/connect/src/install.js`
- Modify: `packages/connect/src/index.js`
- Modify: `packages/connect/src/filesystem.js`
- Modify: `packages/connect/src/agent-adapters/cursor.js`
- Modify: `packages/connect/src/agent-adapters/claude-code.js`
- Modify: `packages/connect/src/agent-adapters/continue.js`
- Modify: `tests/connect-install.test.js`

- [ ] **Step 1: Add failing install tests for Cursor, Claude Code, and Continue**

```js
// tests/connect-install.test.js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { installConnection } from "../packages/connect/src/index.js";
import { createConnectTempContext } from "./helpers/connect-test-context.js";

test("installConnection writes Cursor repo config", async (t) => {
  const context = await createConnectTempContext(t);

  const result = await installConnection({
    client: "cursor",
    scope: "repo",
    repoRoot: context.repoRoot,
    env: context.env,
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  const configPath = path.join(context.repoRoot, ".cursor", "mcp.json");
  const payload = JSON.parse(await fs.readFile(configPath, "utf8"));

  assert.equal(payload.mcpServers["heart-mcp"].args.includes("--root"), true);
  assert.equal(result.status, "ready");
});

test("installConnection shells out to Claude Code CLI", async () => {
  const calls = [];
  await installConnection({
    client: "claude-code",
    scope: "repo",
    repoRoot: "/tmp/repo",
    execFileImpl: async (command, args) => {
      calls.push([command, args]);
      return { stdout: "", stderr: "" };
    },
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  assert.equal(calls[0][0], "claude");
  assert.equal(calls[0][1][0], "mcp");
  assert.equal(calls[0][1][1], "add-json");
});

test("installConnection creates a managed Continue config for Ollama only when the user config is absent", async (t) => {
  const context = await createConnectTempContext(t);

  const result = await installConnection({
    client: "continue",
    scope: "user",
    repoRoot: context.repoRoot,
    env: context.env,
    model: "ollama",
    verifyImpl: async () => ({ status: "ready", warnings: [] }),
  });

  const configPath = path.join(context.homeRoot, ".continue", "config.yaml");
  const configText = await fs.readFile(configPath, "utf8");

  assert.match(configText, /provider: ollama/);
  assert.match(configText, /model: qwen3.5-coder:latest/);
  assert.equal(result.status, "ready");
});
```

- [ ] **Step 2: Run the install tests to verify they fail**

Run:

```bash
node --test tests/connect-install.test.js
```

Expected:

```text
FAIL tests/connect-install.test.js
SyntaxError: The requested module '../packages/connect/src/index.js' does not provide an export named 'installConnection'
```

- [ ] **Step 3: Implement install execution and safe file writers**

```js
// packages/connect/src/filesystem.js
import fs from "node:fs/promises";
import path from "node:path";

export async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureParentDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function writeJsonFile(filePath, payload) {
  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function writeTextFile(filePath, text) {
  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, text, "utf8");
}
```

```js
// packages/connect/src/install.js
import fs from "node:fs/promises";
import path from "node:path";

import { buildInstallPlan } from "./planner.js";
import { fileExists, readJsonFile, writeJsonFile, writeTextFile } from "./filesystem.js";

function createContinueManagedConfig(model) {
  if (model === "lm-studio") {
    return `name: BeHeart Local Config
version: 0.0.1
schema: v1
models:
  - name: BeHeart LM Studio
    provider: lmstudio
    model: qwen2.5-coder-7b-instruct
    apiBase: http://localhost:1234/v1
`;
  }

  return `name: BeHeart Local Config
version: 0.0.1
schema: v1
models:
  - name: BeHeart Ollama
    provider: ollama
    model: qwen3.5-coder:latest
`;
}

export async function installConnection({
  client,
  scope,
  repoRoot,
  env = process.env,
  model = null,
  execFileImpl = async () => ({ stdout: "", stderr: "" }),
  verifyImpl,
} = {}) {
  const plan = await buildInstallPlan({
    client,
    scope,
    repoRoot,
    env,
    modelRuntime: model,
  });

  if (client === "cursor") {
    const targetPath = plan.files_to_modify[0];
    const current = (await fileExists(targetPath)) ? await readJsonFile(targetPath) : { mcpServers: {} };
    current.mcpServers["heart-mcp"] = plan.mcp_entry;
    await writeJsonFile(targetPath, current);
  }

  if (client === "claude-code") {
    const action = plan.actions[0];
    await execFileImpl(action.command, action.args);
  }

  if (client === "continue") {
    await writeJsonFile(plan.files_to_modify[0], plan.mcp_entry);

    if (model) {
      const continueConfigPath = path.join(env.HOME ?? env.USERPROFILE ?? "", ".continue", "config.yaml");
      const canManageConfig =
        !(await fileExists(continueConfigPath)) ||
        (await fs.readFile(continueConfigPath, "utf8").catch(() => "")).startsWith("name: BeHeart Local Config");

      if (canManageConfig) {
        await writeTextFile(continueConfigPath, createContinueManagedConfig(model));
      }
    }
  }

  const verification = verifyImpl ? await verifyImpl(plan) : { status: "ready", warnings: [] };
  return {
    ...verification,
    client,
    scope,
    plan,
  };
}
```

```js
// packages/connect/src/index.js
export { detectConnections } from "./detect.js";
export { buildInstallPlan } from "./planner.js";
export { installConnection } from "./install.js";
export { detectOllama } from "./model-adapters/ollama.js";
export { detectLmStudio } from "./model-adapters/lm-studio.js";
```

- [ ] **Step 4: Run the install tests**

Run:

```bash
node --test tests/connect-install.test.js
```

Expected:

```text
✔ installConnection writes Cursor repo config
✔ installConnection shells out to Claude Code CLI
✔ installConnection creates a managed Continue config for Ollama only when the user config is absent
ℹ fail 0
```

- [ ] **Step 5: Commit the install slice**

```bash
git add packages/connect/src/install.js packages/connect/src/index.js packages/connect/src/filesystem.js packages/connect/src/agent-adapters/cursor.js packages/connect/src/agent-adapters/claude-code.js packages/connect/src/agent-adapters/continue.js tests/connect-install.test.js
git commit -m "feat(connect): add install flows"
```

### Task 5: Implement Verification And Connect Doctor

**Files:**
- Create: `packages/connect/src/verify.js`
- Modify: `packages/connect/src/index.js`
- Create: `tests/connect-verify.test.js`

- [ ] **Step 1: Write failing verification tests**

```js
// tests/connect-verify.test.js
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { verifyConnection } from "../packages/connect/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");

test("verifyConnection performs the stdio MCP handshake", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const report = await verifyConnection({
    client: "cursor",
    repoRoot,
    plan: {
      mcp_entry: {
        command: "node",
        args: [cliPath, "mcp", "serve", "--root", repoRoot],
      },
    },
  });

  assert.equal(report.status, "ready");
  assert.equal(report.initialize_status, "ok");
  assert.equal(report.tools_list_status, "ok");
});
```

- [ ] **Step 2: Run the verification test to verify it fails**

Run:

```bash
node --test tests/connect-verify.test.js
```

Expected:

```text
FAIL tests/connect-verify.test.js
SyntaxError: The requested module '../packages/connect/src/index.js' does not provide an export named 'verifyConnection'
```

- [ ] **Step 3: Implement stdio handshake verification**

```js
// packages/connect/src/verify.js
import { spawn } from "node:child_process";
import readline from "node:readline";

export async function verifyConnection({ client, repoRoot, plan } = {}) {
  const child = spawn(plan.mcp_entry.command, plan.mcp_entry.args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const output = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  });

  const iterator = output[Symbol.asyncIterator]();
  const nextMessage = async () => {
    const result = await iterator.next();
    if (result.done) {
      throw new Error("MCP server closed before verification completed.");
    }
    return JSON.parse(result.value);
  };

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "heart-connect-verify",
          version: "0.1.0",
        },
      },
    })}\n`,
  );

  const initializeResponse = await nextMessage();
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  const toolsResponse = await nextMessage();

  output.close();
  child.kill();

  return {
    client,
    repo_root: repoRoot,
    config_status: "ok",
    spawn_status: "ok",
    initialize_status: initializeResponse.result?.protocolVersion === "2025-06-18" ? "ok" : "failed",
    tools_list_status: Array.isArray(toolsResponse.result?.tools) ? "ok" : "failed",
    model_runtime_status: "not_checked",
    warnings: [],
    status:
      initializeResponse.result?.protocolVersion === "2025-06-18" && Array.isArray(toolsResponse.result?.tools)
        ? "ready"
        : "failed",
  };
}

export async function runConnectDoctor(options = {}) {
  const detection = await options.detectImpl();
  return {
    repo_root: options.repoRoot,
    agents: detection.agents,
    models: detection.models,
    warnings: detection.warnings,
    status: detection.warnings.length === 0 ? "ready" : "partial",
  };
}
```

```js
// packages/connect/src/index.js
export { detectConnections } from "./detect.js";
export { buildInstallPlan } from "./planner.js";
export { installConnection } from "./install.js";
export { verifyConnection, runConnectDoctor } from "./verify.js";
export { detectOllama } from "./model-adapters/ollama.js";
export { detectLmStudio } from "./model-adapters/lm-studio.js";
```

- [ ] **Step 4: Run the verification tests**

Run:

```bash
node --test tests/connect-verify.test.js tests/mcp-stdio.test.js
```

Expected:

```text
✔ verifyConnection performs the stdio MCP handshake
✔ MCP stdio server completes initialize, list, and call flow
ℹ fail 0
```

- [ ] **Step 5: Commit verification and doctor**

```bash
git add packages/connect/src/verify.js packages/connect/src/index.js tests/connect-verify.test.js
git commit -m "feat(connect): verify MCP connections"
```

### Task 6: Wire `heart connect` Into The CLI And Add Contract Coverage

**Files:**
- Modify: `packages/cli/src/index.js`
- Modify: `tests/cli.test.js`

- [ ] **Step 1: Add failing CLI tests for `connect detect`, `connect install --dry-run`, and `connect verify`**

```js
// tests/cli.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { createTempRepoCopy } from "./helpers/temp-repo.js";

const cliPath = path.resolve("packages/cli/bin/heart.js");

test("CLI connect detect returns JSON inventory", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const raw = execFileSync("node", [cliPath, "connect", "detect", "--json", "--root", fixtureRoot], {
    encoding: "utf8",
  });
  const result = JSON.parse(raw);

  assert.equal(Array.isArray(result.agents), true);
  assert.equal(Array.isArray(result.models), true);
});

test("CLI connect install --dry-run returns a plan", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const raw = execFileSync(
    "node",
    [cliPath, "connect", "install", "--json", "--dry-run", "--client", "continue", "--scope", "repo", "--root", fixtureRoot],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.plan.client, "continue");
  assert.equal(result.plan.scope, "repo");
});

test("CLI connect verify returns a ready report for a valid repo", async (t) => {
  const fixtureRoot = await createTempRepoCopy(t);
  const raw = execFileSync(
    "node",
    [cliPath, "connect", "verify", "--json", "--client", "cursor", "--root", fixtureRoot],
    {
      encoding: "utf8",
    },
  );
  const result = JSON.parse(raw);

  assert.equal(result.status, "ready");
});
```

- [ ] **Step 2: Run the CLI tests to verify they fail**

Run:

```bash
node --test tests/cli.test.js
```

Expected:

```text
FAIL tests/cli.test.js
Unknown command: connect
```

- [ ] **Step 3: Add the `connect` command, parser flags, and help text**

```js
// packages/cli/src/index.js
import {
  buildInstallPlan,
  detectConnections,
  installConnection,
  runConnectDoctor,
  verifyConnection,
} from "../../connect/src/index.js";

export async function runCli(argv, io = defaultIo()) {
  const { command, subcommand, flags, positional } = parseArgs(argv);

  switch (command) {
    case "connect":
      return handleConnect(subcommand, flags, io);
    // existing cases stay as-is
  }
}

async function handleConnect(subcommand, flags, io) {
  const repoRoot = resolveRepoRoot(flags.root, io.cwd);

  if (subcommand === "detect") {
    const result = await detectConnections({
      repoRoot,
      env: process.env,
    });
    writeOutput(result, flags.json, io);
    return 0;
  }

  if (subcommand === "install") {
    if (!flags.client) {
      io.stderr.write("Usage: heart connect install --client NAME [--scope user|repo] [--model NAME] [--dry-run] [--backup] [--json] [--root PATH]\n");
      return 1;
    }

    const plan = await buildInstallPlan({
      client: flags.client,
      scope: flags.scope ?? "repo",
      repoRoot,
      env: process.env,
      modelRuntime: flags.model ?? null,
    });

    if (flags["dry-run"]) {
      writeOutput({ plan }, flags.json, io);
      return 0;
    }

    const result = await installConnection({
      client: flags.client,
      scope: flags.scope ?? "repo",
      repoRoot,
      env: process.env,
      model: flags.model ?? null,
      verifyImpl: (installPlan) => verifyConnection({
        client: flags.client,
        repoRoot,
        plan: installPlan,
      }),
    });
    writeOutput(result, flags.json, io);
    return 0;
  }

  if (subcommand === "verify") {
    if (!flags.client) {
      io.stderr.write("Usage: heart connect verify --client NAME [--json] [--root PATH]\n");
      return 1;
    }

    const plan = await buildInstallPlan({
      client: flags.client,
      scope: flags.scope ?? "repo",
      repoRoot,
      env: process.env,
      modelRuntime: flags.model ?? null,
    });
    const result = await verifyConnection({
      client: flags.client,
      repoRoot,
      plan,
    });
    writeOutput(result, flags.json, io);
    return 0;
  }

  if (subcommand === "doctor") {
    const result = await runConnectDoctor({
      repoRoot,
      detectImpl: () => detectConnections({ repoRoot, env: process.env }),
    });
    writeOutput(result, flags.json, io);
    return 0;
  }

  io.stderr.write("Usage: heart connect detect [--json] [--root PATH] [--agents] [--models]\n");
  io.stderr.write("       heart connect install --client NAME [--scope user|repo] [--model NAME] [--dry-run] [--backup] [--json] [--root PATH]\n");
  io.stderr.write("       heart connect verify --client NAME [--json] [--root PATH]\n");
  io.stderr.write("       heart connect doctor [--json] [--root PATH]\n");
  return 1;
}

function parseArgs(argv) {
  // add support for:
  // --client
  // --scope
  // --agents
  // --models
  // --dry-run
  // --backup
}
```

```js
// packages/cli/src/index.js
function parseArgs(argv) {
  const tokens = [...argv];
  const flags = {};
  const positional = [];
  let command;
  let subcommand;

  while (tokens.length > 0) {
    const token = tokens.shift();

    if (token.startsWith("--")) {
      if (token === "--json" || token === "--force" || token === "--rebuild" || token === "--agents" || token === "--models" || token === "--dry-run" || token === "--backup") {
        flags[token.slice(2)] = true;
      } else if (token === "--client") {
        flags.client = tokens.shift();
      } else if (token === "--scope") {
        flags.scope = tokens.shift();
      } else if (token === "--model") {
        flags.model = tokens.shift();
      } else if (token === "--root") {
        flags.root = tokens.shift();
      }
      continue;
    }

    if (!command) {
      command = token;
      continue;
    }

    if ((command === "connect" || command === "mcp" || command === "docs" || command === "diagram" || command === "benchmark" || command === "service" || command === "auth" || command === "sync") && !subcommand) {
      subcommand = token;
      continue;
    }

    positional.push(token);
  }

  return { command, subcommand, flags, positional };
}
```

```text
# helpText additions
  heart connect detect [--json] [--root PATH] [--agents] [--models]
  heart connect install --client NAME [--scope user|repo] [--model NAME] [--dry-run] [--backup] [--json] [--root PATH]
  heart connect verify --client NAME [--json] [--root PATH]
  heart connect doctor [--json] [--root PATH]
```

- [ ] **Step 4: Run CLI contract tests**

Run:

```bash
node --test tests/cli.test.js tests/connect-detect.test.js tests/connect-install.test.js tests/connect-verify.test.js
```

Expected:

```text
✔ CLI connect detect returns JSON inventory
✔ CLI connect install --dry-run returns a plan
✔ CLI connect verify returns a ready report for a valid repo
ℹ fail 0
```

- [ ] **Step 5: Commit the CLI integration**

```bash
git add packages/cli/src/index.js tests/cli.test.js
git commit -m "feat(cli): add connect commands"
```

### Task 7: Update Docs And Run Full Regression

**Files:**
- Modify: `README.md`
- Modify: `docs/04-mcp-cli-spec.md`
- Modify: `docs/11-implementation-blueprint.md`

- [ ] **Step 1: Update CLI and architecture docs**

```md
<!-- docs/04-mcp-cli-spec.md -->
### Connect

Commands:
- `heart connect detect`
- `heart connect install --client continue --scope repo`
- `heart connect verify --client continue`
- `heart connect doctor`

Purpose:
- discover agent hosts and model runtimes
- install MCP wiring safely
- verify stdio MCP connectivity before claiming success
```

```md
<!-- docs/11-implementation-blueprint.md -->
### `packages/connect`

- local agent-host discovery
- local model-runtime discovery
- MCP install planning
- safe config patching
- stdio handshake verification
```

```md
<!-- README.md -->
- local `heart connect` detection, install, and verification for supported MCP clients
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run build
node --test tests/connect-detect.test.js tests/connect-install.test.js tests/connect-verify.test.js tests/cli.test.js tests/mcp-server.test.js tests/mcp-stdio.test.js
```

Expected:

```text
Build validation passed
ℹ pass <non-zero count>
ℹ fail 0
```

- [ ] **Step 3: Commit the documentation and regression pass**

```bash
git add README.md docs/04-mcp-cli-spec.md docs/11-implementation-blueprint.md
git commit -m "docs(connect): document connect workflow"
```
