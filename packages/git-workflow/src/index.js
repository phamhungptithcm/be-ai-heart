import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getGitStatus({ repoRoot = process.cwd() } = {}) {
  const [branch, status] = await Promise.all([
    git(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot).catch(() => "unknown"),
    git(["status", "--short"], repoRoot).catch(() => ""),
  ]);
  const files = status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim() || "modified",
      path: line.slice(3).trim(),
    }));
  return {
    schema_version: 1,
    branch: branch.trim(),
    dirty: files.length > 0,
    changed_file_count: files.length,
    files,
  };
}

export async function getGitDiff({ repoRoot = process.cwd(), staged = false } = {}) {
  const diff = await git(["diff", ...(staged ? ["--staged"] : [])], repoRoot).catch(() => "");
  return {
    schema_version: 1,
    staged,
    diff,
    file_count: countDiffFiles(diff),
  };
}

export async function getGitReview({ repoRoot = process.cwd() } = {}) {
  const [status, unstaged, staged, porcelain] = await Promise.all([
    getGitStatus({ repoRoot }),
    getGitDiff({ repoRoot, staged: false }),
    getGitDiff({ repoRoot, staged: true }),
    git(["status", "--porcelain"], repoRoot).catch(() => ""),
  ]);
  const files = parsePorcelainStatus(porcelain);
  const stagedFiles = files.filter((file) => file.index_status && file.index_status !== "?" && file.index_status !== " ");
  const unstagedFiles = files.filter((file) => file.worktree_status && file.worktree_status !== " ");

  return {
    schema_version: 1,
    status,
    staged: {
      file_count: staged.file_count,
      files: stagedFiles.map((file) => file.path),
    },
    unstaged: {
      file_count: unstaged.file_count,
      files: unstagedFiles.map((file) => file.path),
    },
    files,
    next_actions: buildReviewNextActions({ stagedFiles, unstagedFiles }),
  };
}

export async function buildGitStagePicker({ repoRoot = process.cwd(), limit = 40 } = {}) {
  const review = await getGitReview({ repoRoot });
  const choices = [];
  for (const file of review.files) {
    if (file.index_status && file.index_status !== " " && file.index_status !== "?") {
      choices.push(createStageChoice({
        action: "unstage",
        file,
        command: `heart ide unstage --confirm ${quotePathForCommand(file.path)}`,
      }));
    }
    if (file.worktree_status && file.worktree_status !== " ") {
      choices.push(createStageChoice({
        action: "stage",
        file,
        command: `heart ide stage --confirm ${quotePathForCommand(file.path)}`,
      }));
    }
  }

  return {
    schema_version: 1,
    branch: review.status.branch,
    status: choices.length > 0 ? "ready" : "clean",
    staged_file_count: review.staged.file_count,
    unstaged_file_count: review.unstaged.file_count,
    choices: choices.slice(0, limit).map((choice, index) => ({
      ...choice,
      key: String(index + 1),
    })),
    next_actions: choices.length > 0
      ? choices.slice(0, 3).map((choice) => choice.command)
      : ["No files to stage or unstage."],
  };
}

export async function selectGitStagePickerChoices({
  repoRoot = process.cwd(),
  selection = "",
  confirmed = false,
  limit = 40,
} = {}) {
  const picker = await buildGitStagePicker({ repoRoot, limit });
  const selectedKeys = parseStageSelection(selection);
  const selectedChoices = selectedKeys
    .map((key) => picker.choices.find((choice) => choice.key === key))
    .filter(Boolean);

  if (selectedKeys.length === 0 || selectedChoices.length === 0) {
    return {
      schema_version: 1,
      status: "needs_selection",
      message: "Select one or more stage picker numbers.",
      branch: picker.branch,
      selected_choices: [],
      available_choices: picker.choices,
    };
  }

  if (selectedChoices.length !== selectedKeys.length) {
    return {
      schema_version: 1,
      status: "invalid_selection",
      message: "One or more selected stage picker numbers are not available.",
      branch: picker.branch,
      selected_choices: selectedChoices,
      available_choices: picker.choices,
    };
  }

  if (!confirmed) {
    return {
      schema_version: 1,
      status: "needs_confirmation",
      message: "Selected stage picker actions change the git index. Re-run with --confirm.",
      branch: picker.branch,
      selected_choices: selectedChoices,
      next_action: `heart ide stage-picker --select ${quotePathForCommand(selectedKeys.join(","))} --confirm`,
    };
  }

  const stageFiles = selectedChoices.filter((choice) => choice.action === "stage").map((choice) => choice.path);
  const unstageFiles = selectedChoices.filter((choice) => choice.action === "unstage").map((choice) => choice.path);
  const results = [];
  if (stageFiles.length > 0) {
    results.push(await stageSelectedFiles({ repoRoot, files: stageFiles, confirmed: true }));
  }
  if (unstageFiles.length > 0) {
    results.push(await unstageSelectedFiles({ repoRoot, files: unstageFiles, confirmed: true }));
  }

  return {
    schema_version: 1,
    status: "applied",
    branch: picker.branch,
    selected_choices: selectedChoices,
    staged_files: stageFiles,
    unstaged_files: unstageFiles,
    results,
  };
}

