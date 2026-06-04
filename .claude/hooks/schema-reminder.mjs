#!/usr/bin/env node
// PostToolUse hook (Edit|Write): when a Drizzle schema file is edited, inject a
// reminder so the mandatory migration sequence is not skipped.
// Reads the hook payload from stdin, writes optional JSON control to stdout.

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
  /* malformed payload — nothing to do */
}

const file = (payload.tool_input?.file_path || payload.tool_response?.filePath || "")
  .replace(/\\/g, "/");

// Drizzle schemas live at app/features/<feature>/schema.ts
if (/app\/features\/[^/]+\/schema\.ts$/.test(file)) {
  const shortName = file.split("/").slice(-3).join("/");
  const reminder =
    `DB schema file changed (${shortName}). Per CLAUDE.md the migration ` +
    `sequence must NOT be skipped: 1) npm run db:generate  2) review the new ` +
    `file in sql/migrations/ for unintended drops/renames  3) npm run db:migrate ` +
    `(auto-runs db:typegen → database.types.ts). Do NOT apply schema DDL through ` +
    `the Supabase SQL Editor or raw psql.`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: reminder,
      },
      systemMessage: "⚠ schema.ts changed → run db:generate → db:migrate",
    })
  );
}

process.exit(0);
