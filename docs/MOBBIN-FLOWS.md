# Conversation workflow refinement

Scope: shared-group chooser, new-activity setup and recurring terms in the existing conversation workspace. Financial calculations, permissions, operation retries and database schema are unchanged. OpenAI remains on hold.

## References inspected

- [Splitwise: creating a group (iOS)](https://mobbin.com/flows/48011a8d-9b9a-4a35-870f-95460cfd3795?tab=screens). The preview separates group creation, member invitations and adding expenses. Applied: start an activity from a group, open its recent conversations directly, keep membership settings collapsed. The app retains its own conversation view rather than adopting Splitwise navigation.
- [n8n: creating a project (web)](https://mobbin.com/flows/29dee4f8-0cf7-4376-bd75-bc059a342a52?tab=screens). The inspected settings screens show named member rows and roles. Used for member-row structure only; n8n is not a finance reference. Applied: editable name/email rows for ungrouped activities, joined-member checkboxes for groups, pending invitations unavailable for selection.
- [Monzo: adding a repeating payment (iOS)](https://mobbin.com/flows/5323ec24-7848-491b-91b1-8a57a054f198?tab=screens). The inspected flow selects an existing transaction before its recurrence. Applied: reuse an existing activity expense when setting monthly terms; explicit recurring review/share labels. No bank connection or payment processing was added.

## Decisions

- Group recent rows show the current person's confirmed-transfer balance for each visible activity. These are not balances for hidden activities or a whole-group total.
- New conversations keep the workflow and optional group in a compact setup dialog. The empty thread gives the owner the relevant next action. Every setup returns to that same conversation.
- Recurring terms show who still needs to accept, paused/active/variable status, and the reviewed version. Allocation details remain expanded for people who have not accepted.
- Expected contributions are presented as planned in the editor. At the command boundary they use the existing schedule-template paid schema, which requires a full payer allocation. Automatic publication still generates planned expenses; setting terms never creates a receipt or asserts an actual transfer.
- Existing recurring terms are edited from their card. The redundant composer Schedule button is hidden once terms exist.
- Shared group creation uses shared-invitation copy; the old private-group editor retains its private copy.

## Evidence

The initial browser regression exposed the schedule-template mode contract; the adapter was corrected without weakening domain validation. The sample's existing Sam acceptance is preserved. New coverage verifies joined-member selection, direct group-to-conversation navigation, recurring review/edit/pause/reload, and expense reuse without immediate publication. This is observed UI and test evidence, not measured user completion time.

Validation: 257 unit/API tests passed, including new setup regressions; production build and 34 browser checks passed; 16 real local Supabase journeys passed separately. Type checking and lint passed. The five refined surfaces were inspected at 320, 375, 768 and 1440px without horizontal overflow or page errors; schedule-dialog Escape restored focus. Hosted acceptance is checked after deployment. These checks do not replace real-user pilot or hosted independent-account acceptance.
