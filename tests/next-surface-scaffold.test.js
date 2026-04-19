import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { resolveMonorepoRoot } from "../packages/core/src/index.js";

const ROOT_DIR = process.cwd();

test("Next.js surface route scaffolds exist for website, portal, and admin", async (t) => {
  const expectedPaths = [
    "apps/website/app/layout.jsx",
    "apps/website/app/page.jsx",
    "apps/website/app/product/page.jsx",
    "apps/website/app/benchmark/page.jsx",
    "apps/website/app/pricing/page.jsx",
    "apps/website/app/security/page.jsx",
    "apps/website/app/docs/page.jsx",
    "apps/website/app/customers/page.jsx",
    "apps/website/app/sign-in/page.jsx",
    "apps/website/app/start-trial/page.jsx",
    "apps/website/app/book-demo/page.jsx",
    "apps/portal/app/layout.jsx",
    "apps/portal/app/page.jsx",
    "apps/portal/app/repositories/page.jsx",
    "apps/portal/app/repositories/[slug]/page.jsx",
    "apps/portal/app/documents/page.jsx",
    "apps/portal/app/benchmarks/page.jsx",
    "apps/portal/app/benchmarks/[reportId]/page.jsx",
    "apps/portal/app/usage/page.jsx",
    "apps/portal/app/billing/page.jsx",
    "apps/admin/app/layout.jsx",
    "apps/admin/app/page.jsx",
    "apps/admin/app/documents/page.jsx",
    "apps/admin/app/benchmarks/page.jsx",
    "apps/admin/app/benchmarks/[reportId]/page.jsx",
    "apps/admin/app/customers/page.jsx",
    "apps/admin/app/customers/[slug]/page.jsx",
    "apps/admin/app/support/page.jsx",
    "apps/admin/app/revenue/page.jsx",
    "apps/admin/app/ops-health/page.jsx",
  ];

  await Promise.all(
    expectedPaths.map(async (relativePath) => {
      await fs.access(path.join(ROOT_DIR, relativePath));
    }),
  );

  const removedApiRouteFiles = [
    path.join(ROOT_DIR, "apps", "portal", "app", "api", "session", "route.js"),
    path.join(ROOT_DIR, "apps", "admin", "app", "api", "session", "route.js"),
  ];

  await Promise.all(
    removedApiRouteFiles.map(async (filePath) => {
      await assert.rejects(fs.access(filePath));
    }),
  );
});

test("workspace scripts expose dev and build entry points for each Next surface", async () => {
  const packageJsonRaw = await fs.readFile(path.join(ROOT_DIR, "package.json"), "utf8");
  const packageJson = JSON.parse(packageJsonRaw);

  assert.equal(packageJson.scripts["website:dev"], "npm run dev --workspace @be-ai-heart/website");
  assert.equal(packageJson.scripts["website:build"], "npm run build --workspace @be-ai-heart/website");
  assert.equal(packageJson.scripts["portal:dev"], "npm run dev --workspace @be-ai-heart/portal");
  assert.equal(packageJson.scripts["portal:build"], "npm run build --workspace @be-ai-heart/portal");
  assert.equal(packageJson.scripts["admin:dev"], "npm run dev --workspace @be-ai-heart/admin");
  assert.equal(packageJson.scripts["admin:build"], "npm run build --workspace @be-ai-heart/admin");
});

test("core monorepo root resolution works from nested app directories", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "be-ai-heart-root-"));
  const monorepoRoot = path.join(tempRoot, "workspace");
  const nestedPortalDir = path.join(monorepoRoot, "apps", "portal", "app", "repositories");

  await fs.mkdir(nestedPortalDir, { recursive: true });
  await fs.mkdir(path.join(monorepoRoot, "packages"), { recursive: true });
  await fs.writeFile(
    path.join(monorepoRoot, "package.json"),
    `${JSON.stringify({ name: "be-ai-heart", private: true }, null, 2)}\n`,
    "utf8",
  );

  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  assert.equal(resolveMonorepoRoot({ startDir: nestedPortalDir }), monorepoRoot);
});

test("surface components use Next Link in navigation shells", async () => {
  const files = [
    "apps/website/components/WebsiteShell.jsx",
    "apps/portal/components/PortalShell.jsx",
    "apps/admin/components/AdminShell.jsx",
  ];

  await Promise.all(
    files.map(async (relativePath) => {
      const source = await fs.readFile(path.join(ROOT_DIR, relativePath), "utf8");
      assert.match(source, /import Link from "next\/link";/);
      assert.match(source, /<Link/);
    }),
  );
});
