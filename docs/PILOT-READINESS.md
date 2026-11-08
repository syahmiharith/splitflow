# Current workspace update

The default app now uses a unified guest/signed-in conversation for shared groups, multi-expense activities and monthly recurring costs. See [UNIFIED-WORKSPACE.md](UNIFIED-WORKSPACE.md). OpenAI setup is on hold. The earlier implementation evidence below is historical and must not be counted as verification of the new workspace.

# Conversation-first workspace update — 2026-11-07

The main `/` entry now provides account-private saved conversations, a single current split preview, optional manual entry and compact review before explicit publication. The same financial operations continue to handle invitations, responses, corrections and confirmed repayments. Your splits supplies action/waiting/settled filters and a payment overview; details expose correction reasons, activity and revision history. Manual entry can reuse people from a previous split. `/demo` retains the broader synthetic group and prototype capabilities; reusable real group management is not yet implemented.

Migration `20261107061118_conversation_workspace.sql` adds server-only conversation storage with owner checks, optimistic revisions and idempotent operation replay. It was applied to the isolated local database and the dedicated hosted SplitFlow project. It does not alter existing financial records. Drafts and messages contain private expense context and must not be included in analytics or public screenshots.

Hosted AI is not configured yet: preview metadata lists Supabase settings but no `OPENAI_API_KEY`. Connector provisioning stalled during authentication; no key was created. Configure a dedicated server-only key in SplitFlow's preview environment before claiming hosted conversational drafting works. Without it, messages are saved with a clear explanation and manual entry remains available. The ordinary tests use controlled provider responses; live provider success is a separate outstanding check.

Current evidence and final release checks are recorded in `docs/CONVERSATION-VERIFICATION.md`. The previous release notes below are historical and do not establish verification of this change.

---

# Dinner and outing pilot

## Current release status

The main workspace supports manual dinner and outing workflows, expiring email-bound invitations, session renewal, optional AI drafts, revisions and repayment reporting. The dedicated hosted database and branch-scoped preview configuration are provisioned. Preview commit `be03b98` passed CodeQL and Vercel; the deployed health endpoint returns 200 and signed-out pilot reads return 401. Custom SMTP is saved and enabled. Signup and returning-user templates send an OTP code; hosted codes retain the eight-digit default and expire after 600 seconds. The authentication site URL points to the pilot. The operator received a code and signed in successfully after the approved Brevo outbound-IP authorization. The signed-in pilot remained authenticated after a browser reload and loaded its empty split list. A deployed independent-participant test remains required before real invitations. No real-use or repeat-use outcome has been collected.

## Configuration

1. Use the dedicated `splitflow-pilot` project (`forpvfyipshzplvzjjfg`, Seoul). The redundant Inventory preview and old security project were removed with authorization; the canonical Inventory project remains independent.
2. Apply all numbered migrations in `supabase/migrations` in order. Filenames match the hosted migration history: `20261105154505`, `20261105154510`, `20261106051723`. Earlier local-only version identifiers were repaired as metadata without replaying schemas.
3. Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the same project. Legacy service-role and anon aliases remain supported. Keep the secret key server-only. Hosted values are scoped to the pilot preview branch. Configure `OPENAI_API_KEY` through the existing server-only AI setup if optional drafting is enabled.
4. Configure Supabase's email template to deliver an email OTP code. Verify delivery, custom SMTP and rate limits before inviting groups.
5. Open `/` for the main signed-in workspace. Home, split lists, manual creation, detail, invitations and repayments share the app design. The optional Try demo link opens `/demo`, with a persistent sample-data label and Exit demo action. Existing `/pilot` links preserve query strings and invitation fragments while redirecting to `/`.
6. Follow `docs/PILOT-OPERATIONS.md` for monitoring, read-only recovery, backup rehearsal and rollback.

## Implemented

Manual editing and review support equal splits, item exclusions, custom amounts and multiple payer contributions. Both manual entry and AI drafts use the same editable form and server-owned calculation. Optional AI drafting currently accepts equal-share drafts with identifiable payers. Complex allocations use the manual item controls. Descriptions are retained through AI failure. Recorded expenses display balances immediately. Planned participation requires explicit acceptance or decline.

Financial operations require verified sessions and joined membership. Invitations are bound to a listed participant email, expire after seven days, and are stored as hashes. A participant joins only through verified redemption. Organizer membership is created atomically with publication. The database enforces member read policies and denies browser financial writes and service-only RPC execution. The API performs server-side role checks.

Financial writes, revision snapshots, repayment history and audit entries commit atomically with expected-revision and idempotency checks. Interrupted saves retain their operation key across reload. Published participants remain fixed in this version. Revisions preview each participant's old and new share and retain transfers. The editor keeps the original expected revision through background refresh, while changed participant views require a renewed review before responses can succeed. Changed allocation, payer contribution, included-item commitment or expense mode invalidates affected responses. Confirmed receipts alone adjust remaining balances and expose credits after revisions.

