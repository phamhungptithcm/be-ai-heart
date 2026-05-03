import { generatePatch } from "../../diff-engine/src/index.js";

export async function requestInlineEdit({ prompt, selection, buffer, contextAttachments = [], patchProvider } = {}) {
  if (typeof patchProvider === "function") {
    return patchProvider({ prompt, selection, buffer, contextAttachments });
  }
  return generatePatch({
    title: "Inline edit proposal",
    summary: "Patch provider is not configured; proposal records the requested edit context.",
    prompt,
    contextAttachments,
    files: buffer?.path
      ? [{
          path: buffer.path,
          expected_hash: buffer.saved_hash,
          new_content: buffer.content,
        }]
      : [],
  });
}

export { generatePatch };
