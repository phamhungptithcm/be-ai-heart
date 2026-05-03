import fs from "node:fs/promises";
import path from "node:path";

export const KEYMAP_SCHEMA_VERSION = 1;

const DEFAULT_BINDINGS = Object.freeze([
  binding("workbench.file.search", "Ctrl+P", "global", "Open file search"),
  binding("workbench.commandPalette.open", "Ctrl+Shift+P", "global", "Open command palette"),
  binding("ai.command.open", "Ctrl+K", "editor", "Open AI command"),
  binding("ai.chat.askSelection", "Ctrl+L", "editor", "Ask AI about current file or selection"),
  binding("ai.suggestion.accept", "Tab", "editor.suggestion.visible", "Accept suggestion"),
  binding("ai.suggestion.accept.word", "Alt+Right", "editor.suggestion.visible", "Accept suggestion word"),
  binding("ai.suggestion.accept.line", "Alt+Down", "editor.suggestion.visible", "Accept suggestion line"),
  binding("patch.applyConfirmed", "Ctrl+Enter", "patch.preview.visible", "Apply approved patch"),
  binding("workbench.terminal.toggle", "Ctrl+J", "global", "Toggle terminal"),
  binding("workbench.fileTree.toggle", "Ctrl+B", "global", "Toggle file tree"),
  binding("beheart.context.toggle", "Ctrl+G", "global", "Toggle graph and context panel"),
  binding("beheart.docs.toggle", "Ctrl+D", "global", "Toggle docs/spec panel"),
  binding("dev.task.run", "Ctrl+R", "global", "Run task"),
  binding("dev.tests.run", "Ctrl+T", "global", "Run tests"),
  binding("diagnostics.show", "Ctrl+E", "global", "Show diagnostics"),
  binding("git.diff.review", "Ctrl+Shift+D", "global", "Open diff review"),
  binding("workbench.cancel", "Esc", "global", "Cancel active popup or tool"),
  binding("workbench.exit", "/exit", "global", "Exit IDE workbench"),
  binding("workbench.exit", "q", "review", "Close current review panel"),
]);

const VIM_BINDINGS = Object.freeze([
  binding("workbench.exit", ":q", "global", "Exit IDE workbench", "preset"),
  binding("workbench.file.search", "<leader>f", "global", "Open file search", "preset"),
  binding("workbench.commandPalette.open", "<leader>p", "global", "Open command palette", "preset"),
  binding("ai.command.open", "<leader>a", "editor", "Open AI command", "preset"),
]);

const VSCODE_LIKE_BINDINGS = Object.freeze([
  binding("workbench.file.search", "Ctrl+P", "global", "Open file search", "preset"),
  binding("workbench.commandPalette.open", "Ctrl+Shift+P", "global", "Open command palette", "preset"),
  binding("workbench.terminal.toggle", "Ctrl+`", "global", "Toggle terminal", "preset"),
  binding("git.diff.review", "Ctrl+Shift+G", "global", "Open git review", "preset"),
]);

const EMACS_BINDINGS = Object.freeze([
  binding("workbench.file.search", "Ctrl+X Ctrl+F", "global", "Open file search", "preset"),
  binding("workbench.cancel", "Ctrl+G", "global", "Cancel active popup or tool", "preset"),
  binding("workbench.exit", "Ctrl+X Ctrl+C", "global", "Exit IDE workbench", "preset"),
]);

export const KEYMAP_PRESETS = Object.freeze({
  default: {
    schema_version: KEYMAP_SCHEMA_VERSION,
    profile: "default",
    extends: "",
    bindings: DEFAULT_BINDINGS,
  },
  vim: {
    schema_version: KEYMAP_SCHEMA_VERSION,
    profile: "vim",
    extends: "default",
    bindings: [...DEFAULT_BINDINGS, ...VIM_BINDINGS],
  },
  "vscode-like": {
    schema_version: KEYMAP_SCHEMA_VERSION,
    profile: "vscode-like",
    extends: "default",
    bindings: mergeBindings(DEFAULT_BINDINGS, VSCODE_LIKE_BINDINGS),
  },
  emacs: {
    schema_version: KEYMAP_SCHEMA_VERSION,
    profile: "emacs",
    extends: "default",
    bindings: [...DEFAULT_BINDINGS, ...EMACS_BINDINGS],
  },
});

export async function loadKeymap({ repoRoot = process.cwd(), profile, configPath } = {}) {
  const workspacePath = configPath ?? path.join(repoRoot, ".heart", "keymap.yaml");
  const workspaceConfig = await readWorkspaceKeymap(workspacePath);
  const selectedProfile = String(profile ?? workspaceConfig.profile ?? "default").trim() || "default";
  const baseProfile = KEYMAP_PRESETS[selectedProfile] ?? KEYMAP_PRESETS[workspaceConfig.extends] ?? KEYMAP_PRESETS.default;
  const bindings = mergeBindings(baseProfile.bindings, workspaceConfig.bindings ?? []);
  const conflicts = detectKeybindingConflicts(bindings);

  return {
    schema_version: KEYMAP_SCHEMA_VERSION,
    profile: selectedProfile,
    extends: workspaceConfig.extends ?? baseProfile.extends ?? "",
    config_path: workspacePath,
    bindings,
    conflicts,
    presets: Object.keys(KEYMAP_PRESETS),
  };
}

