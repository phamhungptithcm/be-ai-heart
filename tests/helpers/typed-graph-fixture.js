import fs from "node:fs/promises";
import path from "node:path";

export async function writeTypedGraphFixture(repoRoot) {
  await fs.writeFile(
    path.join(repoRoot, "src/auth/base.ts"),
    `export class BaseAuthService {}

export interface AuthWorkflow {
  authenticate(username: string): Promise<unknown>;
}
`,
    "utf8",
  );
  await fs.writeFile(
    path.join(repoRoot, "src/auth/service.ts"),
    `import { BaseAuthService, AuthWorkflow } from "./base";
import { loginUser } from "./login";

export class AuthService extends BaseAuthService implements AuthWorkflow {
  async authenticate(username: string) {
    return loginUser(username);
  }
}
`,
    "utf8",
  );
  await fs.writeFile(
    path.join(repoRoot, "src/auth/login.test.ts"),
    `import { loginUser } from "./login";

export async function loginFlowTest() {
  return loginUser("Casey");
}
`,
    "utf8",
  );
}
