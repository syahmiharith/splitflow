# SplitFlow Technical Documentation

This document explains the technical design behind SplitFlow.

For the product positioning and general overview, see the main [README](../README.md).

---

## Overview

SplitFlow is a full-stack AI-powered group payment coordination system. It converts messy shared-cost prompts into structured payment proposals, then uses deterministic tool-based logic for financial calculation, participant agreement state, payment-claim handling, and readiness verification.

The current repository is a production-style MVP prototype. It uses local and mock state where production infrastructure would normally exist, but the core workflow is interactive: create a proposal from chat, review the calculation, send it for participant agreement, simulate participant responses, resolve blockers, and decide whether settlement is ready.

---

## Core Engineering Principle

AI is used for:

- Understanding messy natural language input
- Drafting structured payment proposals
- Helping users clarify ambiguous shared-cost situations
- Coordinating the agreement workflow
- Drafting or summarizing organizer-facing explanations when the optional server-side OpenAI runtime is enabled

Deterministic tools are used for:

- Split calculation
- Rounding
- Eligibility validation
- Payment claim validation
- Participant response tracking
- Readiness-to-pay checks
- Domain state transitions
- Proposal versioning and workflow event persistence

The LLM guides the workflow, but it is not the source of financial truth.

---

## Architecture

### Frontend Architecture

SplitFlow uses the Next.js App Router with TypeScript and Tailwind CSS. The primary product surfaces live under `app/`:

- `app/page.tsx` - action-first dashboard
- `app/groups/page.tsx` - recurring group contexts
- `app/groups/[groupId]/chat/page.tsx` - AI Split Agent workspace
- `app/groups/[groupId]/proposals/page.tsx` - proposal operations view
- `app/groups/[groupId]/proposals/[proposalId]/page.tsx` - proposal review/detail view
- `app/groups/[groupId]/inbox/page.tsx` - participant review simulation
- `app/analytics/page.tsx` - lightweight recovery, response, and dispute signals

Shared UI is organized in `components/`, including the app shell, mobile bottom nav, chat workspace, artifact preview grid, proposal detail panel, readiness widgets, status badges, tables, accordions, and reusable card primitives.

### Backend/API Architecture

Server-side workflow routes live in `app/api/`:

- `app/api/agent/route.ts` - server-only orchestrator API for the original agent path
- `app/api/agent/actions/route.ts` - workflow action endpoint for send, response, change, paid, and settled actions
- `app/api/agent/runs/*` - workflow run state, retry, and event APIs
- `app/api/workflow/proposals/[proposalId]/history/route.ts` - proposal history projection

These routes keep agent execution and OpenAI configuration on the server. Tests assert that public API responses do not leak `OPENAI_API_KEY` details.

### AI Orchestration Flow

The orchestration layer is split across:

- `lib/agents/orchestrator-agent.ts`
- `lib/agents/intake-agent.ts`
- `lib/agents/split-planning-agent.ts`
- `lib/agents/proposal-agent.ts`
- `lib/agents/response-tracking-agent.ts`
- `lib/agents/recalculation-agent.ts`
- `lib/agents/risk-decision-agent.ts`
- `lib/agents/recommendation-agent.ts`
- `lib/agents/openai-agents-runtime.ts`

Normal demo mode can run without a live OpenAI key through deterministic parser and workflow services. When `SPLITFLOW_USE_OPENAI_AGENTS_SDK=1` and `OPENAI_API_KEY` are configured, the server can create an optional `@openai/agents` runtime for drafting organizer-facing copy while preserving deterministic calculation and readiness rules.

### Domain Logic Layer

Domain and workflow logic is concentrated in `lib/`:

- `lib/domain/split-calculator.ts` - equal, weighted, percentage, and fixed split calculation
- `lib/domain/itemized-split-engine.ts` - item-level eligibility, paid-by accounting, rounding adjustments, net balances, and settlement instructions
- `lib/domain/proposal-state.ts` - proposal state transitions
- `lib/domain/participant-response.ts` - participant response application
- `lib/domain/risk-engine.ts` - risk assessment for proposal readiness
- `lib/readiness.ts` - readiness summaries, blockers, action queues, and participant share explanations
- `lib/workflow/workflow-service.ts` - run creation, artifact generation, proposal versions, and workflow actions
- `lib/workflow/proposal-history.ts` - proposal history projection
- `lib/artifact-identity.ts` and `lib/artifact-upsert.ts` - stable proposal artifact identity and deduplication

### Data Model

The main application model is defined in `lib/types.ts`. It includes group, participant, proposal, cost item, payment record, timeline, proposal revision, settlement instruction, artifact, chat session, agent run, proposal record, proposal version, and analytics summary types.

The older domain-specific model in `lib/domain/proposal-types.ts` supports the original orchestrator/domain tests. Current interactive surfaces use the richer model in `lib/types.ts`.

### Validation Flow

Validation is layered:

1. Natural-language expense input is parsed and normalized in `lib/parser/*`.
2. Server workflow creates proposal artifacts in `lib/workflow/workflow-service.ts`.
3. Calculation runs through deterministic domain functions.
4. Readiness checks inspect participant responses, opt-outs, change requests, claimed payments, reconfirmation needs, and settlement status.
5. UI surfaces blockers and next actions rather than treating the AI response as final authority.

### Proposal Lifecycle

The current proposal lifecycle supports:

```txt
draft
  -> sent / waiting_for_responses
  -> changes_requested / recalculation_needed / needs_reconfirmation
  -> safe_to_book
  -> booked / settling / partially_paid
  -> settled
```