export async function saveKeymap({ repoRoot = process.cwd(), profile = "custom", extendsProfile = "default", bindings = [], configPath } = {}) {
  const targetPath = configPath ?? path.join(repoRoot, ".heart", "keymap.yaml");
  const payload = {
    schema_version: KEYMAP_SCHEMA_VERSION,
    profile,
    extends: extendsProfile,
    bindings,
  };
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, renderKeymapYaml(payload), "utf8");
  return {
    schema_version: KEYMAP_SCHEMA_VERSION,
    status: "saved",
    config_path: targetPath,
    profile,
    binding_count: bindings.length,
  };
}

export function resolveKeybinding({ keymap, key, context = "global" } = {}) {
  const normalizedKey = normalizeKey(key);
  const bindings = keymap?.bindings ?? [];
  const candidates = bindings.filter((entry) => normalizeKey(entry.key) === normalizedKey && contextMatches(entry.when, context));
  const selected = candidates[candidates.length - 1] ?? null;
  return selected
    ? {
        schema_version: KEYMAP_SCHEMA_VERSION,
        status: "resolved",
        action: selected.action,
        binding: selected,
      }
    : {
        schema_version: KEYMAP_SCHEMA_VERSION,
        status: "not_found",
        action: "",
        binding: null,
      };
}

export function detectKeybindingConflicts(bindings = []) {
  const seen = new Map();
  const conflicts = [];

  for (const entry of bindings) {
    const conflictKey = `${normalizeKey(entry.key)}::${String(entry.when ?? "global").trim() || "global"}`;
    const previous = seen.get(conflictKey);
    if (previous && previous.action !== entry.action) {
      conflicts.push({
        schema_version: KEYMAP_SCHEMA_VERSION,
        key: entry.key,
        when: entry.when ?? "global",
        actions: [previous.action, entry.action],
        severity: "warning",
      });
      continue;
    }
    seen.set(conflictKey, entry);
  }

  return conflicts;
}

function binding(action, key, when, description, source = "default") {
  return {
    schema_version: KEYMAP_SCHEMA_VERSION,
    action,
    key,
    when,
    description,
    source,
  };
}

function mergeBindings(base = [], overrides = []) {
  const merged = [...base];
  for (const override of overrides) {
    const normalized = normalizeBinding(override);
    const index = merged.findIndex(
      (entry) => entry.action === normalized.action && String(entry.when ?? "global") === String(normalized.when ?? "global"),
    );
    if (index >= 0) {
      merged[index] = normalized;
    } else {
      merged.push(normalized);
    }
  }
  return merged;
}

function normalizeBinding(entry = {}) {
  return {
    schema_version: KEYMAP_SCHEMA_VERSION,
    action: String(entry.action ?? "").trim(),
    key: String(entry.key ?? "").trim(),
    when: String(entry.when ?? "global").trim() || "global",
    description: String(entry.description ?? entry.action ?? "").trim(),
    source: String(entry.source ?? "workspace").trim() || "workspace",
  };
}

async function readWorkspaceKeymap(configPath) {
  try {
    const text = await fs.readFile(configPath, "utf8");
    return parseKeymapYaml(text);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function parseKeymapYaml(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const result = { bindings: [] };
  let activeBinding = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+#.*$/, "");
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith("- ")) {
      activeBinding = {};
      result.bindings.push(activeBinding);
      assignYamlScalar(activeBinding, trimmed.slice(2));
      continue;
    }
    if (/^\w/.test(trimmed) && !line.startsWith(" ")) {
      assignYamlScalar(result, trimmed);
      activeBinding = null;
      continue;
    }
    if (activeBinding && /^\w/.test(trimmed)) {
      assignYamlScalar(activeBinding, trimmed);
    }
  }

  result.bindings = result.bindings.map(normalizeBinding).filter((entry) => entry.action && entry.key);
  return result;
}

function assignYamlScalar(target, text) {
  const index = text.indexOf(":");
  if (index < 0) {
    return;
  }
  const key = text.slice(0, index).trim();
  const value = text.slice(index + 1).trim().replace(/^["']|["']$/g, "");
  if (key === "bindings" && value === "") {
    target.bindings = Array.isArray(target.bindings) ? target.bindings : [];
    return;
  }
  target[key] = key === "schema_version" ? Number(value) : value;
}

function renderKeymapYaml(profile) {
  const lines = [
    `schema_version: ${KEYMAP_SCHEMA_VERSION}`,
    `profile: ${profile.profile}`,
    `extends: ${profile.extends || "default"}`,
    "bindings:",
  ];
  for (const entry of profile.bindings ?? []) {
    lines.push(`  - action: ${entry.action}`);
    lines.push(`    key: ${entry.key}`);
    lines.push(`    when: ${entry.when ?? "global"}`);
    lines.push(`    description: ${entry.description ?? entry.action}`);
    lines.push(`    source: ${entry.source ?? "workspace"}`);
  }
  return `${lines.join("\n")}\n`;
}

function contextMatches(bindingContext = "global", activeContext = "global") {
  const bindingValue = String(bindingContext || "global");
  const activeValue = String(activeContext || "global");
  return bindingValue === "global" || bindingValue === activeValue || activeValue.startsWith(`${bindingValue}.`);
}

function normalizeKey(key) {
  return String(key ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
