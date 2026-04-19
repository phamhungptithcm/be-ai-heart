import fs from "node:fs/promises";
import path from "node:path";
import { parseSimpleYaml } from "../../shared-schema/src/index.js";

export const DEFAULT_POLICY_RULES = Object.freeze([
  {
    id: "packages-no-app-imports",
    from_prefix: "packages/",
    blocked_prefix: "apps/",
    description: "Packages must not import application-layer code.",
  },
  {
    id: "services-no-app-imports",
    from_prefix: "services/",
    blocked_prefix: "apps/",
    description: "Services must not import application-layer code.",
  },
]);

export function createDefaultPoliciesYaml() {
  return `rules:
  - id: packages-no-app-imports
    from_prefix: packages/
    blocked_prefix: apps/
    description: packages must not import app-layer code
  - id: services-no-app-imports
    from_prefix: services/
    blocked_prefix: apps/
    description: services must not import app-layer code
  - id: redact-secrets-from-context
    description: do not include secrets or credentials in context artifacts
`;
}

export async function loadPolicyRules(repoRoot, options = {}) {
  const policyPath = path.join(repoRoot, options.rulesFile ?? ".heart/policies.yaml");

  try {
    const raw = await fs.readFile(policyPath, "utf8");
    const parsed = parseSimpleYaml(raw);

    return {
      exists: true,
      path: policyPath,
      raw,
      rules: normalizePolicyRules(parsed?.rules),
    };
  } catch {
    return {
      exists: false,
      path: policyPath,
      raw: "",
      rules: DEFAULT_POLICY_RULES,
    };
  }
}

export function evaluatePolicyViolations(scanResult, rules = DEFAULT_POLICY_RULES) {
  const violations = [];

  for (const file of scanResult.files) {
    for (const specifier of file.imports) {
      const resolvedPath = resolveRelativePath(file.relativePath, specifier);
      if (!resolvedPath) {
        continue;
      }

      for (const rule of rules) {
        if (!rule.from_prefix || !rule.blocked_prefix) {
          continue;
        }

        if (file.relativePath.startsWith(rule.from_prefix) && resolvedPath.startsWith(rule.blocked_prefix)) {
          violations.push({
            rule_id: rule.id,
            file: file.relativePath,
            specifier,
            resolved_path: resolvedPath,
            message: `${file.relativePath} violates ${rule.id} by importing ${resolvedPath}.`,
          });
        }
      }
    }
  }

  return {
    rules,
    violations,
  };
}

function normalizePolicyRules(rules) {
  if (!Array.isArray(rules)) {
    return DEFAULT_POLICY_RULES;
  }

  const normalized = rules
    .filter((rule) => rule && typeof rule === "object" && typeof rule.id === "string")
    .map((rule) => ({
      id: rule.id,
      from_prefix: typeof rule.from_prefix === "string" ? rule.from_prefix : null,
      blocked_prefix: typeof rule.blocked_prefix === "string" ? rule.blocked_prefix : null,
      description: typeof rule.description === "string" ? rule.description : "",
    }));

  return normalized.length > 0 ? normalized : DEFAULT_POLICY_RULES;
}

function resolveRelativePath(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
}
