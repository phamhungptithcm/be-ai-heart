import path from "node:path";
import { scanDocumentTree } from "../../document-ingest/src/index.js";
import { buildProjectGraph } from "../../graph/src/index.js";
import { scanSourceTree } from "../../parser-ts/src/index.js";
import { evaluatePolicyViolations } from "../../policy-engine/src/index.js";
import { loadHeartConfig } from "./config.js";

export async function buildWorkspaceState(repoRoot) {
  const configState = await loadHeartConfig(repoRoot);
  const scanResult = await scanSourceTree(repoRoot, {
    ignore: configState.config.project.ignore,
  });
  const documentIndex = await scanDocumentTree(repoRoot, {
    roots: configState.config.knowledge?.document_paths,
    ignore: configState.config.project.ignore,
  });
  const graph = buildProjectGraph(scanResult, {
    repoName: path.basename(repoRoot),
  });
  const policyReport = evaluatePolicyViolations(scanResult);

  return {
    repoRoot,
    configState,
    scanResult,
    documentIndex,
    graph,
    policyReport,
  };
}
