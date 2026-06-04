#!/usr/bin/env node
// Stop hook: when Claude finishes a turn, run `npm run test` ONLY if tracked
// source files changed since the last commit. On failure, feed the output back
// to Claude (decision: block) so it keeps working instead of stopping with a
// broken suite. Guards against infinite loops via stop_hook_active.

import { execSync, spawnSync } from "node:child_process";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

const raw = await readStdin();
let payload = {};
try {
  payload = JSON.parse(raw || "{}");
} catch {
  /* ignore */
}

// If this Stop was already triggered by a previous block from this hook, do not
// block again — otherwise a persistently failing suite loops forever.
if (payload.stop_hook_active) process.exit(0);

// Detect whether any source file changed (staged, unstaged, or untracked).
let porcelain = "";
try {
  porcelain = execSync("git status --porcelain", { encoding: "utf8" });
} catch {
  process.exit(0); // not a git repo / git unavailable — skip silently
}

const codeChanged = porcelain
  .split("\n")
  .map((line) => line.slice(3).trim()) // drop the 2-char status + space prefix
  .filter(Boolean)
  .map((p) => p.replace(/\\/g, "/"))
  .some((p) => /^(app|tests)\/.*\.(ts|tsx)$/.test(p));

if (!codeChanged) process.exit(0);

// Run the suite. shell:true so Windows resolves npm.cmd.
const res = spawnSync("npm", ["run", "test"], { encoding: "utf8", shell: true });
const output = `${res.stdout || ""}${res.stderr || ""}`;

if (res.status === 0) {
  process.stdout.write(JSON.stringify({ systemMessage: "✓ npm run test passed" }));
  process.exit(0);
}

// Failing suite — keep Claude working and hand it the tail of the output.
const tail = output.split("\n").slice(-60).join("\n");
process.stdout.write(
  JSON.stringify({
    decision: "block",
    reason:
      "`npm run test` FAILED after source changes. Per CLAUDE.md, fix the " +
      "failures before finishing.\n\n--- test output (tail) ---\n" +
      tail,
  })
);
process.exit(0);
