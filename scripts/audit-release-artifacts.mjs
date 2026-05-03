#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const roots = [".heart/benchmarks"];
const forbidden = [
  { label: "absolute macOS user path", pattern: /\/Users\// },
  { label: "absolute Linux home path", pattern: /\/home\// },
  { label: "absolute private temp path", pattern: /\/private\// },
  { label: "local benchmark manifest path", pattern: /local_manifest_path/ },
  { label: "OpenAI-style secret", pattern: /\bsk-[A-Za-z0-9_-]{8,}/ },
  { label: "secret-like token", pattern: /\bsk_[A-Za-z0-9_-]{8,}/ },
  { label: "bearer credential", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i },
  { label: "inline secret assignment", pattern: /\b(?:api_key|password|secret|token)=\S+/i },
];

const files = roots.flatMap((root) =>
  execFileSync("git", ["ls-files", root], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean),
);

const findings = [];
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const rule of forbidden) {
    if (rule.pattern.test(content)) {
      findings.push({ file, issue: rule.label });
    }
  }
}

if (findings.length > 0) {
  console.error("Release artifact safety audit failed.");
  for (const finding of findings.slice(0, 50)) {
    console.error(`- ${finding.file}: ${finding.issue}`);
  }
  process.exit(1);
}

console.log(`Release artifact safety audit passed for ${files.length} tracked artifact(s).`);
