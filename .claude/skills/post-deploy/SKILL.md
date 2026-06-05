---
name: post-deploy
description: >-
  Run nudge's post-deploy regression checklist after a Production deploy and
  record results. TRIGGER right after a Production deploy to nudge.neowithai.com,
  or when the user says "배포 후 회귀" (post-deploy regression) / "post-deploy" /
  "regression check". Walks
  sections A–H, runs the Hyper-Sync SQL health queries, and writes a results file.
---

# Post-deploy regression

Source of truth: [docs/ops/post-deploy-regression.md](../../../docs/ops/post-deploy-regression.md).
Run this **after every Production deploy**. Expected time ~35 min.

## How to run

1. **Read** `docs/ops/post-deploy-regression.md` in full — it is the live
   checklist (sections A–H plus the Hyper-Sync SQL health block) and may have
   changed since this skill was written. Always defer to that file.

2. **Walk sections A–H in order**, marking each item **Pass / Fail / Skip**.
   Most items are manual (TTS audio, browser resume, UI rendering) — guide the
   developer item by item and collect their result for each row. Do not mark an
   item Pass without an actual observation.

3. **Safety for send-paths (C-03, H-10a/b):** verify a **test-only Discord
   account + test email** is used so real users never receive DMs/emails.

4. **Hyper-Sync SQL health queries:** run the 5 queries from the doc's
   "Hyper-Sync 데이터 확인 (SQL)" (Hyper-Sync data check) block in the Supabase SQL Editor and capture
   results. Abnormal signals: query 4 ≥ 1 (failed sends), query 5 ≥ 1 (dispatch
   backlog → check cron), query 1 = 0 with traffic (save-result API failure).

5. **On Fail — apply the rollback policy** from the doc:
   - A–G fail → consider **immediate full rollback** (redeploy last stable).
   - H (Hyper-Sync) fail → **partial rollback**: comment out the 3 hyper-sync
     routes + 2 APIs in `app/routes.ts`, hotfix-redeploy. Avoid full rollback.

## Record results

Get the current date/time first (e.g. `date` / system clock), then write the
results file at:

```
docs/ops/test-results/YYYY-MM-DD-HH-deploy.md
```

Use the "결과 기록 템플릿" (results record template) from the bottom of the regression doc: deploy
timestamp + commit hash, Pass/Fail/Skip summary, Fail items, actions taken, and
the Hyper-Sync data table. Save it, then report the summary counts and any Fail
items to the developer.
