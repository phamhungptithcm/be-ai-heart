import path from "node:path";
import { fileURLToPath } from "node:url";

const connectSrcDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveHeartCliPath() {
  return path.resolve(connectSrcDir, "../../cli/bin/heart.js");
}
