# Dinner and outing pilot

## Current release status

The local implementation supports manual dinner and outing workflows, expiring email-bound invitations, session renewal, optional AI drafts, revisions and repayment reporting. A dedicated Supabase project and a deployed independent-account test remain required before real invitations. No real-use or repeat-use outcome has been collected.

## Configuration

1. Create a dedicated Supabase project in the selected organization. The connected Inventory projects are independent. Creation in the syahmiharith organization was rejected because both active free slots are occupied. Deletion of inventory-preview-isolated is awaiting exact-target confirmation.
2. Apply all numbered migrations in `supabase/migrations` in order.
3. Configure the four Supabase environment variables in `.env.example`. Use the same project for server and browser values. Keep the service role key server-only. Configure `OPENAI_API_KEY` through the existing server-only AI setup if optional drafting is enabled.
4. Configure Supabase's email template to deliver an email OTP code. Verify delivery, custom SMTP and rate limits before inviting groups.
5. Open `/pilot`. The existing seeded workspace is labeled demo data and links to the pilot.
6. Follow `docs/PILOT-OPERATIONS.md` for monitoring, read-only recovery, backup rehearsal and rollback.

## Implemented

Manual editing and review support equal splits, item exclusions, custom amounts and multiple payer contributions. Both manual entry and AI drafts use the same editable form and server-owned calculation. Optional AI drafting currently accepts equal-share drafts with identifiable payers. Complex allocations use the manual item controls. Descriptions are retained through AI failure. Recorded expenses display balances immediately. Planned participation requires explicit acceptance or decline.

Financial operations require verified sessions and joined membership. Invitations are bound to a listed participant email, expire after seven days, and are stored as hashes. A participant joins only through verified redemption. Organizer membership is created atomically with publication. The database enforces member read policies and denies browser financial writes and service-only RPC execution. The API performs server-side role checks.

Financial writes, revision snapshots, repayment history and audit entries commit atomically with expected-revision and idempotency checks. Interrupted saves retain their operation key across reload. Published participants remain fixed in this version. Revisions preview each participant's old and new share and retain transfers. The editor keeps the original expected revision through background refresh, while changed participant views require a renewed review before responses can succeed. Changed allocation, payer contribution, included-item commitment or expense mode invalidates affected responses. Confirmed receipts alone adjust remaining balances and expose credits after revisions.

Sessions persist locally and renew before expiry. Cross-tab refresh uses browser locks when available. Invalid sessions require sign-in. Expired invitations and wrong-account redemption provide recovery messages. Copyable invitations and reminders are available. Dashboard cards and selected split details use the same next-action calculation, and show exact remaining recipients. The simple form permits any single payer and moves keyboard focus to review.

## Checks

- Type checking, ESLint and production build passed.
- The full unit/API suite passed with 222 tests, including operation replay after membership revocation. Coverage includes financial invariants, verified membership, invitation errors, AI failure, session renewal, interrupted-save recovery and read-only mode.
- All three migrations replayed successfully on the isolated full Supabase stack. The local advisors reported no warnings. The initial two migrations also applied successfully to disposable Postgres 17 using synthetic auth roles. `tests/sql/pilot.sql` passed duplicate writes, stale revisions, rollback, wrong-account and expired invitations, repeated redemption and member/stranger row policies. This validates local Postgres behavior. Hosted Supabase integration remains pending.
- The final production-build browser run passed 71 checks with seven intentional skips, including eight new pilot checks across desktop and mobile. Those tests simulate the API boundary and verify manual publication/reload, wrong-account recovery, retained AI input and interrupted-save key reuse.
- The previous manual review check also passed at widths 375, 768 and 1440 with no horizontal overflow. Keyboard focus is checked at review entry. Deployed three-fixture coverage and a full screen-reader audit remain pending.

Ten additional unmocked local browser checks passed across desktop and mobile using the full Supabase Auth, captured email and REST stack. They covered email-code sign-in, bound invitations, unrelated-account denial, reload, actual refresh-token renewal, equal dinner, exclusions with two payers, repayment receipt and retained history through a revision, stale organizer drafts, renewed planned participation, private feedback and privacy-safe completion measurements. After a clean migration replay, the sign-in/publication/feedback/measurement journey passed again on both viewports. These are synthetic engineering tests, with real-user outcomes still unobserved.

A local backup/restore rehearsal also passed. Synthetic records restored into a second database with matching revision checksums and counts of one split, two revisions, two memberships and two operations. A subsequent save on the restored database created revision three. Hosted backups and auth-provider recovery still require deployment verification.

## Baseline evidence

Two independent browser contexts at the baseline `/` both loaded the same seeded organizer identity and Han River BBQ data. This identified the first blocker for real participant journeys. The initial screenshots are in the task outputs. The baseline interaction audit beyond this blocker remains incomplete.

## Remaining release gates

- Create and configure the dedicated Supabase project, email delivery and private pilot deployment.
- Verify independent organizer and participant accounts, unrelated-account rejection, reload and renewal against hosted storage.
- Exercise the equal dinner, excluded-item outing with two payers, and post-repayment revision end to end on the deployment, including concurrency and recovery.
- Finish keyboard, screen-reader labeling and focus checks across authenticated actions and phone, tablet and desktop views.
- Configure external monitoring and uptime checks, rehearse a backup restore, and test rollback. The health endpoint, read-only switch and runbook are implemented, while the deployed rehearsal remains pending.
- Use the implemented private feedback and privacy-safe creation measurements during observed pilot sessions. Collect assistance and group return-use evidence privately.
- Reusable groups remain optional future work in the signed-in pilot. Existing groups belong to the isolated demo.
- Recruit five organizers, record counts and assistance, observe relevant repeat outings, and carry two real problems through release and user retest.

## Decision gates

Ready to invite groups requires deployed technical and recovery checks to pass. Used successfully requires four of five organizers completing without assistance. Chosen again requires three groups choosing SplitFlow for another outing. Keep denominators and exclude internal testing. Publish a case study only from observed and consented evidence.
