# Conversation workspace verification

2026-11-07. Main experience at `/`; optional synthetic prototype at `/demo`.

## Implemented behavior

- The main entry is a conversation, with saved conversations in a quiet sidebar and a mobile navigation sheet. No dashboard or group setup precedes entry.
- A submitted message appears immediately while its reply is prepared. Conversation messages and one current draft persist privately per verified account. Provider failure preserves the message and previous draft; missing configuration is explained explicitly.
- One live preview leads to compact review. Publishing, revisions, participant responses and receipt confirmation remain explicit financial controls. AI cannot execute these operations through the conversation endpoint.
- Manual entry, saving a reviewed draft and reusing people from a previous split are available from the composer. The standalone New split route remains compatible.
- Your splits provides action/waiting/settled filters and an on-demand payment overview. Details expose correction reasons, exact shares, invitations, historical transfers, activity and revision snapshots.
- Expiring invitation destinations and `/pilot` compatibility links remain intact. Seeded data and profile switching remain under the clearly labeled demo.

## Fresh local evidence

- TypeScript check and ESLint: pass.
- Unit/API suite: 235 tests pass in 40 files. New coverage includes conversation owner scoping, replay before stale checks, provider failure, invalid draft money, rejection of financial commands through chat, unauthorized revision reads, provider-output validation and confirmed-transfer-only totals.
- Production build and ordinary end-to-end suite: 81 active browser checks pass; 21 conditional checks skipped (12 isolated-local checks run separately, 2 optional live-provider checks, 7 viewport-specific checks).
- Isolated Supabase journeys: all 12 pass, across desktop and phone. Actual OTP delivery through local captured mail, private draft reload, a second independent signed-in session, publication, unrelated-account denial, invitations, excluded items/two payers, confirmed receipt followed by a revision/overpayment, stale organizer edits and planned-response review.
- Rollback-only SQL checks pass for conversation ownership, idempotent replay, stale updates and denied direct browser writes/RPC execution.
- Rendered entry, draft and review captured at widths 320, 375, 768, 1024 and 1440. No horizontal or dialog overflow and no page errors. Keyboard review receives heading focus; Escape closes it and returns focus to Review split. Screenshots were visually inspected. Native dialogs provide modal focus containment; no screen-reader or WCAG certification is claimed.
- Browser plugin was unavailable. Repository Playwright tests and a synthetic visual script inspected the rendered product. An attempted Safari inspection failed in the computer-use service with a screen-capture error; it establishes nothing about the operator's sign-in.

Visual artifacts are synthetic and saved outside the repository in `../outputs/conversation-workspace`. They are not evidence of hosted AI success or real-user adoption.

## Database and release

The additive migration `20261107061118_conversation_workspace.sql` is applied to the dedicated hosted `splitflow-pilot` project. Its filename matches hosted migration history. Conversations and operation records have RLS enabled and browser grants revoked; only the verified server path can write. The RPC is invoker-security and checks owner and expected revision under locks. Existing financial records were not migrated or replaced.

Hosted security advisors report no new conversation-table findings. Prior service-only table policy information and the password-protection warning remain; the pilot uses email-code authentication.

## Remaining limits

The hosted preview has no OpenAI key configured. Secure connector provisioning did not complete authentication and created no key. Live provider output, provider availability/billing and hosted conversation success require a configured server-side key and a subsequent deployed check. The UI and persistence checks above do not establish these outcomes.

Private reusable groups are now available from the main composer (see the follow-up below). Shared group workspaces and demo execution traces/artifact tabs have not been promoted into main navigation. This change does not claim complete demo feature parity.

Hosted independent-participant recovery, monitoring, backup/restore and rollback rehearsal, and the five-organizer/repeat-use study remain separate pilot release gates. Internal synthetic tests are excluded from adoption counts.

## Reusable groups follow-up — 2026-11-08

OpenAI credential setup is on hold at the user's request. No key was created or configured; manual creation, saved drafts and groups remain usable independently of AI.

Groups opens a focused dialog from the composer. An organizer can save people from the current split, create or edit a private group, then reuse it in a new manual expense. Selecting a group supplies people only: it neither publishes obligations nor grants split membership. Saving and reopening a group-based draft restores its entered title and amounts. The sidebar stays focused on conversations and splits.

The verified session supplies the owner. Migration `20261107201135_reusable_groups.sql` adds owner-scoped group documents and idempotent operations; RLS is enabled, browser grants are revoked, and the service-only RPC enforces owner and expected revision under locks. It is applied to the dedicated hosted project. A lost response retries the original operation key; a stale edit requires an explicit review against the latest saved group while retaining the entered changes.

Split discovery and detail now derive next-action text and stage from one selector. Reported transfers wait for receipt confirmation, personal correction requests wait for organizer review, disputed transfers remain visible, and fully accepted plans have an Agreed filter instead of appearing settled.

Fresh validation: type checking and lint pass; 244 unit/API tests pass. The production build and ordinary browser suite pass 85 checks, with 23 conditional skips (14 local Supabase journeys run separately, 2 optional provider checks and 7 viewport-specific checks). All 14 unmocked local Supabase journeys pass on desktop and phone, including independent owner sessions, unrelated-account group denial, group-based draft save/reopen and publication. Rollback-only group SQL verifies owner isolation, denied browser access, duplicate replay and stale saves. Group dialogs were inspected at widths 320, 375, 768 and 1440 with no horizontal overflow or page errors; editor focus and Escape return to the trigger pass. These are synthetic engineering checks, not adoption evidence.

## Compact review verification — 2026-11-10

Local: 323 unit/API tests passed, 3 environment-conditional tests skipped; typecheck, lint and production build passed. Eight targeted Chromium/mobile browser tests passed, using scripted providers for deterministic regression coverage. SQL transaction tests on the pilot verified stable owner/activity resolution, legacy-thread selection, separate member identities, revoked access and browser-role denial; fixtures rolled back.

Live: the signed-in preview called the actual OpenAI provider to create a synthetic two-person plan (₩600,000; Food ₩400,000, Transport ₩200,000), then reviewed and saved a ₩30,000 allowance move (Food ₩370,000, Transport ₩230,000). No expenses or transfers were created. Reload recovered the same conversation and one saved adjustment card. Safari responsive inspection covered 320, 375, 768 and 1440 widths; pending and saved cards, collapsed sticky summary and expanded summary were inspected. This is responsive browser evidence, not physical-device testing.

Database advisor reports RLS-without-policies informational notices for server-only tables; browser privileges are revoked intentionally. The existing leaked-password-protection warning is unrelated to this email-code feature. No authentication settings were changed.
