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
    const normalized = normalizePolicyDocument(parsed);

    return {
      exists: true,
      status: normalized.errors.length > 0 ? "invalid" : "loaded",
      path: policyPath,
      raw,
      errors: normalized.errors,
      rules: normalized.rules,
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      return {
        exists: true,
        status: "invalid",
        path: policyPath,
        raw: "",
        errors: [`Failed to parse policy file: ${error.message}`],
        rules: DEFAULT_POLICY_RULES,
      };
    }

    return {
      exists: false,
      status: "missing",
      path: policyPath,
      raw: "",
      errors: [],
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

export function showPolicyWarnings(policyReport = {}) {
  const violations = Array.isArray(policyReport.violations) ? policyReport.violations : [];
  return {
    schema_version: 1,
    warning_count: violations.length,
    warnings: violations.map((violation) => ({
      rule_id: violation.rule_id,
      file: violation.file,
      message: violation.message ?? `${violation.file ?? "unknown"} violates ${violation.rule_id ?? "policy"}.`,
      severity: "warning",
    })),
  };
}

function normalizePolicyRules(rules) {
  const errors = [];

  if (!Array.isArray(rules)) {
    return {
      rules: DEFAULT_POLICY_RULES,
      errors: rules === undefined ? [] : ["rules must be an array when provided."],
    };
  }

  const normalized = [];

  for (const [index, rule] of rules.entries()) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      errors.push(`policy rule at index ${index} must be an object.`);
      continue;
    }

    reportUnknownPolicyRuleKeys(rule, errors);

    if (typeof rule.id !== "string" || rule.id.trim() === "") {
      errors.push(`policy rule at index ${index} must include a non-empty id.`);
      continue;
    }

    if (rule.from_prefix !== undefined && typeof rule.from_prefix !== "string") {
      errors.push(`policy rule "${rule.id}" has invalid from_prefix.`);
      continue;
    }

    if (rule.blocked_prefix !== undefined && typeof rule.blocked_prefix !== "string") {
      errors.push(`policy rule "${rule.id}" has invalid blocked_prefix.`);
      continue;
    }

    if (rule.description !== undefined && typeof rule.description !== "string") {
      errors.push(`policy rule "${rule.id}" has invalid description.`);
      continue;
    }

    normalized.push({
      id: rule.id.trim(),
      from_prefix: typeof rule.from_prefix === "string" ? rule.from_prefix : null,
      blocked_prefix: typeof rule.blocked_prefix === "string" ? rule.blocked_prefix : null,
      description: typeof rule.description === "string" ? rule.description : "",
    });
  }

  if (normalized.length === 0) {
    return {
      rules: DEFAULT_POLICY_RULES,
      errors: [...errors, "No valid policy rules were found; falling back to defaults."],
    };
  }

  return {
    rules: normalized,
    errors,
  };
}

function normalizePolicyDocument(parsed) {
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const errors = [];
  const allowedTopLevelKeys = new Set(["rules"]);

  for (const key of Object.keys(root)) {
    if (!allowedTopLevelKeys.has(key)) {
      errors.push(`Unknown policy top-level key: ${key}`);
    }
  }

  const normalized = normalizePolicyRules(root.rules);
  return {
    rules: normalized.rules,
    errors: [...errors, ...normalized.errors],
  };
}

function reportUnknownPolicyRuleKeys(rule, errors) {
  const allowedKeys = new Set(["id", "from_prefix", "blocked_prefix", "description"]);

  for (const key of Object.keys(rule)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown policy rule key: ${key}`);
    }
  }
}

function resolveRelativePath(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
}
