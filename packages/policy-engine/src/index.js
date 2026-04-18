import path from "node:path";

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
    description: packages must not import app-layer code
  - id: services-no-app-imports
    description: services must not import app-layer code
  - id: redact-secrets-from-context
    description: do not include secrets or credentials in context artifacts
`;
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

function resolveRelativePath(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
}
