import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

export async function createConnectTestContext(t) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "heart-connect-"));
  const repoRoot = path.join(tempRoot, "repo");
  const homeRoot = path.join(tempRoot, "home");

  await fs.mkdir(repoRoot, { recursive: true });
  await fs.mkdir(homeRoot, { recursive: true });

  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  return {
    tempRoot,
    repoRoot,
    homeRoot,
    env: {
      HOME: homeRoot,
      USERPROFILE: homeRoot,
    },
  };
}
