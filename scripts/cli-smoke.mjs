#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const cliPath = path.resolve("packages/cli/bin/heart.js");
const commands = [
  ["--help"],
  ["doctor"],
  ["doctor", "--json"],
  ["init", "--help"],
  ["scan", "--help"],
  ["pack", "--help"],
  ["mcp", "tools"],
  ["mcp", "tools", "--json"],
  ["mcp", "serve", "--help"],
  ["chat", "--help"],
  ["ide", "--help"],
  ["packs", "--help"],
];

for (const args of commands) {
  const result = spawnSync("node", [cliPath, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "true",
      NO_COLOR: "1",
    },
  });
  if (result.status !== 0) {
    console.error(`CLI smoke failed: heart ${args.join(" ")}`);
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  if (args.includes("--json")) {
    try {
      JSON.parse(result.stdout);
    } catch (error) {
      console.error(`CLI smoke expected JSON: heart ${args.join(" ")}`);
      console.error(error.message);
      process.exit(1);
    }
  }
}

console.log(`CLI smoke passed for ${commands.length} command(s).`);
