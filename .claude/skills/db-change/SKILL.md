---
name: db-change
description: >-
  Enforce nudge's mandatory DB schema-change sequence (edit schema.ts →
  db:generate → db:migrate). TRIGGER whenever a task adds/alters/removes a
  table, column, enum, index, or constraint, or whenever a file matching
  app/features/**/schema.ts is about to be edited. SKIP for read-only queries
  and for SQL functions/triggers (those live in sql/functions/).
---

# DB schema change — mandatory sequence

In nudge, schema changes MUST follow this exact order. Never skip a step, never
reorder. Direct SQL via the Supabase SQL Editor is **forbidden** for schema
changes (it is only used to apply files under `sql/functions/`).

## Project facts (verified)

- Schemas are **per-feature**, not a single file: `app/features/<feature>/schema.ts`
  (drizzle glob: `app/features/**/schema.ts`).
- Migrations are generated into `sql/migrations/`.
- `npm run db:migrate` triggers `postdb:migrate`, which runs `db:typegen` and
  regenerates `database.types.ts` automatically.

## Steps

1. **Edit the schema.** Modify the correct `app/features/<feature>/schema.ts`.
   - Define enum values **inline** in the schema file. Do NOT import enum values
     from `constants.ts`.
   - Match existing column/table naming and the `nv2_` table prefix.

2. **Generate the migration:**
   ```bash
   npm run db:generate
   ```
   Then **read the new file in `sql/migrations/`** and confirm the SQL matches
   the intended change (no unexpected drops/renames). A rename emitted as
   drop+add loses data — fix the schema or the migration before continuing.

3. **Apply the migration:**
   ```bash
   npm run db:migrate
   ```
   This also regenerates `database.types.ts` via `postdb:migrate`. Confirm both
   the migration applied and the types file updated.

4. **Run tests:**
   ```bash
   npm run test
   ```
   Fix any failures before reporting done.

## Guardrails

- ❌ Do NOT run schema DDL through the Supabase SQL Editor or raw `psql`.
- ❌ Do NOT hand-edit files in `sql/migrations/` to "skip" `db:generate`.
- ✅ SQL functions / triggers are the exception: manage them in `sql/functions/`
  and apply via the Supabase SQL Editor (this is the ONLY sanctioned manual SQL).
- RLS: bypass with `adminClient`; when comparing an enum column to text, cast
  with `::text` (e.g. `status::text = 'active'::text`).

## Report

State which schema file changed, the migration filename produced, that
`db:migrate` + `db:typegen` ran, and the test result.
