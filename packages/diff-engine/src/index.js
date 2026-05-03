import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { hashContent, resolveRepoPath } from "../../editor-core/src/index.js";

export const PATCH_SCHEMA_VERSION = 1;

export function generatePatch({ title = "AI patch", summary = "", prompt = "", files = [], contextAttachments = [], model = {} } = {}) {
  return {
    schema_version: PATCH_SCHEMA_VERSION,
    proposal_id: `patch-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    title,
    summary,
    source: "ai",
    prompt,
    model,
    context_attachments: contextAttachments,
    files: files.map(normalizePatchFileChange),
    policy_warnings: [],
    risks: [],
    tests_to_run: [],
    created_at: new Date().toISOString(),
  };
}

export async function previewPatch({ repoRoot = process.cwd(), proposal } = {}) {
  const normalized = normalizeProposal(proposal);
  const hunks = [];
  const filesAdded = [];
  const filesModified = [];
  const filesDeleted = [];
  const conflictWarnings = [];
  const sensitiveWarnings = [];

  for (const fileChange of normalized.files) {
    const targetPath = resolveRepoPath(repoRoot, fileChange.path);
    const beforeExists = await fileExists(targetPath);
    const beforeContent = beforeExists ? await fs.readFile(targetPath, "utf8") : "";
    const afterContent = fileChange.delete ? "" : String(fileChange.new_content ?? "");
    const beforeHash = hashContent(beforeContent);
    const expectedHash = fileChange.expected_hash ?? beforeHash;
    if (beforeHash !== expectedHash) {
      conflictWarnings.push(`${fileChange.path} changed since proposal was created.`);
    }
    if (detectSensitiveText(afterContent) || detectSensitiveText(fileChange.path)) {
      sensitiveWarnings.push(`${fileChange.path} contains sensitive-looking text.`);
    }
    if (!beforeExists && !fileChange.delete) {
      filesAdded.push(fileChange.path);
    } else if (fileChange.delete) {
      filesDeleted.push(fileChange.path);
    } else {
      filesModified.push(fileChange.path);
    }
    hunks.push({
      schema_version: PATCH_SCHEMA_VERSION,
      path: fileChange.path,
      status: beforeHash === expectedHash ? "ready" : "conflict",
      before_hash: beforeHash,
      expected_hash: expectedHash,
      after_hash: hashContent(afterContent),
      existed: beforeExists,
      delete: fileChange.delete,
      before_content: beforeContent,
      after_content: afterContent,
      diff: renderUnifiedDiff(fileChange.path, beforeContent, afterContent),
    });
  }

  return {
    schema_version: PATCH_SCHEMA_VERSION,
    preview_id: `preview-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    proposal_id: normalized.proposal_id,
    status: conflictWarnings.length > 0 || sensitiveWarnings.length > 0 ? "conflict" : "pending",
    hunks,
    files_added: filesAdded,
    files_modified: filesModified,
    files_deleted: filesDeleted,
    conflict_warnings: conflictWarnings,
    secret_warnings: sensitiveWarnings,
    rollback_id: "",
  };
}