Workflow actions are typed in `lib/workflow/schema.ts` and include sending a proposal, recording a participant response, accepting a change, marking a participant paid, and marking the split settled.

---

## Domain Model

Core domain concepts represented in the repo include:

- **Group** - recurring split context such as a household, trip, food crew, or subscription group.
- **Participant** - member with response status, share amount, payment status, and optional change notes.
- **Cost item** - individual expense item with amount, payer, included participants, and excluded participants.
- **Proposal** - reviewable agreement object containing costs, participants, split method, status, fairness note, recommendation, timeline, parser output, and calculation result.
- **Payment record / claim** - claimed, confirmed, disputed, or void payment note. The prototype tracks claims but does not perform bank verification.
- **Proposal revision** - versioned change summary with amount changes and reconfirmation context.
- **Artifact** - generated proposal bundle or workflow artifact with lifecycle state.
- **Readiness state** - deterministic decision about whether the proposal is ready, not ready, needs review, or settled.
- **Payment agreement** - the state reached when active participants have responded, blockers are resolved, claimed payments are addressed, and settlement can proceed.

---

## AI Workflow

```txt
User prompt
    ↓
AI or parser interpretation
    ↓
Structured proposal draft
    ↓
Tool-based validation
    ↓
Reviewable agreement state
    ↓
Participant confirmation
    ↓
Readiness-to-pay result
```

The current implementation supports this through two related paths:

- `lib/agents/orchestrator-agent.ts` runs a role-based orchestration flow for intake, split planning, deterministic calculation, proposal creation, risk decision, recommendation, and optional OpenAI-assisted organizer copy.
- `lib/workflow/workflow-service.ts` powers the interactive chat workflow, creates proposal artifacts, persists workflow run events, versions proposals, and applies user actions such as send, participant response, accepted change, paid, and settled.

The UI presents this as one main AI Split Agent, while internal roles keep the responsibilities explicit and testable.

---

## Tool-Based Verification

Deterministic verification exists in several layers:

- **Math verification:** `lib/domain/split-calculator.ts` validates participant inputs and calculates equal, weighted, percentage, and fixed splits.
- **Itemized split verification:** `lib/domain/itemized-split-engine.ts` validates item amounts, paid-by participants, included/excluded participants, fair shares, net balances, and settlement instructions.
- **Rounding verification:** `lib/domain/money.ts` and `lib/domain/itemized-split-engine.ts` normalize money and allocate rounding remainders deterministically.
- **Eligibility checks:** `lib/domain/itemized-split-engine.ts` verifies included and excluded participants per cost item.
- **Claim checks:** `lib/readiness.ts`, `lib/analytics.ts`, and `lib/workflow/workflow-service.ts` treat claimed payment records as blockers until organizer confirmation.
- **Response checks:** `lib/domain/participant-response.ts`, `lib/agents/response-tracking-agent.ts`, and `lib/workflow/workflow-service.ts` apply participant accept, opt-out, and requested-change states.
- **Readiness checks:** `lib/readiness.ts`, `lib/domain/risk-engine.ts`, and `lib/split.ts` decide whether a proposal is ready, blocked, or needs review.

---

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- OpenAI API and optional `@openai/agents` server runtime
- Vercel
- Vitest
- Playwright
- ESLint
- Zod
- pnpm
- Domain-driven TypeScript logic

---

## Testing

Available commands from `package.json`:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

The test suite includes:

- Unit tests for domain logic, parser behavior, artifact identity, artifact upsert behavior, AI schema validation, model policy, readiness, prototype persistence, proposal filters, group settings, and workflow agents.
- API tests for agent routes, workflow runs, and proposal history.
- E2E tests for the primary app flow, desktop/mobile layout behavior, proposal review, participant actions, route smoke coverage, and horizontal-overflow guards.

Optional live SDK check:

```bash
SPLITFLOW_USE_OPENAI_AGENTS_SDK=1 RUN_LIVE_AGENT_TESTS=1 pnpm test:agent:live
```

The live SDK check requires a server-side `OPENAI_API_KEY`.

---

## Local Development

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open:

```txt
http://localhost:3000
```

Optional live agent configuration:

```env
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=your_openai_model
SPLITFLOW_USE_OPENAI_AGENTS_SDK=1
```

Normal demo mode does not require an OpenAI key. The deterministic parser and proposal workflow still run locally.

Build for production:

```bash
pnpm build
```

---

## Prototype Boundaries

SplitFlow is intentionally scoped as a production-style MVP prototype:

- Local and mock state instead of a production database
- Simulated profile switching instead of real authentication or invite links
- Claimed and confirmed payment records instead of bank verification
- Local/mock status updates instead of real push notifications
- No real payment processing or billing provider

These boundaries keep the prototype focused on validating the agreement-before-payment workflow before adding production infrastructure.

---

## Key Engineering Highlights

- Separated AI interpretation from financial truth.
- Designed group payments as proposal lifecycle and readiness state, not a single calculator result.
- Built deterministic itemized split logic for eligibility, rounding, net balances, and settlement instructions.
- Modeled participant-level accept, opt-out, change-request, reconfirmation, paid, and dispute states.
- Added workflow artifacts, proposal versions, and run events so reviewers can inspect what the system did.
- Built human-in-the-loop flows for organizer review, participant review, claimed payment handling, and settlement readiness.
- Preserved a no-key demo mode while supporting optional server-side OpenAI-assisted drafting.

---

## Future Improvements

- Real database persistence
- Multi-currency support
- Receipt parsing
- Group chat integration
- Payment provider integration
- Audit trail for agreement changes
- Real-time participant collaboration
- More advanced dispute resolution
