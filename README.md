# Nudge v2

A language learning service. It sends study session links to users over Discord DM.

The service is in closed beta. Completed features include Email/Google/Discord
OAuth, study sessions, TTS, Quiz, Marathon Mode, Leni AI chat, Story Learning,
email notifications, Discord DM delivery (via n8n), and an admin dashboard.

## Stack

- React Router v7 (framework mode, SSR)
- Supabase PostgreSQL + Drizzle ORM
- Shadcn/ui + Tailwind CSS
- Vercel deployment, Cloudflare DNS
- n8n automation workflows

## Development

This repository is developed with AI assistance (Claude Code). Project
conventions and rules live in [CLAUDE.md](CLAUDE.md), which is read by both
developers and the AI agent.

Common commands:

```bash
npm run test          # run the Vitest suite
npm run db:generate   # generate a migration from schema changes
npm run db:migrate    # apply migrations (also regenerates database.types.ts)
```

### DB schema changes

Schemas are split per feature at `app/features/**/schema.ts`. Changes follow a
fixed order: edit `schema.ts` → `npm run db:generate` → `npm run db:migrate`.
Running schema DDL directly through the Supabase SQL Editor is not allowed. See
[CLAUDE.md](CLAUDE.md) for the full rules.

## AI harness (`.claude/`)

The repository includes a Claude Code configuration that encodes the project's
workflow. It is project-specific and not required to run the app.

- **Skills** (`.claude/skills/`): task workflows invoked on demand.
  - `db-change`: enforces the DB schema-change sequence.
  - `feature-start`: drives a feature through the 10-step task workflow.
  - `post-deploy`: runs the post-deploy regression checklist.
- **Agents** (`.claude/agents/`): read-only reviewers that return findings.
  - `db-migration-reviewer`: reviews a Drizzle schema change and its generated
    migration.
  - `doc-auditor`: checks `docs/core` for conflicts and stale references.
- **Hooks** (`.claude/hooks/`): scripts run on editor events.
  - `schema-reminder.mjs` (PostToolUse): reminds about the migration sequence
    when a `schema.ts` file is edited.
  - `format.mjs` (PostToolUse): formats edited files with Prettier.
  - `run-tests.mjs` (Stop): runs `npm run test` when source files changed.
- **`settings.json`**: permissions and hook registration.
- **`.mcp.json`**: a read-only Supabase MCP server (database + docs).
