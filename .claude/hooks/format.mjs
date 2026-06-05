#!/usr/bin/env node
// PostToolUse hook (Edit|Write): auto-format the edited file with the project's
// Prettier (same tool as `npm run format`). Uses the Prettier Node API so it
// works identically on Windows/macOS/Linux without shell or .cmd resolution.
// Never blocks: any error is swallowed so a formatting hiccup can't fail a turn.

import { readFileSync, writeFileSync } from "node:fs";

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
  process.exit(0);
}

const file = (payload.tool_input?.file_path || payload.tool_response?.filePath || "")
  .replace(/\\/g, "/");

if (!file || !/\.(ts|tsx|js|jsx|json|css|md|mdx)$/.test(file)) {
  process.exit(0);
}

try {
  const prettier = (await import("prettier")).default ?? (await import("prettier"));
  // Respect .prettierignore and only format files Prettier understands.
  const info = await prettier.getFileInfo(file, { resolveConfig: true });
  if (info.ignored || !info.inferredParser) process.exit(0);

  const source = readFileSync(file, "utf8");
  const config = (await prettier.resolveConfig(file)) || {};
  const formatted = await prettier.format(source, { ...config, filepath: file });

  if (formatted !== source) writeFileSync(file, formatted);
} catch {
  // formatting is best-effort — do not surface errors or block the turn
}

process.exit(0);