Sessions persist locally and renew before expiry. Cross-tab refresh uses browser locks when available. Invalid sessions require sign-in. Expired invitations and wrong-account redemption provide recovery messages. Copyable invitations and reminders are available. Dashboard cards and selected split details use the same next-action calculation, and show exact remaining recipients. The simple form permits any single payer and moves keyboard focus to review.

## Checks

- Type checking, ESLint and production build passed.
- The full unit/API suite passed with 223 tests, including operation replay after membership revocation. Coverage includes financial invariants, verified membership, invitation errors, AI failure, session renewal, interrupted-save recovery and read-only mode.
- All three migrations replayed successfully on the isolated full Supabase stack. The local advisors reported no warnings. The initial two migrations also applied successfully to disposable Postgres 17 using synthetic auth roles. `tests/sql/pilot.sql` passed duplicate writes, stale revisions, rollback, wrong-account and expired invitations, repeated redemption and member/stranger row policies. This validates local Postgres behavior. All three migrations are also applied on the dedicated hosted project. Hosted independent-account journeys remain pending.
- The final production-build browser run passed 77 checks with 19 intentional skips (including ten opt-in local integration checks, which passed separately), including fourteen signed-in workspace checks across desktop and mobile. Those tests simulate the API boundary and verify manual publication/reload, wrong-account recovery, retained AI input and interrupted-save key reuse.
- The previous manual review check also passed at widths 375, 768 and 1440 with no horizontal overflow. Keyboard focus is checked at review entry. Deployed three-fixture coverage and a full screen-reader audit remain pending.

Ten additional unmocked local browser checks passed with both legacy keys and the current publishable/secret keys across desktop and mobile using the full Supabase Auth, captured email and REST stack. They covered email-code sign-in, bound invitations, unrelated-account denial, reload, actual refresh-token renewal, equal dinner, exclusions with two payers, repayment receipt and retained history through a revision, stale organizer drafts, renewed planned participation, private feedback and privacy-safe completion measurements. After a clean migration replay, the sign-in/publication/feedback/measurement journey passed again on both viewports. These are synthetic engineering tests, with real-user outcomes still unobserved.

A local backup/restore rehearsal also passed. Synthetic records restored into a second database with matching revision checksums and counts of one split, two revisions, two memberships and two operations. A subsequent save on the restored database created revision three. Hosted backups and auth-provider recovery still require deployment verification.

## Baseline evidence

Two independent browser contexts at the baseline `/` both loaded the same seeded organizer identity and Han River BBQ data. This identified the first blocker for real participant journeys. The initial screenshots are in the task outputs. The baseline interaction audit beyond this blocker remains incomplete.

## Remaining release gates

- Hosted operator email-code sign-in and reload passed. Verify a second independent participant and invitation delivery before opening the pilot to groups.
- Verify independent organizer and participant accounts, unrelated-account rejection, reload and renewal against hosted storage.
- Exercise the equal dinner, excluded-item outing with two payers, and post-repayment revision end to end on the deployment, including concurrency and recovery.
- Finish keyboard, screen-reader labeling and focus checks across authenticated actions and phone, tablet and desktop views.
- Configure external monitoring and uptime checks, rehearse a backup restore, and test rollback. The health endpoint, read-only switch and runbook are implemented, while the deployed rehearsal remains pending.
- Use the implemented private feedback and privacy-safe creation measurements during observed pilot sessions. Collect assistance and group return-use evidence privately.
- Optional private groups now persist in the signed-in composer, with create/edit/reuse and recovery checks. Shared group workspaces remain deferred. OpenAI key setup is on hold at the user's request; manual entry remains available.
- Recruit five organizers, record counts and assistance, observe relevant repeat outings, and carry two real problems through release and user retest.

## Decision gates

Ready to invite groups requires deployed technical and recovery checks to pass. Used successfully requires four of five organizers completing without assistance. Chosen again requires three groups choosing SplitFlow for another outing. Keep denominators and exclude internal testing. Publish a case study only from observed and consented evidence.

## Main workspace integration

The signed-in workflow is the default `/` entry in the app's sidebar, header, card and mobile navigation design. Home summarizes actual obligations and links to split summaries; New split, editable review, selected split details, invitations, responses and repayments stay in that workspace. The separate Dinner splits surface is retired. `/pilot` is a client compatibility redirect that preserves split queries and invitation fragments. The current session storage key and financial APIs remain unchanged.

The optional seeded experience is namespaced under `/demo`, loads its store only on demo routes, and displays a persistent sample-data label with Exit demo. All demo navigation remains namespaced. Its exit action remains reachable when the detail panel is open. Browser checks verify entering and exiting demo preserves the signed-in account without introducing sample records into Home. Root entry, split details and creation were inspected at 375, 768 and 1440 pixels; no horizontal overflow or page errors were observed, and keyboard review focuses the review heading.

Latest conversation and private-group validation is recorded in [CONVERSATION-VERIFICATION.md](CONVERSATION-VERIFICATION.md). Earlier counts above describe the original pilot baseline.
