# SplitFlow

AI copilot for group expenses: turn messy shared costs into fair proposals, participant approvals, and settlement-ready decisions.

SplitFlow is a product prototype for a deeper version of cost splitting. It does not only calculate who owes what. It helps a group reach agreement before money creates friction.

The app lets an organizer describe a shared expense in natural language, converts it into a structured proposal, applies deterministic split logic, explains the reasoning, sends the proposal to participants for review, and tracks whether the group is ready to settle.

SplitFlow is not just an AI bill splitter. It is an agreement workflow system. The AI layer helps organizers convert messy shared-cost situations into explicit participant consent, recalculated obligations, and payment-readiness decisions. Financial calculations and state transitions remain deterministic for correctness and trust.

## Live Demo

- Production app: https://splitflow-xi.vercel.app
- Primary flow: `/chat` -> `/inbox` -> `/dashboard` -> `/proposals/[id]`
- Developer workflow lab: `/agent-lab`

## Reviewer Quick Path

1. Open `/chat`.
2. Paste: `BBQ dinner for 8. I paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef.`
3. Review the draft proposal, itemized costs, deterministic calculation, net balances, and settlement plan.
4. Click `Send Proposal`.
5. Open `/inbox`, switch to Daniel, and request change with `I did not eat beef`.
6. Open `/dashboard` and confirm the change request is now prioritized.
7. Open the proposal detail page and review itemized math, response state, timeline, risk/recommendation, and settlement instructions.
8. Accept/recalculate the requested change, request reconfirmation if needed, then mark the proposal settled.
9. Refresh the page and confirm the settled proposal, itemized math, settlement plan, and timeline still render from `localStorage`.

## What This Demonstrates

SplitFlow treats shared expenses as an agreement workflow, not just arithmetic.

Most split tools answer:

```text
How much does everyone owe?
```

SplitFlow also asks:

```text
Has everyone understood, accepted, and agreed to the split?
```

That distinction matters because real group expenses often include context:

- someone paid upfront
- someone did not consume a specific item
- someone joined late
- a subscription member changed mid-cycle
- a housemate moved in partway through a bill period
- the organizer does not know whether everyone agrees

## Product Workflow

```text
Messy group expense
  -> AI-assisted intake
  -> structured proposal draft
  -> deterministic split calculation
  -> fairness explanation
  -> organizer review
  -> participant approval
  -> change request handling
  -> settlement readiness
```

The current prototype focuses on the BBQ Dinner scenario, but the product model is designed to expand across food, travel, subscriptions, bills, and shared purchases.

## Core Screens

| Screen | Purpose |
| --- | --- |
| AI Split Agent | Chat-first proposal creation with structured review cards |
| Dashboard | Action-first overview of pending responses, changes, payments, and risk |
| Proposals | List of active, draft, sent, recurring, and completed split proposals |
| Proposal Detail | Agreement record with itemized math, participant responses, settlement plan, change requests, and timeline |
| Groups | Recurring shared-expense contexts such as BBQ Crew, Housemates, trips, and subscriptions |
| Analytics | Lightweight insights about recovery, still-owed amounts, slow groups, and dispute patterns |
| Participant Review | Focused participant approval flow with amount, explanation, included items, and response actions |

## AI Boundary

AI assists with interpretation and explanation. It is not the source of truth for money.

AI may:

- interpret natural-language expense input
- draft proposal fields
- classify expense type
- explain split reasoning
- summarize participant objections
- suggest next actions

Typed deterministic application code owns:

- split calculation
- rounding
- participant eligibility
- item-level inclusion and exclusion
- payer reimbursement
- net settlement
- proposal status transitions
- reconfirmation rules
- risk and settlement-readiness checks

This boundary is intentional. SplitFlow is financial-adjacent, so money behavior must be predictable, testable, and auditable.

## Architecture

```text
User input
  -> /api/agent
  -> SplitFlow Orchestrator Agent
  -> specialized workflow agents
  -> deterministic domain services
  -> typed in-memory proposal repository
  -> structured UI response
```

OpenAI usage is server-side only. The client never receives `OPENAI_API_KEY`, server prompts, raw model responses, or sensitive environment values.

If the AI API is unavailable, the app shows an explicit unavailable state and keeps the deterministic demo workflow usable.

### Orchestrator-first design

The Orchestrator Agent is the single control point for the new workflow system. UI and API code call the orchestrator only. Specialized agents are plain workflow modules with one responsibility each:

