import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  loadDocEntry,
  loadDocsCatalog,
  searchDocs,
} from "../apps/website/src/docs/index.js";

test("website docs loader indexes versioned MDX content and supports search", async (t) => {
  const docsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-docs-"));

  t.after(async () => {
    await fs.rm(docsRoot, { recursive: true, force: true });
  });

  await fs.mkdir(path.join(docsRoot, "v1", "getting-started"), { recursive: true });
  await fs.mkdir(path.join(docsRoot, "v1", "benchmarking"), { recursive: true });

  await fs.writeFile(
    path.join(docsRoot, "v1", "getting-started", "index.mdx"),
    `---
title: Getting Started
description: Install the CLI and publish a first project heart.
order: 10
category: onboarding
keywords:
  - cli
  - sync
---

# Install the heart

Use \`heart scan\` and \`heart diagram sync\` to move from local proof to portal visibility.
`,
    "utf8",
  );

  await fs.writeFile(
    path.join(docsRoot, "v1", "benchmarking", "index.mdx"),
    `---
title: Benchmarking ROI
description: Measure token, cost, and memory savings.
order: 20
category: roi
keywords:
  - benchmark
  - token
  - savings
---

# Benchmark evidence

Run a baseline vs heart-assisted comparison before rollout expands.
`,
    "utf8",
  );

  const catalog = await loadDocsCatalog({ docsRoot });
  assert.equal(catalog.latestVersion, "v1");
  assert.equal(catalog.versions.length, 1);
  assert.equal(catalog.documents.length, 2);
  assert.equal(catalog.documents[0].slug, "getting-started");

  const doc = await loadDocEntry({
    docsRoot,
    version: "v1",
    slugSegments: ["benchmarking"],
  });
  assert.equal(doc.metadata.title, "Benchmarking ROI");
  assert.equal(doc.headings[0].slug, "benchmark-evidence");
  assert.match(doc.searchText, /token, cost, and memory savings/i);

  const results = searchDocs(catalog, "token savings");
  assert.equal(results.length, 1);
  assert.equal(results[0].slug, "benchmarking");
});
