# Unified conversation workspace implementation

User-authorized scope: one shared guest/real interface; shared groups; activities with multiple expenses; quick, planned and recurring workflows; explicit financial controls inside the conversation. OpenAI provisioning remains on hold.

## Execution ledger
- Baseline: 75d1674, existing isolated codex/real-dinner-pilot branch; clean before work.
- Task 1: financial primitives — unit allocations, payment references, dispute resolution.
- Task 2: shared group and activity membership/storage, activity expenses and conversation persistence; preserve existing records.
- Task 3: recurring terms, acceptance, scheduling, idempotent period publication, pause/change behavior.
- Task 4: unified conversation UI and isolated guest adapter; contextual expense, share, payment and activity controls.
- Task 5: migrate legacy entrypoints, remove separate demo after parity, test, review and deploy existing preview.

## Rulings
- Activities may be independent of groups. Group membership does not grant access to private activity expenses.
- An expense author controls revisions; activity coordinators do not silently rewrite another member's financial records.
- Repayments remain attached to expenses for auditable allocation; activity summaries aggregate them without silently netting across activities.
- Recurring fixed terms publish only after all affected participants accept. Variable costs require an actual amount. Automatic scheduling must be verified on deployment before claiming completion.
- Guest samples share domain logic and components but use isolated local persistence; they never write real-account records.
- Existing user authorization covers the preview branch and dedicated SplitFlow database; no main-branch merge.

## Evidence
Final verification is recorded below; the initial progress notes are historical.

## Progress — 2026-11-08
- Financial primitives implemented; new tests observed failing first, then 3 pass. Existing full unit suite passed 251 tests before the workspace API tests were added.
- Activity/group model, shared server API and guest adapter implemented. New model tests pass (4), API access/replay tests pass (5).
- Additive schema applied only to isolated local database; rollback-only SQL validates recurring consent, month boundaries, duplicate prevention and denied browser access.
- Main entrypoint now renders unified activity UI; legacy saved-record routes retained temporarily for data compatibility. Separate demo not yet deleted.
- Guest payment report/receipt/reload and real independent signed-in group/activity paths pass desktop; mobile real-session path also passes. More UI scenarios remain.
- Ruling: scheduled fixed costs publish as accepted planned obligations, not fabricated payments. Actual contributions still require recording actual cost.
- Ruling: commit_activity uses a service-only SECURITY DEFINER function with fixed public,pg_temp search_path to resolve the verified actor's email from auth.users without granting broad auth-table reads to service_role. Browser RPC execution is revoked; owner/member/CAS/replay checks remain inside the transaction.
- Work outstanding: durable private autosave; fuller group actions; recurrence cron and deployment verification; activity workflow scenarios; legacy data continuity; demo removal; full quality checks and review; deploy.

## Final implementation evidence
- Shared quick/planned/recurring activity UI implemented with group invitations/expiry/removal, private autosave, repeat activity templates, personal archive, search and contextual financial controls.
- Separate demo routes and their unused UI removed. Their obsolete route tests were replaced with unified workspace journeys; retained legacy saved-record tests explicitly enter compatibility routes.
- Fresh reviewer identified three issues: incomplete recurring consent details, stale owner schedule edits and paused-period backfill. All corrected with regression coverage; consent now shows shares/payers/rules, schedule writes require the reviewed version, and resume skips paused periods.
- Typecheck, lint and 255 unit/API tests pass. Production build and 30 browser checks pass; 16 opt-in real local Supabase journeys pass separately. Rollback-only SQL and actual cron execution pass, including repeated execution without duplicate periods.
- Production screenshots at 320/375/768/1440 show no overflow or page errors; dialog Escape returns focus. Visual inspection found the Sample label could truncate on narrow screens, so it was moved into a dedicated nonshrinking badge; the final production build and 30 browser checks passed after that change.
- Hosted migration applied as 20261108052559_shared_activities; all four new tables have RLS enabled and no browser read grant. Hourly recurring job is active. Security advisors report expected INFO for service-only tables without browser policies, plus the pre-existing password-protection warning; no password sign-in was added.
- Hosted independent synthetic auth verification could not use the non-exportable Vercel server key. The private temporary env file was removed. No OpenAI setup was attempted; public/guest hosted verification follows deployment. Do not claim fresh hosted multi-account acceptance or real-user adoption from local tests.
