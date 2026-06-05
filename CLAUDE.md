# Nudge v2

A language learning service. It sends study session links over Discord DM.

## Stack

- React Router v7 (framework mode, SSR)
- Supabase PostgreSQL + Drizzle ORM
- Shadcn/ui + Tailwind CSS
- Vercel deployment, Cloudflare DNS
- n8n automation workflows

---

## Document structure

```
docs/
├── core/          # Top priority: read before starting a task
│   ├── nudge-v2-design-YYYY-MM-DD.md   # Design doc (highest priority)
│   ├── *-prd.md                        # Per-feature PRD
│   ├── *-task.md                       # Per-feature task card
│   └── *-test-plan.md                  # Per-feature test plan
├── ops/           # Operations checklists
│   ├── post-deploy-regression.md       # Run after every deploy
│   └── test-results/                   # Manual TC result logs
└── archive/       # Old versions: ignore on conflict
```

### Document priority (highest first)

1. `docs/core/nudge-v2-design-YYYY-MM-DD.md` (latest version)
2. Feature PRD (`*-prd.md`)
3. Feature task (`*-task.md`)
4. This file (CLAUDE.md)
5. Archive: **ignore when it conflicts with a higher-priority doc**

When two documents conflict, follow the higher-priority one and tell the developer first.

---

## Core development rules

### DB schema changes

Never skip the order:

```
1. Edit app/features/<feature>/schema.ts  (schemas are split per feature: app/features/**/schema.ts)
2. npm run db:generate                    (migrations are generated into sql/migrations/)
3. npm run db:migrate                     (postdb:migrate regenerates db:typegen → database.types.ts automatically)
```

- Running SQL directly through the Supabase SQL Editor is **forbidden**
- SQL functions and triggers are managed in `sql/functions/`, applied only via the Supabase SQL Editor
- Enum values are defined inline in the schema file: do not import them from `constants.ts`

### Route registration

- Always **create the route file first**, then register it in `routes.ts`
- Registering in routes.ts without the file causes a React Router 7 `ENOENT` crash

### Code style

- Code comments: written in English
- Commit messages: written in English
- Unused code: comment it out, do not delete
- loader pattern: use `useLoaderData<typeof loader>()` (do not use `Route.ComponentProps`)

### Anonymous users

- Identified by `auth_user_id.startsWith('anon:')`
- Block OpenAI API calls, return a guidance message instead
- Marathon Mode: redirect to `/login?next=/products/:slug/marathon`

### RLS policy

- Bypass RLS: use `adminClient`
- A `::text` cast is required when comparing an enum column to text
  - e.g. `status::text = 'active'::text`

---

## Debugging rules

- **Tracing loader errors**: when a problem occurs, immediately add step-by-step `console.log` to first identify which query is failing. Confirm the cause before changing code on a hypothesis.
- **Throwing Supabase errors**: do not use `if (err) throw err`. Always wrap it as `throw new Error(err.message)` so the ErrorBoundary receives a recognizable Error instance.
- **`.in()` query size**: PostgREST sends `.in()` conditions as URL parameters. Dozens or more IDs exceed the URL length limit and cause `TypeError: fetch failed`. For parent-child relations (e.g. stage → cards), always use a nested select.

---

## Testing rules

### Run after every code change

```bash
npm run test
```

If tests fail, you must fix them before reporting completion.

### Criteria by test type

| Type             | Tool                      | When                                    |
| ---------------- | ------------------------- | --------------------------------------- |
| Unit test        | Vitest                    | After implementing pure logic functions |
| Integration test | Vitest + Supertest        | After implementing an API endpoint      |
| Manual TC        | Test Plan doc             | After staging deploy                    |
| Regression test  | post-deploy-regression.md | After every Production deploy           |

### Cannot be automated (manual check required)

- TTS audio playback
- Browser session resume flow
- UI rendering and layout

---

## Task workflow

Follow this order for every feature implementation:

```
1. Read docs/core/ → check the design doc and PRD
2. Confirm the approach with the developer before writing code
3. DB schema changes (if needed): schema.ts → db:generate → db:migrate
4. Create the route file before registering it in routes.ts
5. Implement the API endpoint(s)
6. Implement the UI
7. Run npm run test
8. Report completion: list which AC items were verified
9. Developer runs manual TC against the Test Plan
10. Add a changelog entry to the design doc, then commit in English
```

---

## Known Pitfalls

| Situation                    | Rule                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| TTS loop bug                 | Keep the loop state flag in a module-level variable, not a hook-internal `useRef`                    |
| CRLF files                   | Read with Python `rb` mode and explicitly convert `\r\n` → `\n`                                      |
| n8n Code node                | Return `{ json: {...} }` (no arrays); in "Run Once For Each Item" mode use `$('NodeName').item.json` |
| Supabase upsert              | Run the `nv2_subscriptions` upsert only after confirming the unique constraint                       |
| Anonymous sessions           | Auto-deleted after 7 days by the `daily-reset` cron                                                  |
| `.in()` URL overflow         | Use a nested select for parent-child relations (see Debugging rules)                                 |
| routes.ts registration order | Registering before the file exists causes an ENOENT crash: file first, registration second           |

---

## Current status

- **Service**: closed beta (7 users)
- **Major features completed**: Email/Google/Discord OAuth, study sessions, TTS, Quiz, Marathon Mode, Leni AI chat, Story Learning, email notifications, Discord DM (n8n), admin dashboard
- **In progress**: none (planning the next feature)

---

## Out of scope (do not implement without an explicit instruction)

- Payment integration (Stripe / Toss)
- KakaoTalk / Telegram notifications
- Leaderboard / multi-user comparison
- Native mobile app
- "Wrong answers only" mode (planned after PMF)
- Cross-product mixed learning (e.g. A1 + A2 mixed)
