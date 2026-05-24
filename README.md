# SplitFlow

SplitFlow is an AI-assisted group split agreement workspace. It helps an organizer turn messy shared costs into explicit proposals, participant responses, deterministic recalculations, settlement records, and payment-readiness decisions.

Group expense friction is not only math. The hard part is getting agreement before someone pays, books, or fronts money for everyone else. SplitFlow makes that agreement visible: what was bought, who is included, who paid upfront, what each person owes or receives, which objections are unresolved, and whether settlement is ready.

SplitFlow is not just an AI bill splitter. It is an agreement workflow system. AI helps draft and explain. Deterministic TypeScript owns money, state transitions, credits, balances, and settlement correctness.

## Official Flow

- `/` is global Home across groups.
- `/groups/[groupId]` is the selected group overview and analytics surface.
- `/groups/[groupId]/chat` is the group-scoped chat workspace.
- `/groups/[groupId]/proposals` is the Splits page: group-scoped agreement records with blockers, response progress, claimed payments, and settlement readiness.
- `/groups/[groupId]/proposals/[proposalId]` deep-links a split record into the same panel model.
- `/groups/[groupId]/inbox` is the Your Share / Participant Review simulation page.
- `/groups/[groupId]/settings` manages group context.

Shortcut `/chat`, `/dashboard`, `/proposals`, and `/inbox` routes redirect into the default group. They are compatibility routes, not the canonical product flow.

If localStorage is empty, stale, or invalid, SplitFlow recreates and selects the canonical `Han River BBQ Crew` demo group.

## Home Command Center

Home (`/`) is the global agreement command center, not only a metrics dashboard. It summarizes blockers, waiting confirmations, unconfirmed payment claims, still-owed amounts, and settlement readiness across all groups.

The page recommends the next best action across groups so an organizer can see which split needs review, confirmation, sending, reconfirmation, settlement, or archiving before anyone fronts money. Active workflows show the group, split, status, blockers, response progress, claimed payments, and next action.

Navigation uses product language even where compatibility routes remain:

- Splits may still be served from `/groups/[groupId]/proposals`.
- Your Share may still be served from `/groups/[groupId]/inbox`.

Prototype state is localStorage persistence only. There is no production auth, payment processing, bank verification, or production database.

## Product Demo

### Han River BBQ: Agreement Before the Organizer Fronts Money

Problem: the organizer does not only need math. They need agreement before spending money.

Canonical demo prompt:

```text
I’m organizing a Han River BBQ for 8 people and need agreement before I front ₩128,000.

Estimated costs:
- meat ₩80,000
- drinks ₩20,000
- charcoal ₩10,000
- sides ₩18,000

Daniel does not eat beef, so exclude him from meat.
Sarah already sent me ₩10,000, but I need to confirm it before counting it as paid.
Ali says he may request a change if his share goes above ₩20,000.

Create a proposal I can send to the group before I buy everything.
```

Reviewer walkthrough:

1. Open `/`.
2. Select Han River BBQ Crew.
3. Open Chat.
4. Submit the canonical demo prompt.
5. Watch agent progress.
6. Open the proposal artifact.
7. Review deterministic math.
8. Send proposal.
9. Open Your Share.
10. Use the left sidebar footer profile switcher to view as Daniel and request/verify the meat exclusion.
11. Return to the proposal.
12. Confirm or dispute Sarah’s claimed payment.
13. Review settlement readiness.

What the demo proves:

- natural prompt to structured proposal
- deterministic itemized split
- exclusions
- claimed vs confirmed payments
- human-in-the-loop change handling
- settlement readiness

## Architecture Map