export async function stageSelectedFiles({ repoRoot = process.cwd(), files = [], confirmed = false } = {}) {
  const selectedFiles = normalizeRepoFiles(repoRoot, files);
  if (selectedFiles.length === 0) {
    return {
      schema_version: 1,
      status: "needs_selection",
      message: "Select at least one repo-relative file to stage.",
      files: [],
    };
  }
  if (!confirmed) {
    return {
      schema_version: 1,
      status: "needs_confirmation",
      message: "Staging files changes the git index. Re-run with --confirm.",
      files: selectedFiles,
    };
  }

  await git(["add", "--", ...selectedFiles], repoRoot);
  return {
    schema_version: 1,
    status: "staged",
    files: selectedFiles,
  };
}

export async function unstageSelectedFiles({ repoRoot = process.cwd(), files = [], confirmed = false } = {}) {
  const selectedFiles = normalizeRepoFiles(repoRoot, files);
  if (selectedFiles.length === 0) {
    return {
      schema_version: 1,
      status: "needs_selection",
      message: "Select at least one repo-relative file to unstage.",
      files: [],
    };
  }
  if (!confirmed) {
    return {
      schema_version: 1,
      status: "needs_confirmation",
      message: "Unstaging files changes the git index. Re-run with --confirm.",
      files: selectedFiles,
    };
  }

  await git(["restore", "--staged", "--", ...selectedFiles], repoRoot).catch(async () => {
    await git(["reset", "HEAD", "--", ...selectedFiles], repoRoot);
  });
  return {
    schema_version: 1,
    status: "unstaged",
    files: selectedFiles,
  };
}

export function generateCommitSummary({ status, diffSummary = "" } = {}) {
  const files = status?.files ?? [];
  const scope = inferScope(files);
  const type = inferCommitType(files, diffSummary);
  const subject = `${type}${scope ? `(${scope})` : ""}: update CLI IDE workbench`;
  return {
    schema_version: 1,
    subject,
    body: [
      "- Add terminal-first workbench behavior and safety contracts",
      `- Touch ${files.length} changed file(s) in current working tree`,
    ].join("\n"),
  };
}

export function generatePrSummary({ status, tests = [], risks = [] } = {}) {
  return {
    schema_version: 1,
    title: "feat(cli): add IDE workbench MVP",
    body: [
      "## Summary",
      "- Adds terminal-first IDE workbench foundations for repo-aware AI coding.",
      "",
      "## Changes",
      `- Changed files currently visible: ${status?.changed_file_count ?? 0}`,
      "",
      "## Testing",
      ...(tests.length ? tests.map((entry) => `- ${entry}`) : ["- Targeted CLI and package tests should be run before merge."]),
      "",
      "## Risks",
      ...(risks.length ? risks.map((entry) => `- ${entry}`) : ["- Full terminal editor and LSP remain deferred."]),
    ].join("\n"),
  };
}

async function git(args, cwd) {
  const { stdout } = await execFileAsync("git", args, { cwd, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

function normalizeRepoFiles(repoRoot, files) {
  const root = path.resolve(repoRoot);
  return [...new Set((files ?? []).map(String).map((entry) => entry.trim()).filter(Boolean))]
    .map((entry) => {
      if (entry.startsWith("-")) {
        throw new Error(`Refusing git path that looks like an option: ${entry}`);
      }
      const absolutePath = path.resolve(root, entry);
      const relativePath = path.relative(root, absolutePath);
      if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(`Git file must stay inside repo root: ${entry}`);
      }
      return relativePath.split(path.sep).join("/");
    });
}

function parsePorcelainStatus(output) {
  return String(output ?? "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const indexStatus = line[0] ?? " ";
      const worktreeStatus = line[1] ?? " ";
      const rawPath = line.slice(3).trim();
      const pathParts = rawPath.split(" -> ");
      return {
        index_status: indexStatus,
        worktree_status: worktreeStatus,
        path: pathParts[pathParts.length - 1],
        original_path: pathParts.length > 1 ? pathParts[0] : "",
      };
    });
}

function buildReviewNextActions({ stagedFiles, unstagedFiles }) {
  const actions = [];
  if (unstagedFiles.length > 0) {
    actions.push(`heart ide stage --confirm ${quotePathForCommand(unstagedFiles[0].path)}`);
  }
  if (stagedFiles.length > 0) {
    actions.push("heart ide diff --staged");
    actions.push(`heart ide unstage --confirm ${quotePathForCommand(stagedFiles[0].path)}`);
  }
  if (actions.length === 0) {
    actions.push("No git changes to review.");
  }
  return actions;
}

function createStageChoice({ action, file, command }) {
  return {
    action,
    path: file.path,
    index_status: file.index_status,
    worktree_status: file.worktree_status,
    command,
  };
}

function parseStageSelection(selection) {
  if (Array.isArray(selection)) {
    return selection.flatMap(parseStageSelection);
  }
  return String(selection ?? "")
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => /^\d+$/.test(entry));
}

function quotePathForCommand(filePath) {
  return /\s/.test(filePath) ? JSON.stringify(filePath) : filePath;
}

function countDiffFiles(diff) {
  return (String(diff ?? "").match(/^diff --git /gm) ?? []).length;
}

function inferScope(files) {
  const paths = files.map((file) => file.path);
  if (paths.some((entry) => entry.startsWith("packages/cli"))) return "cli";
  if (paths.some((entry) => entry.startsWith("packages/"))) return "packages";
  if (paths.some((entry) => entry.startsWith("docs/"))) return "docs";
  return "";
}

function inferCommitType(files, diffSummary) {
  const text = `${files.map((file) => file.path).join(" ")} ${diffSummary}`.toLowerCase();
  if (text.includes("test")) return "test";
  if (text.includes("docs/") || text.includes(".md")) return "docs";
  return "feat";
}
