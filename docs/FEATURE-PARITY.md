# Main experience and demo feature parity

Source audit: 2026-11-07, implementation baseline `9a860d7`. This is a code comparison, not a new browser or deployed acceptance run. The main experience is `/`; `/demo` supplies synthetic examples. Sharing a shell does not establish feature parity.

## Product correction

The dinner pilot defines implementation order, not a smaller long-term product. SplitFlow's main experience should retain the demo's useful coordination loop: describe or enter an expense, review exact allocations, collect responses, resolve corrections, track confirmed repayments, and return for another outing. Reusable groups are optional accelerators. Visual restraint must not remove those capabilities or hide them in a second product.

The three Home image concepts explore composition only. They are incomplete as product directions because they do not account for groups, participant work, drafting context, or history. Do not treat a selection among those images as approval to cut those features.

## Clarified interaction direction

The user's clarification is a conversation-led experience like the ChatGPT conversation model: polish and streamline the useful existing capabilities rather than expose every capability as another destination or dashboard. This supersedes dashboard-first composition and the integration order below where they conflict.

- The main entry is a conversation with a readable thread and one composer. Keep a quiet list of saved conversations/splits for return visits and a secondary optional demo entry. No KPI grid or command-center landing page is needed before starting a dinner.
- Conversation gathers missing facts and proposes changes. One current split preview summarizes the expense, payer, people and exact calculated shares. Updating a draft updates that preview; do not append several competing current proposal/artifact cards.
- Review opens focused structured details in a panel, or a full-screen view on narrow devices. Show the current revision, item rules, amounts and a concrete Publish action. Manual entry remains an accessible alternative within this workflow when AI is unavailable or unwanted.
- Participants arriving through an invitation open their own share and decision directly. They do not have to start a conversation, choose a group or navigate an organizer dashboard to respond.
- Corrections and payment requests appear in context as actionable records. A sentence in a chat must not itself confirm receipt or publish a financial change. Explicit server-authorized controls commit the reviewed revision or receipt; only confirmed transfers change outstanding balances.
- Detailed allocations, revision comparisons, receipts and activity are available from the split preview when needed. Groups supply reusable people/context without compulsory setup. Recovery insights can be requested/opened when useful rather than occupying permanent chrome.
- Remove user-facing agent-role terminology, six-step workflow theatrics and the artificial 2.8-second minimum delay. Show actual loading/error feedback. Do not imply a message can perform an operation until its typed server operation exists.
- Preserve conversations and drafts under account authorization so returning to a dinner restores the context, current revision and repayment state. Demo and real accounts should share interaction patterns while keeping data and simulation controls isolated.

The existing demo chat is a starting point, not the final composition: `ChatWorkspace` currently renders `ChatThread`, `DecisionSummaryCard`, `ArtifactPreviewGroup` and a persistent `WorkspaceDetailPanel`; `ChatThread` also expands agent workflow messages. Consolidate these overlapping presentations around the conversation and current preview.

Implementation sequence for this direction: establish the shared conversation/preview/review interaction; connect authorized durable conversation and draft storage plus existing real split operations; bring the remaining useful group, history and allocation capabilities into that interaction progressively. Validate the whole describe → clarify → review → publish → participant response → correction → confirmed receipt → return loop. Do not replace missing persistence with demo state.

## Verified source differences

