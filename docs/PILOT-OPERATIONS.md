# Pilot operations

## Release gate

Use a dedicated Supabase project and private pilot deployment. Apply numbered migrations in order through the migration tool. Configure email codes, delivery and rate limits. Verify with independent organizer and participant accounts before inviting groups. Verify unrelated-account reads and direct database writes are denied. Record the deployment ID and migration versions for every release.

## Monitoring and privacy

Poll `/api/pilot/health` from an uptime monitor. HTTP 200 means the storage query completed. HTTP 503 means storage is unavailable or unconfigured. The response includes no expense, participant or diagnostic data. The authenticated interface shows recoverable errors. External error monitoring still needs deployment configuration. Disable request-body, URL-fragment, email and expense-description collection in monitoring and analytics. Invitation tokens stay in URL fragments until redemption and are stored as hashes in Postgres. Never attach raw database exports to public issues.

## Backup and restore rehearsal

Before the first invitation, verify the selected Supabase plan's backup retention and restoration capability. Record the agreed recovery point and recovery time. Obtain a provider backup or encrypted Postgres dump through an authorized operator. Restore the complete database, including auth identities, into a separate private project. Keep the original database online and independent.

Compare split, revision, operation, membership and invitation counts. Verify sampled latest revisions and repayment histories using synthetic or consented records. Sign in as a test organizer and participant against the restored environment and verify access, reload and a subsequent save. Run the isolated SQL checks only against a disposable validation database. Record actual restoration duration and discrepancies. Production restoration is pending until this rehearsal has passed.

## Rollback

Set `PILOT_READ_ONLY=true` in the deployment and redeploy. Confirm financial POST requests return 503 while GET requests still return existing authorized records. Preserve a backup and the incident's deployment and migration IDs. Restore the last verified pilot deployment. Leave additive tables and historical records in place. Confirm the previous application understands the stored document version before re-enabling writes. If compatibility cannot be established, keep read-only mode enabled and repair forward. After recovery, verify independent-account access, one controlled save and a reload, then disable read-only mode.

## Feedback and pilot evidence

Keep consented participant notes privately. Record organizer completion counts and assistance, task duration, corrections, participant completion, and the number of groups with another relevant outing. Record how many choose SplitFlow again. Compare manual and AI entry on equivalent tasks. Exclude internal and supervised testing from adoption counts. Carry two observed problems through issue, decision, fix, regression check, release and user retest before publishing a maintenance story. Public problem reports must use synthetic or redacted examples.

## Reproduce the isolated local journeys

Use Supabase CLI 3.0.0 with Docker. `npx --yes supabase@3.0.0 start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor` starts this repository's local-only stack on ports 55421, 55422 and 55424. Configuration uses captured test email and never delivers the synthetic test messages externally. Copy local URL and key values from `supabase status` into the ignored `.env.local` using the variable names in `.env.example`. Keep service-role values out of browser variables and terminal transcripts.

Run the app on port 3122 with `npm run dev -- --hostname 127.0.0.1 --port 3122`. Run `PILOT_LIVE_LOCAL=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3122 npx playwright test tests/e2e/pilot-local.spec.ts --project=chromium --project=mobile --workers=1`. These opt-in tests enforce the isolated localhost Supabase URL and retrieve OTP codes only from the local captured-mail API. They create synthetic accounts and records. Normal browser regression runs skip these live-local tests.

`npx --yes supabase@3.0.0 db reset --yes` erases local test records and replays all migrations. `tests/sql/pilot.sql` runs against a clean isolated database and rolls back its synthetic fixture. Run `npx --yes supabase@3.0.0 db advisors --level warn --fail-on warn` after schema changes. The service-only invitation, operation and measurement tables deliberately have no browser policies. Stop this specific stack with `supabase stop` from this checkout when finished.

## Private feedback and completion measurements

Signed-in participants can save a private problem report through the pilot. Reports include the expected and actual behavior, optional split association, verified actor ID and app version. Browser users can read their own reports. The operator reviews reports through authorized database access. Public GitHub is no longer the pilot's report entry point.

Creation measurements record actor IDs, trial IDs, server timestamps, publication and optional AI use. They have no email, title or expense-description fields. Collection failures do not block financial saves. Review missing measurements alongside observed sessions before reporting denominators. Corrections and participant responses are verifiable through revision records. Record assistance and group return use in private research notes. Repeated organizer creation alone cannot establish that a group chose the product again.

For an initial private completion summary, query `pilot_creation_measurements` grouped by `used_ai`, counting starts and non-null `published_at`, and calculating elapsed time from `published_at - started_at`. Exclude synthetic test actors and observed supervised sessions before publishing counts. Compare equivalent tasks and retain the denominator.

## SMTP provider IP authorization

Brevo may reject a valid SMTP credential with `525 5.7.1 Unauthorized IP address` when IP blocking is enabled and the hosted Auth server has not been authorized. This occurred during the first hosted confirmation-email attempt. Compare the failed Auth request time with Brevo's unauthorized-IP entry, obtain approval for the exact address, and add that address while keeping IP blocking enabled. Recheck after a hosting migration or an outbound-address change. A saved SMTP password alone does not verify delivery. Retry an actual code request and confirm receipt and sign-in before closing the incident.

## Runtime dependency validation — November 10, 2026

The maintained lockfile now selects Next and `@next/env` 15.5.28, Zod 4.6.6 and sharp 0.35.5. These address the [Next image optimizer advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw) and [Zod validation memory-exhaustion advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Zod processes submitted expense data. No app `next/image`, remote image allowlist, image upload endpoint or configured Server Action was found during the narrow reachability check; no exploit was attempted.

Frozen install, typecheck, lint, 423 unit/API tests and production build passed for the dependency patch, with three pre-existing conditional local tests skipped. The production graph audit dropped from 81 to 63 findings; it is not clean. The remaining critical proxy-addr advisory requires an Express trust-proxy configuration absent from this app; the package arrives through the legacy agents/MCP dependency tree. No MCP/Hono/Express or WebSocket server initialization was found. This assessment does not establish that every remaining advisory is unexploitable; retain normal dependency maintenance and retest the deployed journeys after dependency changes.
