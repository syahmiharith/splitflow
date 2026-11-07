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

Real reusable-group management remains in the demo; the main app currently reuses people from saved splits. Demo execution traces/artifact tabs have not been promoted into main navigation. This change does not claim complete demo feature parity.

Hosted independent-participant recovery, monitoring, backup/restore and rollback rehearsal, and the five-organizer/repeat-use study remain separate pilot release gates. Internal synthetic tests are excluded from adoption counts.
