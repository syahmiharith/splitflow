# SplitFlow

AI copilot for group expenses: turn messy shared costs into fair proposals, participant approvals, and settlement-ready decisions.

SplitFlow is a product prototype for a deeper version of cost splitting. It does not only calculate who owes what. It helps a group reach agreement before money creates friction.

The app lets an organizer describe a shared expense in natural language, converts it into a structured proposal, applies deterministic split logic, explains the reasoning, sends the proposal to participants for review, and tracks whether the group is ready to settle.

## Live Demo

- Production app: https://splitflow-xi.vercel.app
- Primary flow: `/chat` -> `/inbox` -> `/dashboard`

## Reviewer Quick Path

1. Open the AI Split Agent screen.
2. Review the BBQ Dinner draft proposal created from messy natural-language input.
3. Inspect the cost items, participant breakdown, fairness explanation, and agent workflow.
4. Open the participant proposal review screen.
5. Try Accept, Request change, or Opt out.
6. Return to the dashboard and confirm the response state updates.
7. Review the deterministic split logic and tests in the codebase.

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
  -> /api/ai/split-agent
  -> structured AI output validation
  -> proposal normalization
  -> deterministic split engine
  -> local proposal state
  -> organizer and participant workflows
```

OpenAI usage is server-side only. The client never receives `OPENAI_API_KEY`, server prompts, raw model responses, or sensitive environment values.

If the AI API is unavailable, the app shows an explicit unavailable state and keeps the deterministic demo workflow usable.

## Codebase Map

```text
app/
  api/ai/split-agent/   Server-side OpenAI route
  chat/                 AI Split Agent surface
  dashboard/            Organizer action dashboard
  proposals/            Proposal list
  groups/               Group contexts
  analytics/            Lightweight insights
  inbox/                Participant proposal review

components/
  app-shell.tsx         Responsive app shell
  sidebar.tsx           Desktop sidebar and mobile bottom nav
  top-header.tsx        Header for desktop and mobile
  proposal-summary-card.tsx
  breakdown-panels.tsx
  right-panel.tsx
  ui/                   Small custom UI primitives

lib/
  split.ts              Deterministic split and risk logic
  ai.ts                 AI request and output handling
  schemas.ts            Zod validation schemas
  store.tsx             Local demo state and workflow actions
  types.ts              Shared domain types
```

## Technical Stack

- Framework: Next.js App Router
- Language: TypeScript
- Styling: Tailwind CSS
- UI system: custom components
- Icons: Lucide React
- AI layer: server-side OpenAI integration
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
pnpm lint
pnpm test
pnpm test:e2e
```

## Environment Variables

Create `.env.local` for local AI usage:

```env
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.4-mini
```

`OPENAI_MODEL` is optional. The app defaults to a cost-conscious model when not configured.

Do not expose API keys in client components, rendered HTML, browser logs, screenshots, test output, or public repository files.

## Validation Coverage

Current test coverage focuses on the product boundaries that matter most:

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

The optional live AI smoke test only runs when `OPENAI_API_KEY` is configured.

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

1. Stronger deterministic split engine: item matrix, weighted splits, percentage splits, partial attendance, recurring rules, rounding reconciliation.
2. Proposal lifecycle and versioning: version history, audit trail, change comparison, reconfirmation after edits.
3. Persistence and authentication: database-backed groups, authenticated users, invite links, role-based access.
4. Notifications and collaboration: email reminders, in-app notifications, comments, organizer resolution flow.
5. Category-specific workflows: food receipt mode, travel ledger mode, subscription collection, household bills.
6. Payment integration: payment links, confirmations, transaction references, reconciliation.
7. Trust and auditability: explainable risk scoring, final confirmation, audit log, exportable proposal summary.

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
