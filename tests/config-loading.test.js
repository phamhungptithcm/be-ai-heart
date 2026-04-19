import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadHeartConfig } from "../packages/core/src/index.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

test("config loader parses repo-local yaml values instead of defaulting most fields", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const configPath = path.join(repoRoot, "heart.config.yaml");

  await fs.writeFile(
    configPath,
    `project:
  name: fixture-heart
  language_priority:
    - javascript
    - typescript
  entrypoints:
    - src
  ignore:
    - generated
    - fixtures/tmp
policies:
  rules_file: .heart/custom-policies.yaml
indexing:
  incremental: false
  embeddings: local
knowledge:
  document_paths:
    - docs
    - notes
mcp:
  enabled_tools:
    - project_overview
    - document_search
`,
    "utf8",
  );

  const configState = await loadHeartConfig(repoRoot);

  assert.equal(configState.exists, true);
  assert.equal(configState.path, configPath);
  assert.equal(configState.config.project.name, "fixture-heart");
  assert.deepEqual(configState.config.project.language_priority, ["javascript", "typescript"]);
  assert.deepEqual(configState.config.project.entrypoints, ["src"]);
  assert.deepEqual(configState.config.project.ignore, ["generated", "fixtures/tmp"]);
  assert.equal(configState.config.policies.rules_file, ".heart/custom-policies.yaml");
  assert.equal(configState.config.indexing.incremental, false);
  assert.equal(configState.config.indexing.embeddings, "local");
  assert.deepEqual(configState.config.knowledge.document_paths, ["docs", "notes"]);
  assert.deepEqual(configState.config.mcp.enabled_tools, ["project_overview", "document_search"]);
});
