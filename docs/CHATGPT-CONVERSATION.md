# Conversation implementation correction

The earlier Mobbin pass changed fields and labels but retained modal-led workflows. It did not implement the requested conversation structure. This pass supersedes that presentation.

## Conversation reference

Inspected ChatGPT web screens and intermediate steps:

- [Conversation, sidebar and composer](https://mobbin.com/screens/0729631b-f0f3-423c-8eff-5903dc2d0ca9): recent chats in the sidebar; the composer persists below the thread; the main response is not a dashboard of separate panels.
- [Empty conversation](https://mobbin.com/screens/9b4ff6b8-cf1c-4344-92c5-15bcff3e226b): centered entry composer; navigation remains available.
- [Group chat flow](https://mobbin.com/flows/e39f94e3-8451-4bf9-ad56-de9c6c28d1d6?tab=screens): a short creation step returns to the conversation, followed by one group-link invitation surface. Intermediate screens 2 and 3 were inspected in full.

## Observable implementation

| Reference decision | SplitFlow behavior | Code |
| --- | --- | --- |
| Recent conversations and groups beside the current thread | Persistent activity sidebar, selected conversation, groups and activity title in header | `components/activity/workspace.tsx` |
| Composer remains part of the conversation | Centered empty-state composer; persistent active composer; Enter sends, Shift+Enter adds a line; secondary actions under + | `components/activity/workspace.tsx` |
| Results are in the response stream | Expense cards interleave with messages by publication time; incoming messages use plain response styling | `components/activity/workspace.tsx` |
| Work returns to the same conversation | Group selection, activity creation, recurring setup, sharing and expense review render inline while the existing thread and composer remain mounted | `components/activity/dialog.tsx` (`ActivityPanel`) |
| One invitation-link surface | Single activity link and copy action; recipients disclosed on demand | `components/activity/share.tsx` |

SplitFlow adapts these structures rather than copying ChatGPT branding or pretending its controls are AI responses. The user requested finance workflows primarily inline, so even the invitation surface is inline rather than copying ChatGPT's link modal. Sign-in and the narrow-screen navigation drawer remain modal boundaries.

## Guided finance controls

Activity setup is Activity → People, with Back preserving values. Group creation is Name → Invitations → the group's invitation panel. Recurring setup is Cost → Timing → Review, using an existing cost or an explicit new amount; the advanced expense editor appears only when requested. This adapts [Monzo's transaction-selection and recurrence sequence](https://mobbin.com/flows/5323ec24-7848-491b-91b1-8a57a054f198?tab=screens) as an inline response inside the ChatGPT-referenced shell. Monthly is the supported cadence; no unsupported frequency is presented.

Financial calculators, server actors, revision checks, idempotency, invitation scope and recipient confirmation are preserved. Opening or advancing a setup step never publishes an expense or records a transfer. Only the final explicit financial action does so. OpenAI remains on hold.

## Verification

Browser coverage explicitly checks that the composer and discussion remain present during expense editing, a message does not erase the unfinished amount, share has one link action, and these workflows open no dialog. Additional journeys cover composer-led activity creation with the opening message retained, staged group creation into invitations, recurring selection/review/pause/reload, and participant acceptance.

Validation: 257 unit/API tests passed; 16 local Supabase browser checks passed with independent signed-in sessions. The production browser suite covers 40 desktop/mobile cases (16 local-Supabase cases are conditional in the default run). Rendered checks cover 11 states at 320, 375, 768 and 1440 pixels, including menu bounds, inline regions, composer presence and browser errors. A narrow-screen action-menu clipping issue and an initial activity-load input race found during this pass were corrected. Hosted verification is recorded in the release report, separately from local checks.