| Capability | Demo | Signed-in main experience | Required integration |
| --- | --- | --- | --- |
| Manual one-off dinner | Proposal-oriented workflow | Equal dinner with title, people, total and payer | Preserve direct creation without mandatory group setup. |
| Natural-language drafting | Conversational thread, proposal artifacts, follow-up context | One description field; draft endpoint only accepts equal splits and marks drafts already paid | Bring useful drafting and clarification into the same reviewed expense; retain text and manual recovery. Map supported item rules explicitly through deterministic validation. |
| Reusable groups | Create/edit groups, membership context, group navigation and overview | No reusable group entity or group view in the pilot model | Persist authorized groups and reuse members; a standalone dinner remains valid. Do not infer account membership from display names. |
| Organizer action queue | Prioritized actions, response progress, blockers and active workflows | Shared next-action text exists per split, but no aggregated action queue | Show corrections, receipt confirmations and unanswered planned responses with direct links and counts derived from the same state as detail. |
| Participant review | Dedicated Your Share surface with item inclusion and guided reasons | Correct account can see share/items, accept/decline planned participation and request correction within a long detail view | Reuse the focused review structure with session-derived identity; keep profile switching in demo only. |
| Allocation depth | Equal, custom, unit-based and mixed item model | Equal/custom item amounts, exclusions and multiple payer contributions supported manually; no unit-based field | Retain supported dinner/outing allocations and show their rules clearly. Any added unit-based rule must produce exact integer-won allocations and reconcile payer totals. |
| Proposal discovery | Filters for workflow states, response/readiness summaries | Unfiltered cards for available splits | Add meaningful Needs action / Waiting / Settled discovery from authoritative state, rather than inventing statuses or using decorative badges. |
| Draft lifecycle | Draft proposals and staged review artifacts | New expense remains component state until publishing; no save/resume draft UI | Persist organizer-private drafts separately from published participant obligations; resume before publishing. |
| Corrections and revisions | Change-request actions, version history and review panels | Server revisions and stale-write protection exist; editor previews old/new shares, but no history browser and correction reason is not displayed with participant rows | Surface the actual correction, revision reason, affected amounts and agreement changes; let the organizer resolve the request through a reviewed revision. |
| Repayment ledger | Claims, confirmation/dispute, notes/reference fields and ledger artifacts | Report/confirm/dispute supported; only confirmed transfers reduce balance; no reference field | Preserve recipient confirmation and historical transfers; improve named-party ledger, explanation of disputes and visible credits after revisions. Do not copy demo organizer-wide receipt authority. |
| Activity/history | Recent activity, version/artifact/run tabs | Audit records and revision snapshots persisted, not exposed as a readable timeline | Show user-relevant changes, responses and repayment history with actor/time. Agent execution traces are not required product navigation. |
| Recovery insights | Fronted/recovered/outstanding and friction summaries | Current owe/owed totals only | Derive recovery information from authorized real records. Distinguish confirmed receipts from claims and repayment income from reimbursement of one's own spending. Do not label all-time results This month without timestamps/filtering. |
| Reminders | Copy actions and simulated activity | Copyable reminder and email-bound expiring invitations | Preserve external sharing; distinguish a reminder from an invitation and show actionable copy failures. Automated notifications remain deferred. |
| Real accounts and recovery | Seeded identities and prototype persistence | Supabase authentication, memberships, invitations, revision/idempotency guards and interrupted-save retry | Use the real operations for all promoted features; do not mount the demo store as a signed-in backend. |

## Integration order

1. Restore the coordination experience around existing real data: action queue and filtered split list, focused participant review, readable correction reasons, repayment ledger, activity and recovery summaries. Preserve manual creation and compact review. Use shared selectors for dashboard/detail consistency.
2. Implement organizer-private draft/resume and group/member persistence with server/database authorization. Group selection can prefill a new expense but cannot grant split access or change a published allocation.
3. Connect conversational drafting and useful draft artifacts to those same drafts and groups. Reuse existing parsing/domain components where compatible; validate every conversion into the persisted expense schema. Do not silently discard exclusions, custom allocations, payer information or planned-expense mode.
4. Integrate readable revision comparison/history and the remaining supported allocation rules. Keep confirmed repayments as history when a revision changes shares, including any credit.

Carry the visual system through all these surfaces. Navigation should reveal real supported destinations; advanced controls remain discoverable. The optional demo should exercise the same product capabilities using isolated synthetic fixtures, with simulation-only controls explicitly labeled.

## Scope and acceptance

KRW dinners and outings remain the pilot scope. Subscriptions, receipt scanning, other currencies, automated notifications and payment processing remain deferred. Demo categories or agent traces do not override that scope. Feature parity means useful behavior backed by real authorized records, not a copied menu or identical marketing metrics.

For each promoted capability, verify two independent signed-in sessions, actor and role boundaries, reload/resume, empty/error/loading states and desktop/tablet/phone/keyboard use. Exercise planned acceptance, excluded items/two payers, correction and revision after a confirmed receipt. No history or analytics page may expose another account's data. Run the required code/test/build checks on the eventual implementation; this audit alone establishes none of those release outcomes.

## Source map

- Main: `components/split-workspace.tsx`, `components/pilot-expense-form.tsx`, `lib/pilot/model.ts`, `lib/pilot/next-action.ts`, `app/api/pilot/draft/route.ts`, pilot migrations.
- Demo: `app/demo/page.tsx`, `app/demo/groups/page.tsx`, `app/demo/groups/[groupId]/inbox/page.tsx`, `app/demo/groups/[groupId]/proposals/page.tsx`, `app/demo/analytics/page.tsx`, `components/chat-workspace.tsx`, `components/workspace-detail-panel.tsx`, `lib/analytics.ts`, `lib/types.ts`.

## Implementation follow-through

The subsequent conversation-first implementation is recorded in `CONVERSATION-VERIFICATION.md`. Saved conversations/drafts, a single split preview, compact review, filtered split discovery, correction reasons, readable history, payment overview and reuse of previous participants now exist in the main app. OpenAI credential setup is on hold at the user's request. Private reusable group creation, editing and reuse now live in the main composer with owner isolation, revision checks and replay recovery. Shared group workspaces remain a gap; this audit's original table describes the baseline rather than the final implementation.
