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