```text
app/
  page.tsx                         Global Home
  groups/[groupId]/page.tsx        Group overview
  groups/[groupId]/chat/page.tsx   Group chat workspace
  groups/[groupId]/proposals/      Splits page and detail panel
  groups/[groupId]/inbox/page.tsx  Your Share / Participant Review simulation
  groups/[groupId]/settings/page.tsx
  chat/, dashboard/, inbox/, proposals/  Compatibility redirects
  api/agent/route.ts               Primary structured orchestrator API
  api/ai/split-agent/route.ts      Deprecated compatibility route; product flow uses /api/agent

components/
  top-header.tsx                   Header group switcher and group creation
  sidebar.tsx                      Global Home plus selected-group workspace nav
  chat-workspace.tsx               Group chat, sessions, progress, artifacts
  workspace-detail-panel.tsx       Artifact/proposal panel with sticky actions
  demo-toolbar.tsx                 Reset demo data and demo loaders

lib/
  store.tsx                        Group-scoped local state and workflow actions
  prototype-persistence.ts         localStorage schema, migrations, validation, fallback, reset
  demo-data.ts                     Canonical Han River BBQ group and seeded artifacts
  analytics.ts                     Derived group/global analytics
  parser/*                         Prototype natural-language and receipt-text parser
  domain/itemized-split-engine.ts  Deterministic itemized split and settlement engine
  prototype-proposals.ts           Proposal builders, recalculation, allocation, credit ledger

tests/
  unit/                            Domain, parser, persistence, analytics, agents, API
  e2e/app.spec.ts                  Group-first reviewer flow
```

## State Model

Groups are the workspace boundary. Group-owned data is the source of truth:

- `groups[].proposals`
- `groups[].chats`
- `groups[].artifacts`
- proposal participant responses
- proposal payment/credit records
- proposal timeline and settlement state

Top-level app state only keeps app context such as selected group, selected chat IDs, selected view-as profiles by group, workspace panel state, simulated global notifications, and legacy reviewer user mode.

`selectedProfileByGroupId` stores the active simulated profile for each group. The left sidebar footer controls this "View as" profile, and `/groups/[groupId]/inbox` reads that group-scoped selection to render the selected participant's personal Your Share view.

Analytics are derived from group proposal state through pure helpers, not manually maintained dashboard metrics.

## Deterministic Money Principle

AI may draft, explain, classify, and recommend. It must not own money correctness.

Deterministic TypeScript owns:

- item totals
- rounding
- participant eligibility and exclusions
- fair shares
- payer reimbursement
- net balances
- settlement instructions
- proposal status transitions
- participant response updates
- credit confirmation effects
- risk/readiness signals

The itemized split engine reconciles:

```text
sum(total paid) == total cost
sum(fair shares) == total cost
sum(net balances) == 0
```

Positive net balance means the participant receives money. Negative net balance means the participant pays money.

## Parser Scope

SplitFlow’s chat supports prototype-grade natural language parsing for common group-expense scenarios. The parser extracts items, participants, payers, exclusions, and credits from realistic prompts, then validates the result before handing it to the deterministic split engine.

SplitFlow does not perform OCR in this prototype, but it supports pasted receipt-like text and natural group-expense prompts. Users can review extracted items, participants, payers, exclusions, credits, assumptions, and warnings before deterministic split calculation.

Currently supported:

- KRW formats such as `128000`, `128,000`, `128k`, `₩128,000`, `128,000 won`, and `128,000 KRW`
- itemized costs like `meat was 80k`, `80k for meat`, and `groceries 64,500`
- pasted receipt-like text with one item per line and total/subtotal detection
- total-only prompts like `Split 100,000 won between 5 people`
- participant counts and simple named participant lists
- exclusions like `Daniel does not eat beef`, `Hakim does not drink`, and `Mira only had drinks`
- multiple payers like `Adam paid 50k upfront and I paid the rest`
- simple previous payment claims like `Sarah already sent me 10,000`

Ambiguous item allocation becomes a reviewable artifact instead of a silent guess. Credits become proof-aware claimed/confirmed ledger records, not verified bank transactions.

## Simulated Boundaries

Groups are isolated in the prototype state model. Production auth, invite links, server-side authorization, and multi-device sync are intentionally out of scope for this build.

Participant review is simulated through the left sidebar footer profile switcher. Group members are the available "View as" profiles, including the organizer and participants. Production auth, invite links, server-side authorization, and multi-device sync are intentionally out of scope for this build.

