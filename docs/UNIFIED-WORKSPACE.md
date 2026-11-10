# One conversation workspace

## Product behavior

The default app supports both an isolated guest sample workspace and signed-in activities through the same components and deterministic expense engine. Sample records live only in this browser; account records use verified Supabase sessions and Postgres. Signing in does not import sample records. The separate `/demo` routes and prototype UI have been removed.

Groups are shared, email-bound collections of people. Members explicitly join invitations (valid for seven days); the owner can invite, renew, rename or remove members. Leaving or removal preserves access to existing activities. Activities have explicit participants and can also exist without a group. Group membership does not expose other activities automatically.

Activities contain a conversation, multiple expense cards and one balance summary. Quick costs, planned activities and monthly recurring arrangements share the same interface. Participants can add expenses; only an expense's author can revise its allocation. Expense cards contain explanations, planned acceptance, correction requests, payment reports/references and recipient confirmation/dispute resolution. Only confirmed transfers reduce balances. Background changes require renewed review before responding.

The composer exposes Add cost, People & share, Schedule when applicable, and Repeat cost. Repeat activity reuses people and expense rules without copying obligations, acceptance or transfers. Advanced exclusions, custom amounts, integer-unit allocations and multiple payers remain in the review form. Search, personal archive and restore keep activity lists manageable. Private unfinished expense drafts autosave to the account, with local recovery retained during errors.

OpenAI setup remains on hold. Conversation messages are shared discussion; the explicit contextual controls perform the financial operations. No configured AI or hidden simulation is required to complete the workflow.

## Recurring behavior

The owner proposes a fixed or variable monthly cost with expected payer contributions, allocation, start date and due day (1–28). Every affected person must accept the current terms before fixed periods publish automatically. Each published period is a separate accepted planned expense: automation never fabricates a payment. Record actual cost to reconcile actual payer contributions before reporting repayments. Variable bills wait for the actual amount instead of generating guessed charges.

The database scheduler runs hourly, using Asia/Seoul dates and clamping a month-end start day to each month's final day. It locks each activity, avoids duplicate periods and writes its history atomically. Updated terms require fresh acceptance; stale schedule editors cannot overwrite a newer version. Pausing stops future publication. Resuming skips paused dates and begins with the next scheduled date; it does not backfill paused periods.

## Storage and recovery

`activity_records` stores shared groups/activities; `activity_operations` and `activity_revisions` preserve idempotent results and snapshots. Server operations derive the actor from a verified session. Browser table/RPC grants are revoked and RLS is enabled. The service-only commit RPC resolves the verified actor's email, checks membership, immutable owner, expected revision and replay identity in one transaction. Its fixed search path and restricted execution permit auth identity lookup without granting broad auth-table access to the service role.

`activity_drafts` is scoped to its verified owner and activity. Draft writes use expected revisions; saving never publishes an obligation. Financial operation keys survive reload. A conflicting update requires reviewing the latest state. The previous signed-in records and invitation routes remain reachable through the compatibility view; existing financial records and private conversations are not silently reinterpreted or made public.

## Operations

Migration: `20261108052559_shared_activities.sql`.

Cron job: `splitflow-recurring-periods`, hourly. Inspect `cron.job_run_details` for failures. During rollback or a read-only incident, pause the database job as well as enabling the application's read-only switch:

```sql
select cron.alter_job(job_id := (select jobid from cron.job where jobname='splitflow-recurring-periods'), active := false);
```

Resume only after checking period records and error logs; set `active := true`. Do not delete generated financial history to roll back a UI deployment. The schema is additive, so a previous UI build can be restored while new activity data stays intact.

## Verification status

Type checking, lint, 255 unit/API tests, the production build and 30 browser checks passed. Sixteen additional real local Supabase journeys passed across desktop and phone. Rollback-only SQL checks and an actual local cron rehearsal passed. The hosted migration is applied, RLS/browser grants were verified, and the hourly job is active. Advisors report informational notices for the intentionally service-only tables; the existing leaked-password-protection warning is unchanged. See the implementation ledger for detailed evidence and review fixes. Synthetic tests establish engineering behavior only. Hosted independent-participant recovery, operational restore/rollback rehearsal and real-organizer repeat-use evidence remain separate pilot release gates.
