# SplitFlow

SplitFlow is an AI-assisted split agreement workspace. It helps a group organizer turn messy shared costs into explicit proposals, participant responses, deterministic recalculations, and settlement-ready decisions.

SplitFlow is not just an AI bill splitter. It is an agreement workflow system. The AI layer helps organizers convert messy shared-cost situations into explicit participant consent, recalculated obligations, and payment-readiness decisions. Financial calculations and state transitions remain deterministic for correctness and trust.

## Current Prototype

The app is now group-first:

- `/` is global Home across all groups.
- `/groups/[groupId]` is a group overview.
- `/groups/[groupId]/chat` is the group-scoped chat workspace.
- `/groups/[groupId]/proposals` is the group proposal list with a right detail panel.
- `/groups/[groupId]/proposals/[proposalId]` opens a proposal record.
- `/groups/[groupId]/inbox` simulates participant review for that group.
- `/groups/[groupId]/settings` manages group context.

Legacy `/chat`, `/dashboard`, `/proposals`, and `/inbox` remain compatibility routes and redirect into the selected/default group. If localStorage is empty, stale, or invalid, SplitFlow automatically recreates and selects the canonical `BBQ Crew` group.

SplitFlow’s chat supports prototype-grade natural language parsing for common group-expense scenarios. The parser extracts items, participants, payers, exclusions, and credits from realistic prompts, then validates the result before handing it to the deterministic split engine. It is intentionally not a full OCR or arbitrary receipt parser yet.

## Reviewer Walkthrough

1. Open `/`.
2. Confirm `BBQ Crew` is selected in the header.
3. Open `/groups/bbq-crew/chat`.
4. Paste: `BBQ dinner for 8. I paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef.`
5. Confirm agent progress appears and proposal artifacts are created.
6. Open the proposal artifact in the right panel.
7. Click `Send proposal` from the sticky panel footer.
8. Open `/groups/bbq-crew/inbox`.
9. Switch to Daniel and request change with `I did not eat beef`.
10. Open `/`; the global Home view prioritizes the change request.
11. Open `/groups/bbq-crew/proposals/bbq-dinner`.
12. Review itemized math, participant balances, settlement plan, and timeline.
13. Click `Accept change`, then `Mark settled`.
14. Refresh; the settled state and math persist from localStorage.

You can create another group from the header switcher. Group chats, proposals, artifacts, and participant state are scoped to the selected group. Creating a fourth chat in a group removes the oldest chat; this is an explicit prototype retention limit.

## Product Principle

AI may draft, explain, classify, and recommend. It must not own money correctness.

The parser extracts structure from natural language. The deterministic split engine computes final totals, shares, rounding, balances, and settlements.

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
- risk and readiness logic

The itemized split engine reconciles:

```text
sum(total paid) == total cost
sum(fair shares) == total cost
sum(net balances) == 0
```

Positive net balance means the participant receives money. Negative net balance means the participant pays money.

## Implementation Map

```text
app/
  page.tsx                         Global Home
  groups/[groupId]/page.tsx        Group overview
  groups/[groupId]/chat/page.tsx   Group chat workspace
  groups/[groupId]/proposals/      Group proposal list/detail panel
  groups/[groupId]/inbox/page.tsx  Participant simulation
  groups/[groupId]/settings/page.tsx
  chat/, dashboard/, inbox/, proposals/  Compatibility redirects
  api/agent/route.ts               Structured orchestrator API

components/
  top-header.tsx                   Header group switcher and group creation
  sidebar.tsx                      Global Home plus selected-group workspace nav
  chat-workspace.tsx               Group chat, sessions, progress, artifacts
  workspace-detail-panel.tsx       Artifact/proposal right panel with sticky actions
  demo-toolbar.tsx                 Reset demo data

lib/
  domain/itemized-split-engine.ts  Deterministic itemized split and settlement engine
  parser/expense-parser.ts         Parser pipeline entrypoint
  parser/expense-normalizer.ts     Amounts, items, names, payers, exclusions, credits
  parser/expense-validator.ts      Total, participant, payer, and rule validation
  parser/clarification.ts          Specific clarification question generation
  prototype-proposals.ts           Demo parser, proposal builders, recalculation glue
  prototype-persistence.ts         localStorage schema, validation, fallback/reset
  demo-data.ts                     Canonical BBQ group, proposal, chats, artifacts
  store.tsx                       Group-scoped local state and workflow actions
  proposal-filters.ts             Proposal search/filter helpers
  types.ts                        Shared prototype types

tests/
  unit/                           Domain, persistence, filters, agents, route smoke
  e2e/app.spec.ts                 Group-first reviewer flow and persistence coverage
```

## AI Boundary

The main chat surface uses `useChat()` with a custom transport to `/api/agent`. OpenAI usage stays server-side. The app includes an OpenAI Agents SDK runtime through `@openai/agents`, guarded by server configuration.

Do not expose `OPENAI_API_KEY`, server prompts, raw model responses, or hidden environment values in client components, rendered HTML, logs, tests, or screenshots.

Optional local AI configuration:

```env
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.4-mini
SPLITFLOW_USE_OPENAI_AGENTS_SDK=1
```

Without API configuration, the deterministic reviewer path still works.

## Parser Scope

The parser currently handles common prototype prompts such as:

- `128000`, `128,000`, `128k`, `₩128,000`, `128,000 won`, and `128,000 KRW`
- itemized costs like `meat was 80k`, `80k for meat`, and `groceries 64,500`
- total-only prompts like `Split 100,000 won between 5 people`
- participant counts and simple named participant lists
- exclusions like `Daniel does not eat beef`, `Hakim does not drink`, and `Mira only had drinks`
- multiple payers like `Adam paid 50k upfront and I paid the rest`
- simple previous payments like `Sarah already paid me 10,000`

When the parser cannot safely create a proposal, it asks a concrete clarification question. For example, if a stated total does not match the itemized costs, it asks whether to use the stated total or the itemized total.

## Run Locally

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

Verification:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

## Demo Controls

Use `Reset Demo Data` to clear stale localStorage and restore the canonical BBQ group. Demo state is stored in browser localStorage only. There is no database.

The seeded demo includes:

- `BBQ Crew` group
- members
- one chat session
- BBQ proposal
- proposal and settlement artifacts
- Daniel's beef exclusion/change-request scenario

## Known Limitations

- localStorage persistence only
- prototype-grade deterministic parser, not OCR or a general arbitrary receipt parser
- simulated agents and agent progress
- simulated participants, no real auth
- no production database
- no real notifications
- no real payment collection
- no multi-device sync
- no immutable audit log
- no OCR or general receipt import

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
