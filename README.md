# SplitFlow

SplitFlow is an AI-assisted group split agreement workspace. It helps an organizer turn messy shared costs into explicit proposals, participant responses, deterministic recalculations, settlement records, and payment-readiness decisions.

Group expense friction is not only math. The hard part is getting agreement before someone pays, books, or fronts money for everyone else. SplitFlow makes that agreement visible: what was bought, who is included, who paid upfront, what each person owes or receives, which objections are unresolved, and whether settlement is ready.

SplitFlow is not just an AI bill splitter. It is an agreement workflow system. AI helps draft and explain. Deterministic TypeScript owns money, state transitions, credits, balances, and settlement correctness.

## Official Flow

- `/` is global Home across groups.
- `/groups/[groupId]` is the selected group overview and analytics surface.
- `/groups/[groupId]/chat` is the group-scoped chat workspace.
- `/groups/[groupId]/proposals` is the group proposal list with right-side detail panel.
- `/groups/[groupId]/proposals/[proposalId]` deep-links a proposal record into the same panel model.
- `/groups/[groupId]/inbox` is the simulated participant review surface for reviewer testing.
- `/groups/[groupId]/settings` manages group context.

Shortcut `/chat`, `/dashboard`, `/proposals`, and `/inbox` routes redirect into the default group. They are compatibility routes, not the canonical product flow.

If localStorage is empty, stale, or invalid, SplitFlow recreates and selects the canonical `Jeju Trip` demo group.

## Reviewer Walkthrough

1. Open `/`.
2. Create or select a group from the header switcher.
3. Open `/groups/[groupId]/chat`.
4. Enter a realistic prompt, for example:

```text
Jeju Airbnb is 570,000 won for 7 friends. Friday night is 220k, Saturday night is 260k, van rental is 90k. Alex only joins Saturday.
```

5. Watch the agent progress steps.
6. Open the parser/proposal artifact in the right panel.
7. Review detected items, participants, payers, exclusions, credits, assumptions, and deterministic math.
8. Send/create the proposal from the sticky right-panel footer.
9. Open `/groups/[groupId]/proposals`.
10. Click the proposal and inspect itemized costs, participant balances, settlement plan, timeline, and ledger records.
11. Use the sticky footer actions to accept changes, confirm credits, mark paid, or mark settled.
12. Refresh the page and confirm localStorage preserved the selected group and group-scoped state.

## Architecture Map

```text
app/
  page.tsx                         Global Home
  groups/[groupId]/page.tsx        Group overview
  groups/[groupId]/chat/page.tsx   Group chat workspace
  groups/[groupId]/proposals/      Group proposal list and detail panel
  groups/[groupId]/inbox/page.tsx  Simulated participant review
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
  demo-data.ts                     Canonical Jeju trip group and seeded artifacts
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

Top-level app state only keeps app context such as selected group, selected chat IDs, workspace panel state, simulated global notifications, and current reviewer user mode.

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
- simple previous payments like `Sarah already paid me 10,000`

Ambiguous item allocation becomes a reviewable artifact instead of a silent guess. Credits become proof-aware claimed/confirmed ledger records, not verified bank transactions.

## Simulated Boundaries

Groups are isolated in the prototype state model. Production auth, invite links, server-side authorization, and multi-device sync are intentionally out of scope for this build.

Participant switching is simulated for reviewer/demo flow. Notifications are simulated in-app indicators. Credit/proof records are local ledger records; they are not bank verification. There is no real payment processing, no payment collection, and no production database.

## Run Locally

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

Optional server-side AI configuration:

```env
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.4-mini
SPLITFLOW_USE_OPENAI_AGENTS_SDK=1
```

Without API configuration, the deterministic reviewer path still works.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

## Persistence

Prototype state is stored in browser localStorage under one canonical key from `lib/prototype-persistence.ts`. Reset Demo Data clears old known keys and restores the canonical Jeju trip group.

No production database is used.

## Known Limitations

- localStorage persistence only
- no production auth or server-side group authorization
- no real notifications
- no real payments or payment collection
- no bank/payment-provider verification
- no OCR
- pasted receipt-like text is supported, but arbitrary receipt parsing is not
- simulated agents and agent progress
- simulated participant switching
- no multi-device sync
- no immutable audit log

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
