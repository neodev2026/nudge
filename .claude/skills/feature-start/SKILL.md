---
name: feature-start
description: >-
  Drive a nudge feature implementation through the project's mandatory 10-step
  task workflow (read docs/core → confirm approach → schema → routes → API → UI
  → test → AC report → changelog → commit). TRIGGER when starting a new feature,
  picking up a PRD/task card, or when the user says "구현 시작 / 피처 작업"
  (start implementation / feature work) or "new feature".
---

# Feature implementation workflow

Follow CLAUDE.md's task workflow in order. Do not jump ahead to coding before
the approach is confirmed.

## 0. Scope check first

Confirm the feature is NOT in the explicit out-of-scope ("구현 범위 외") list (payments,
Kakao/Telegram, leaderboard/multi-user compare, native app, "wrong-answers-only"
mode, cross-product mixed learning). If it is, stop and flag the developer.

## Steps

1. **Read `docs/core/`** — the latest design doc
   (`nudge-v2-design-YYYY-MM-DD.md`, highest priority), then the feature PRD
   (`*-prd.md`), task card (`*-task.md`), and test plan (`*-test-plan.md`).
   If two docs conflict, follow the higher-priority one and tell the developer.

2. **Confirm the approach with the developer before writing code.** Summarize
   the plan and the acceptance criteria (AC) you intend to satisfy. Wait for
   agreement.

3. **DB schema changes (if needed)** — use the [[db-change]] flow:
   edit `app/features/<feature>/schema.ts` → `npm run db:generate` →
   `npm run db:migrate`. Never skip the order; no direct SQL Editor DDL.

4. **Create the route file BEFORE registering it** in `app/routes.ts`.
   Registering a route in `routes.ts` before the file exists crashes React
   Router 7 with ENOENT. File first, registration second.

5. **Implement the API endpoint(s).** Wrap Supabase errors:
   `throw new Error(err.message)` — never `if (err) throw err`. Use nested
   selects for parent→child relations (avoid large `.in()` → URL overflow).
   For loaders use `useLoaderData<typeof loader>()` (not `Route.ComponentProps`).

6. **Implement the UI.** Shadcn/ui + Tailwind, matching existing feature layout.

7. **Run tests:**

   ```bash
   npm run test
   ```

   Fix every failure before reporting.

8. **Report completion as an AC checklist** — list which acceptance-criteria
   items are verified (and which still need manual TC).

9. **Developer runs manual TC** against the feature Test Plan (TTS audio,
   browser resume flow, UI/layout are manual-only).

10. **Add a changelog entry** to the design doc, then commit in English.

## Conventions

- Code comments: English. Commit messages: English.
- Unused code: comment out, don't delete.
- Anonymous users (`auth_user_id` starts with `anon:`): block OpenAI calls,
  return guidance message; Marathon redirects to `/login?next=...`.
