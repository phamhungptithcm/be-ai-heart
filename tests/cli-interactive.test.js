import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import path from "node:path";

import { runCli, shouldLaunchInteractiveMode } from "../packages/cli/src/index.js";
import {
  parseInteractiveInput,
  resolveNaturalCommand,
  resolveSlashCommand,
} from "../packages/cli/src/interactive.js";
import { createTempRepoCopy } from "./helpers/temp-repo.js";

function createTtyIo(cwd) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let stdoutText = "";
  let stderrText = "";

  stdin.isTTY = true;
  stdout.isTTY = true;
  stdout.columns = 100;
  stderr.isTTY = true;
  stdout.on("data", (chunk) => {
    stdoutText += chunk.toString();
  });
  stderr.on("data", (chunk) => {
    stderrText += chunk.toString();
  });

  return {
    io: {
      cwd,
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      stdin,
      stdout,
      stderr,
    },
    stdin,
    get stdoutText() {
      return stdoutText;
    },
    get stderrText() {
      return stderrText;
    },
  };
}

test("interactive launcher only starts for TTY empty command or chat", () => {
  assert.equal(
    shouldLaunchInteractiveMode({ command: undefined, flags: {}, positional: [] }, {
      stdin: { isTTY: true },
      stdout: { isTTY: true },
      env: {},
    }),
    true,
  );
  assert.equal(
    shouldLaunchInteractiveMode({ command: undefined, flags: { json: true }, positional: [] }, {
      stdin: { isTTY: true },
      stdout: { isTTY: true },
      env: {},
    }),
    false,
  );
  assert.equal(
    shouldLaunchInteractiveMode({ command: undefined, flags: {}, positional: [] }, {
      stdin: { isTTY: false },
      stdout: { isTTY: false },
      env: {},
    }),
    false,
  );
  assert.equal(
    shouldLaunchInteractiveMode({ command: "chat", flags: {}, positional: [] }, {
      stdin: { isTTY: true },
      stdout: { isTTY: true },
      env: {},
    }),
    true,
  );
});

test("interactive command parser resolves slash and natural aliases", () => {
  assert.deepEqual(resolveSlashCommand(parseInteractiveInput('/pack "add login audit"')), {
    kind: "cli",
    args: ["pack", "add login audit"],
  });
  assert.deepEqual(resolveSlashCommand(parseInteractiveInput("/find loginUser")), {
    kind: "cli",
    args: ["find", "symbol", "loginUser"],
  });
  assert.deepEqual(resolveNaturalCommand('make context pack for "add login audit"'), {
    kind: "cli",
    args: ["pack", "add login audit"],
  });
  assert.deepEqual(resolveNaturalCommand('build a context pack for "auth refactor"'), {
    kind: "cli",
    args: ["pack", "auth refactor"],
  });
  assert.deepEqual(resolveNaturalCommand("show graph for billing"), {
    kind: "cli",
    args: ["graph"],
  });
  assert.deepEqual(resolveSlashCommand(parseInteractiveInput("/graph")), {
    kind: "cli",
    args: ["graph"],
  });
  assert.deepEqual(resolveNaturalCommand("show impact for src/auth/login.ts"), {
    kind: "cli",
    args: ["impact", "src/auth/login.ts"],
  });
  assert.deepEqual(resolveNaturalCommand("connect cursor"), {
    kind: "cli",
    args: ["connect", "install", "--client", "cursor", "--scope", "repo"],
  });
  assert.deepEqual(resolveSlashCommand(parseInteractiveInput("/packs tolling-management")), {
    kind: "cli",
    args: ["packs", "show", "tolling-management"],
  });
  assert.deepEqual(resolveSlashCommand(parseInteractiveInput("/build tolling demo kit")), {
    kind: "cli",
    args: ["packs", "build", "tolling-management", "--output", "sales-demo-kit"],
  });
  assert.deepEqual(resolveNaturalCommand("show available packs"), {
    kind: "cli",
    args: ["packs", "list"],
  });
  assert.deepEqual(resolveNaturalCommand("build tolling sales demo kit"), {
    kind: "cli",
    args: ["packs", "build", "tolling-management", "--output", "sales-demo-kit"],
  });
  assert.deepEqual(resolveNaturalCommand("use Texas regional layer"), {
    kind: "cli",
    args: ["packs", "layers", "tolling-management", "--regional", "texas"],
  });
});

test("TTY heart opens workbench and exits cleanly", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const terminal = createTtyIo(repoRoot);
  const run = runCli([], terminal.io);

  terminal.stdin.write("/help\n");
  terminal.stdin.write("/exit\n");
  terminal.stdin.end();

  const exitCode = await run;
  assert.equal(exitCode, 0);
  assert.match(terminal.stdoutText, /BeHeart/);
  assert.match(terminal.stdoutText, /repo memory workbench/);
  assert.match(terminal.stdoutText, /Slash commands/);
  assert.match(terminal.stdoutText, /BeHeart workbench/);
  assert.match(terminal.stdoutText, /Session closed/);
  assert.equal(terminal.stderrText, "");
});

test("interactive pack command bridges to existing CLI logic", async (t) => {
  const repoRoot = await createTempRepoCopy(t);
  const terminal = createTtyIo(repoRoot);
  const run = runCli([], terminal.io);

  terminal.stdin.write("/pack add login audit visibility\n");
  terminal.stdin.write("/exit\n");
  terminal.stdin.end();

  const exitCode = await run;
  assert.equal(exitCode, 0);
  assert.match(terminal.stdoutText, /Pack: ready for "add login audit visibility"/);
  assert.match(terminal.stdoutText, /Next: \/impact <path> or \/policy/);
});

test("non-TTY heart remains script safe and chat fails clearly", async () => {
  let stdout = "";
  let stderr = "";
  const io = {
    cwd: path.resolve("."),
    env: { ...process.env, CI: "true" },
    stdin: { isTTY: false },
    stdout: {
      isTTY: false,
      write: (chunk) => {
        stdout += String(chunk);
      },
    },
    stderr: {
      isTTY: false,
      write: (chunk) => {
        stderr += String(chunk);
      },
    },
  };

  assert.equal(await runCli([], io), 0);
  assert.match(stdout, /^BeHeart CLI\b/);
  assert.doesNotMatch(stdout, /^repo memory workbench$/m);

  stdout = "";
  stderr = "";
  assert.equal(await runCli(["chat"], io), 2);
  assert.equal(stdout, "");
  assert.match(stderr, /needs an interactive terminal/);
});