`/groups/[groupId]/inbox` shows the selected participant's personal Your Share view: what they owe or receive, included/excluded items, payment claims, and next actions. If the organizer is selected, the page shows a safe preview state and asks the reviewer to choose a participant from the sidebar footer.

Credit/proof records are local ledger records; they are not bank verification. Participant-side payment actions create payment claims that need organizer confirmation. There is no real payment processing, no payment collection, and no production database.

## Splits Page

The Splits page is currently served from `/groups/[groupId]/proposals`. The route name remains for compatibility, but the product surface is Splits.

A split is an agreement record, not just a bill calculation. It combines the structured expense, deterministic share math, participant responses, change requests, claimed payment records, readiness blockers, and the organizer's next action. The organizer should be able to answer what exists in the current group, who is blocking agreement, which claimed payments need confirmation, and whether a split is ready to send, reconfirm, settle, or archive.

Split statuses:

- `draft`: organizer must review and send the split before participants can agree.
- `waiting_for_responses` / `sent`: participants have been asked to confirm, but not everyone has responded.
- `changes_requested`: at least one participant asked for a change.
- `needs_reconfirmation`: amounts changed after earlier responses, so participants need to check again.
- `safe_to_book`: deterministic readiness says the split is ready to settle.
- `settled`: organizer marked the agreement resolved.

Payment records are trust-safe prototype ledger entries. "Claimed payment" means a participant says they paid. "Confirmed by organizer" means the organizer accepted that claim inside the prototype. There is no real bank verification, payment processing, or payment collection.

## Run Locally

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

Normal prototype mode uses the deterministic parser/proposal path. It does not require an OpenAI key, and the normal e2e suite is allowed to run without live AI:

```bash
pnpm test:e2e
```

Optional server-side AI configuration for live SDK mode:

```env
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.4-mini
SPLITFLOW_USE_OPENAI_AGENTS_SDK=1
```

Without API configuration, the deterministic reviewer path still works. With `SPLITFLOW_USE_OPENAI_AGENTS_SDK=1`, `/api/agent` uses `runOrchestrator` and records safe runtime metadata:

```json
{
  "runtime": {
    "route": "/api/agent",
    "backend": "runOrchestrator",
    "openAiAgentsSdk": {
      "envFlagEnabled": true,
      "apiKeyPresent": true,
      "runtimeCreated": true,
      "attempted": true,
      "invoked": true,
      "returnedOutput": true
    }
  }
}
```

This metadata never exposes `OPENAI_API_KEY`; it only reports whether a key is present. A live SDK invocation is proven when the trace includes `run_openai_agents_sdk` and `runtime.openAiAgentsSdk.invoked === true`.

Run the live SDK e2e check with:

```bash
pnpm test:agent:live
```

That script loads `.env`, starts a local Next server, sets `RUN_LIVE_AGENT_TESTS=1` and `SPLITFLOW_USE_OPENAI_AGENTS_SDK=1`, and runs `tests/e2e/agent-live.spec.ts`.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Live SDK verification:

```bash
SPLITFLOW_USE_OPENAI_AGENTS_SDK=1 RUN_LIVE_AGENT_TESTS=1 pnpm test:agent:live
```

The SDK may draft organizer-facing prose, but deterministic TypeScript remains authoritative for totals, rounding, participant shares, risk, and readiness.

## Persistence

Prototype state is stored in browser localStorage under one canonical key from `lib/prototype-persistence.ts`. Reset Demo Data clears old known keys and restores the canonical Han River BBQ group.

No production database is used.

## Known Limitations

- localStorage only
- simulated participants
- no real auth
- no real payment or bank verification
- no production notifications
- parser is prototype-grade, not full OCR
- no multi-device sync

## Suggested Next Steps

1. Database-backed groups and proposals.
2. Real auth and invite links.
3. Real notifications and reminders.
4. Real-time collaboration for organizer and participants.
5. Proposal version history with before/after amount changes.
6. Richer change-request resolution.
7. Settlement proof and payment verification.
8. Generalized receipt and item parser.
9. Immutable audit timeline.