export async function applyPatchWithConfirmation({ repoRoot = process.cwd(), preview, confirmed = false } = {}) {
  if (!confirmed) {
    return {
      schema_version: PATCH_SCHEMA_VERSION,
      status: "needs_confirmation",
      message: "Patch apply requires explicit confirmation after preview.",
    };
  }
  if (!preview?.hunks?.length) {
    throw new Error("Patch preview with hunks is required.");
  }
  if ((preview.conflict_warnings ?? []).length > 0 || (preview.secret_warnings ?? []).length > 0) {
    return {
      schema_version: PATCH_SCHEMA_VERSION,
      status: "blocked",
      message: "Resolve patch conflicts or sensitive-content warnings before applying.",
      conflict_warnings: preview.conflict_warnings ?? [],
      secret_warnings: preview.secret_warnings ?? [],
    };
  }

  const rollbackId = `rollback-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const rollbackFiles = [];
  for (const hunk of preview.hunks) {
    const targetPath = resolveRepoPath(repoRoot, hunk.path);
    const currentContent = await fs.readFile(targetPath, "utf8").catch((error) => {
      if (error?.code === "ENOENT") {
        return "";
      }
      throw error;
    });
    const currentHash = hashContent(currentContent);
    if (currentHash !== hunk.expected_hash) {
      return {
        schema_version: PATCH_SCHEMA_VERSION,
        status: "conflict",
        path: hunk.path,
        expected_hash: hunk.expected_hash,
        actual_hash: currentHash,
        message: "File changed after patch preview. Preview again before applying.",
      };
    }
    rollbackFiles.push({
      path: hunk.path,
      content: currentContent,
      hash: currentHash,
    });
  }

  await writeRollback(
    repoRoot,
    rollbackId,
    rollbackFiles.map((file) => ({
      ...file,
      after_hash: preview.hunks.find((hunk) => hunk.path === file.path)?.after_hash ?? "",
      existed: preview.hunks.find((hunk) => hunk.path === file.path)?.existed ?? true,
    })),
  );
  for (const hunk of preview.hunks) {
    const targetPath = resolveRepoPath(repoRoot, hunk.path);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    if (hunk.delete) {
      await fs.rm(targetPath, { force: true });
    } else {
      await fs.writeFile(targetPath, hunk.after_content, "utf8");
    }
  }

  return {
    schema_version: PATCH_SCHEMA_VERSION,
    status: "applied",
    rollback_id: rollbackId,
    files_changed: preview.hunks.map((hunk) => hunk.path),
  };
}

export async function rollbackAiPatch({ repoRoot = process.cwd(), rollbackId } = {}) {
  const safeId = sanitizeRollbackId(rollbackId);
  const rollbackPath = path.join(repoRoot, ".heart", "ide", "rollback", `${safeId}.json`);
  const payload = JSON.parse(await fs.readFile(rollbackPath, "utf8"));
  for (const file of payload.files ?? []) {
    const targetPath = resolveRepoPath(repoRoot, file.path);
    const current = await fs.readFile(targetPath, "utf8").catch(() => "");
    if (file.after_hash && hashContent(current) !== file.after_hash) {
      return {
        schema_version: PATCH_SCHEMA_VERSION,
        status: "conflict",
        path: file.path,
        message: "File changed after AI patch apply. Review before rollback.",
      };
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    if (file.content === "" && file.existed === false) {
      await fs.rm(targetPath, { force: true });
    } else {
      await fs.writeFile(targetPath, file.content, "utf8");
    }
  }
  return {
    schema_version: PATCH_SCHEMA_VERSION,
    status: "rolled_back",
    rollback_id: safeId,
    files_restored: (payload.files ?? []).map((file) => file.path),
  };
}

export function renderUnifiedDiff(filePath, beforeContent, afterContent) {
  const beforeLines = String(beforeContent ?? "").split("\n");
  const afterLines = String(afterContent ?? "").split("\n");
  const lines = [`--- a/${filePath}`, `+++ b/${filePath}`, `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let index = 0; index < max; index += 1) {
    const before = beforeLines[index];
    const after = afterLines[index];
    if (before === after) {
      lines.push(` ${before ?? ""}`);
    } else {
      if (before !== undefined) {
        lines.push(`-${before}`);
      }
      if (after !== undefined) {
        lines.push(`+${after}`);
      }
    }
  }
  return lines.join("\n");
}

async function writeRollback(repoRoot, rollbackId, files) {
  const rollbackRoot = path.join(repoRoot, ".heart", "ide", "rollback");
  await fs.mkdir(rollbackRoot, { recursive: true });
  const enrichedFiles = files.map((file) => ({
    ...file,
    existed: file.existed !== false,
    after_hash: file.after_hash ?? "",
  }));
  await fs.writeFile(
    path.join(rollbackRoot, `${rollbackId}.json`),
    `${JSON.stringify({ schema_version: PATCH_SCHEMA_VERSION, rollback_id: rollbackId, files: enrichedFiles }, null, 2)}\n`,
    "utf8",
  );
}

function normalizeProposal(proposal = {}) {
  return {
    ...proposal,
    schema_version: PATCH_SCHEMA_VERSION,
    proposal_id: proposal.proposal_id ?? `patch-${Date.now().toString(36)}`,
    files: (proposal.files ?? []).map(normalizePatchFileChange),
  };
}

function normalizePatchFileChange(file = {}) {
  const filePath = String(file.path ?? file.file ?? "").trim();
  if (!filePath) {
    throw new Error("Patch file path is required.");
  }
  return {
    path: filePath,
    expected_hash: String(file.expected_hash ?? "").trim() || undefined,
    new_content: String(file.new_content ?? file.content ?? ""),
    delete: Boolean(file.delete),
  };
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeRollbackId(value) {
  const safeId = String(value ?? "").trim();
  if (!/^[a-z0-9_.-]+$/i.test(safeId)) {
    throw new Error("Invalid rollback id.");
  }
  return safeId;
}

function detectSensitiveText(value) {
  return /(?:api[_-]?key|password|token|sk-[a-z0-9_-]{12,}|sk_[a-z0-9_-]{12,})/i.test(String(value ?? ""));
}