- Intake Agent understands messy organizer input.
- Split Planning Agent chooses the split strategy.
- Proposal Agent creates the proposal explanation.
- Participant Communication Agent drafts participant-facing messages.
- Response Tracking Agent tracks accept, opt-out, and change requests.
- Recalculation Agent recomputes shares after participant changes.
- Risk Decision Agent evaluates payment or booking safety.
- Recommendation Agent decides the best next action.

The server path includes an OpenAI Agents SDK runtime using `@openai/agents`. Set both `OPENAI_API_KEY` and `SPLITFLOW_USE_OPENAI_AGENTS_SDK=1` to let the SDK-backed SplitFlow Orchestrator Agent draft organizer-facing workflow prose from deterministic proposal, risk, recommendation, and trace data. The SDK runtime is not allowed to calculate money, mutate proposal state, decide risk, or mark payment readiness.

Domain services own correctness:

- `lib/domain/money.ts`
- `lib/domain/split-calculator.ts`
- `lib/domain/itemized-split-engine.ts`
- `lib/domain/proposal-state.ts`
- `lib/domain/participant-response.ts`
- `lib/domain/risk-engine.ts`

### Itemized agreement engine

The prototype now includes a deterministic itemized split engine for realistic shared-cost workflows. It supports:

- total cost from itemized expenses
- item payer tracking
- included and excluded participants per item
- equal item-based splits
- payer reimbursement
- net balances per participant
- settlement instruction generation
- deterministic rounding adjustment records
- audit explanations for every item

The engine reconciles these invariants:

```text
sum(total paid) == total cost
sum(fair shares) == total cost
sum(net balances) == 0
```

Positive net balance means a participant should receive money. Negative net balance means they should pay money.

## Codebase Map

```text
app/
  chat/                 AI Split Agent surface
  dashboard/            Organizer action dashboard
  proposals/            Proposal list
  proposals/[id]/       Full proposal agreement record
  inbox/                Participant proposal review

components/
  demo-toolbar.tsx      Reset/demo controls for reviewer stability
  breakdown-panels.tsx Deterministic itemized math display
  proposal-summary-card.tsx
  right-panel.tsx
  ui/                   Small custom UI primitives

lib/
  domain/itemized-split-engine.ts Deterministic itemized split and settlement engine
  prototype-persistence.ts Client-side prototype persistence helpers
  prototype-proposals.ts   Demo parser, proposal builders, and recalculation glue
  store.tsx             Local demo state and workflow actions
  proposal-filters.ts   Proposal search and filter helpers
  types.ts              Shared domain types

tests/
  e2e/app.spec.ts       Reviewer flow, persistence, and proposal filter coverage
  unit/                 Math, persistence, filters, agents, and route tests
```

## Technical Stack

- Framework: Next.js App Router
- Language: TypeScript
- Styling: Tailwind CSS
- UI system: custom components
- Icons: Lucide React
- AI layer: server-side OpenAI integration
- Agent runtime: OpenAI Agents SDK for TypeScript (`@openai/agents`)
- State: local prototype state with deterministic workflow actions
- Tests: Vitest and Playwright

## Running Locally

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

Build for production:

```bash
pnpm build
```

Run checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

## Manual Agent Workflow Demo

Open `/agent-lab` locally after starting the dev server:

```bash
pnpm dev
```

Use the scenario buttons or paste one of these prompts:

- `Split a ₩480,000 Busan Airbnb between 5 people. Amir stays 1 night and everyone else stays 2 nights.`
- `Split a ₩120,000 dinner equally between 4 people.`
- `Split a ₩300,000 group gift where Aina pays ₩50,000 fixed and the rest split the remaining amount between 3 people.`

Then test:

1. Create a proposal from natural language.
2. Review calculated participant amounts.
3. Send the proposal simulation.
4. Accept for one or more participants.
5. Opt a participant out and confirm recalculation.
6. Request a change and confirm risk blocks payment readiness.
7. Inspect risk, recommendation, and agent trace.

## Manual Prototype Flow

The main reviewer flow is fully interactive and persists in browser `localStorage`.

1. Start the app with `pnpm dev`.
2. Open `/chat`.
3. Use `Load BBQ Demo` or paste the BBQ prompt from the Reviewer Quick Path.
4. Confirm the draft proposal shows itemized costs and deterministic calculation rows.
5. Click `Send Proposal`.
6. Open `/inbox`.
7. Use `Viewing as` to switch between Syahmi, Ali, Sarah, Daniel, Aiman, Amir, Aisyah, and Mina.
8. As Daniel, enter `I did not eat beef` and click `Request change`.
9. Open `/dashboard`; the change request should be the highest-priority action.
10. Open the proposal detail page.
11. Review itemized math, response statuses, change requests, timeline, settlement instructions, and AI recommendation.
12. Click `Accept requested change`, verify the settlement plan remains reconciled, then click `Mark proposal settled`.
13. Refresh the proposal detail page and verify the settled state, itemized math, and settlement plan remain visible.

