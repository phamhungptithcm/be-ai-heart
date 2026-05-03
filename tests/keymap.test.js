import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  detectKeybindingConflicts,
  loadKeymap,
  resolveKeybinding,
  saveKeymap,
} from "../packages/keymap/src/index.js";

test("default keymap resolves core IDE bindings", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-keymap-"));
  const keymap = await loadKeymap({ repoRoot });

  assert.equal(keymap.profile, "default");
  assert.equal(resolveKeybinding({ keymap, key: "Ctrl+P", context: "global" }).action, "workbench.file.search");
  assert.equal(resolveKeybinding({ keymap, key: "Alt+Right", context: "editor.suggestion.visible" }).action, "ai.suggestion.accept.word");
});

test("workspace keymap overrides and reports conflicts", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "beheart-keymap-custom-"));
  await saveKeymap({
    repoRoot,
    profile: "custom",
    bindings: [
      { action: "workbench.file.search", key: "Ctrl+O", when: "global", description: "Open files" },
      { action: "dev.tests.run", key: "Ctrl+O", when: "global", description: "Run tests" },
    ],
  });

  const keymap = await loadKeymap({ repoRoot, profile: "custom" });
  assert.equal(keymap.profile, "custom");
  assert.ok(keymap.conflicts.some((entry) => entry.key === "Ctrl+O"));

  const conflicts = detectKeybindingConflicts([
    { action: "a", key: "Ctrl+X", when: "global" },
    { action: "b", key: "Ctrl+X", when: "global" },
  ]);
  assert.equal(conflicts.length, 1);
});