Demo controls:

- `Load BBQ Demo`
- `Load Trip Demo`
- `Load Subscription Demo`
- `Reset Demo Data`

Created proposals and participant responses survive refresh until `Reset Demo Data` is used.

## Environment Variables

Create `.env.local` for local AI usage:

```env
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.4-mini
SPLITFLOW_USE_OPENAI_AGENTS_SDK=1
```

`OPENAI_MODEL` and `SPLITFLOW_USE_OPENAI_AGENTS_SDK` are optional. Without the SDK flag, `/api/agent` stays fully deterministic and still returns structured workflow responses.

Do not expose API keys in client components, rendered HTML, browser logs, screenshots, test output, or public repository files.

## Validation Coverage

Current test coverage focuses on the product boundaries that matter most:

- money normalization and deterministic rounding
- itemized split calculation, exclusions, payer reimbursement, net balances, and settlements
- equal, weighted, percentage, and fixed split behavior
- proposal state transitions and reconfirmation rules
- participant response handling
- rule-based risk assessment
- specialized agent responsibility boundaries
- orchestrator workflow integration
- `/api/agent` structured route behavior
- equal split behavior
- custom split validation
- unit-based split behavior
- opt-out recalculation
- reconfirmation logic
- safe-to-book logic
- organizer risk calculation
- AI output schema validation
- API success and failure handling
- route smoke tests
- Playwright smoke tests for app and mobile workflows
- full BBQ reviewer flow through settled state and page refresh
- proposal search and status filters

The optional live AI smoke test only runs when `OPENAI_API_KEY` is configured.

## Known Trade-offs

- The server orchestrator uses a typed in-memory repository, while the reviewer prototype persists UI proposals in browser `localStorage`.
- The parser is deterministic and intentionally narrow; it supports the BBQ demo and common phrasing, not general receipt parsing.
- The legacy `/api/ai/split-agent` route remains for compatibility, while the main chat surface uses `useChat()` with a custom transport pointed at `/api/agent`.
- Participants are simulated; there is no real auth or invite identity.
- Notifications are simulated; there are no real emails, push notifications, or reminder jobs.
- Payment collection is simulated; there is no real payment processor or settlement proof.
- There is no production database or multi-device sync.
- The timeline is useful for review but is not an immutable audit log.
- There is no OCR or general receipt import.

## Product Scope

Included in this prototype:

- AI split assistant interface
- draft proposal generation flow
- deterministic split logic foundation
- organizer proposal review
- participant proposal review
- accept, request change, and opt-out responses
- dashboard status tracking
- groups, proposals, and analytics screens
- mobile-first UI
- multi-agent workflow visualization
- risk/action queue concept

Not included:

- real payment processing
- real authentication
- real push notifications
- production database
- banking integrations
- OCR receipt scanning
- legally binding settlement flow

## Key Product Decisions

### Chat for intake, cards for review

A pure form is easier to validate but too rigid for messy real-world expense descriptions. A pure chatbot is flexible but too ambiguous for money workflows.

SplitFlow uses chat for intake and structured cards for review.

### No real payments yet

The product question is not whether money can move. It is whether the app can help people agree on what should be paid before payment happens.

Payment integration should come after the agreement workflow is mature.

### Operational UI over marketing UI

SplitFlow is intentionally not a landing page. The UI emphasizes proposal state, participant responses, next actions, risk signals, status badges, and compact dashboards.

## Roadmap

1. Proposal version history with before/after amount comparisons.
2. Richer change-request resolution and participant reconfirmation flows.
3. Generalized item parsing beyond the BBQ demo.
4. Database-backed groups and proposals.
5. Real invite links, authentication, and participant identity.
6. Notifications for reminders and requested changes.
7. Settlement proof and payment verification.
8. Immutable audit timeline for agreement and payment events.

## Why This Project Is Interesting

Most cost-splitting apps treat the problem as arithmetic.

SplitFlow treats it as coordination.

That shift changes the product:

- from calculator to workflow
- from payment request to proposal
- from private assumption to shared agreement
- from group chat chaos to structured resolution
- from AI magic to AI-assisted deterministic decision support

The project demonstrates how AI can support financial-adjacent workflows without giving it unsafe control over money logic.
