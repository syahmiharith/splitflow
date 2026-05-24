# SplitFlow

SplitFlow is an AI-assisted split agreement workspace for group expenses. It helps an organizer turn messy cost context into a structured proposal, run deterministic split math, collect participant responses, track payment claims, and decide whether it is safe to book, pay, or settle.

The product is built around one principle: the organizer does not only need math. They need agreement before someone fronts money.

## Why This Exists

Group expense tools usually start after money has already moved. SplitFlow moves the critical review earlier:

```text
Messy input
-> structured expense proposal
-> deterministic split calculation
-> participant review
-> accept / request change / opt out
-> organizer tracks blockers
-> safe settlement decision
```

AI helps draft and explain. TypeScript owns the money, state transitions, participant eligibility, payment-claim effects, and readiness decisions.

## Reviewer Demo

### Han River BBQ: Agreement Before the Organizer Fronts Money

Use this flow to evaluate the product, UI, and engineering decisions.

1. Run the app and open `/`.
2. Confirm the selected group is `Han River BBQ Crew`.
3. Open `Chat`.
4. Paste the canonical prompt below.
5. Review the proposal artifact and deterministic math.
6. Send the proposal for agreement.
7. Open `Your Share`, switch to Daniel from the sidebar profile control, and request a change.
8. Return to `Proposals` and confirm Sarah's claimed payment.
9. Check settlement readiness and the action queue.

Canonical prompt:

```text
I'm organizing a Han River BBQ for 8 people and need agreement before I front ₩128,000.

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

What this proves:

- Natural prompt to reviewable proposal.
- Item-level eligibility, including Daniel's meat exclusion.
- Deterministic itemized split and net settlement.
- Proof-aware ledger for claimed vs confirmed payments.
- Human-in-the-loop change requests.
- Readiness logic before booking, payment, or collection.

## Product Surfaces

- `/` - global dashboard and next best action across groups.
- `/groups` - recurring split contexts such as BBQ crews, housemates, trips, or subscriptions.
- `/groups/[groupId]` - group overview, readiness, response progress, and blockers.
- `/groups/[groupId]/chat` - primary AI Split Agent workspace.
- `/groups/[groupId]/proposals` - agreement records, filters, blockers, payment claims, and settlement readiness.
- `/groups/[groupId]/inbox` - participant review simulation through the selected profile.
- `/groups/[groupId]/settings` - group members and context.
- `/analytics` - lightweight recovery, response, and dispute signals.

Shortcut routes `/chat`, `/proposals`, and `/inbox` route to the canonical Han River BBQ demo group for reviewer convenience.

## Architecture Map

```text
app/
  page.tsx                         Global action dashboard
  groups/[groupId]/chat/page.tsx   AI Split Agent workspace
  groups/[groupId]/proposals/      Proposal operations and detail panel
  groups/[groupId]/inbox/page.tsx  Participant review simulation
  api/agent/route.ts               Server-only orchestrator API
  api/agent/runs/*                 Persisted workflow run and SSE event APIs

components/
  app-shell.tsx                    Desktop/sidebar and mobile shell
  bottom-nav.tsx                   Mobile primary navigation
  chat-workspace.tsx               Chat, run progress, artifacts
  workspace-detail-panel.tsx       Proposal review, ledger, actions
  readiness-widgets.tsx            Safe-to-book and action queue UI

lib/
  domain/                          Deterministic money, state, and risk logic
  parser/                          Prototype natural-language expense parser
  agents/                          Server orchestrator and agent role modules
  workflow/                        Server workflow service, run events, history
  prototype-proposals.ts           Demo proposal builders and recalculation
  prototype-persistence.ts         LocalStorage schema and migration guardrails

tests/
  unit/                            Domain, parser, persistence, agents, APIs
  api/                             Server route and workflow tests
  e2e/                             Desktop and mobile reviewer flows
```

## Deterministic Money Principle

AI may draft proposals, classify intent, summarize objections, and explain next actions. It must not be the source of truth for:

- split calculation
- rounding
- item eligibility
- net settlement
- participant response transitions
- reconfirmation requirements
- risk/readiness decisions
- final amount owed

The deterministic itemized split engine verifies the core accounting invariants:

```text
sum(total paid) == total cost
sum(fair shares) == total cost
sum(net balances) == 0
```

Positive net balance means the participant receives money. Negative net balance means the participant pays money.

## AI Boundary

OpenAI usage stays server-side through `/api/agent` and optional `@openai/agents` runtime support. The client never receives `OPENAI_API_KEY`, server-only prompts, hidden system prompts, or raw SDK internals.

Normal demo mode does not require an OpenAI key. The deterministic parser and proposal workflow still run locally. With `SPLITFLOW_USE_OPENAI_AGENTS_SDK=1` and `OPENAI_API_KEY` configured, the server orchestrator can invoke the Agents SDK while deterministic TypeScript remains authoritative for money and readiness.

## Run Locally

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

Optional live agent configuration:

```env
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5.4-mini
SPLITFLOW_USE_OPENAI_AGENTS_SDK=1
```

## Verification

Required reviewer checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Optional live SDK check:

```bash
SPLITFLOW_USE_OPENAI_AGENTS_SDK=1 RUN_LIVE_AGENT_TESTS=1 pnpm test:agent:live
```

The e2e suite covers the canonical demo, desktop/mobile layouts, proposal review, participant actions, payment-claim confirmation, route smoke, and horizontal-overflow guards.

## Prototype Boundaries

SplitFlow is intentionally scoped as a production-style MVP prototype:

- localStorage state instead of a production database
- simulated profile switching instead of real auth or invite links
- claimed/confirmed payment records instead of bank verification
- local/mock status updates instead of real notifications
- no real payment processing or billing provider

These boundaries keep the submission focused on product thinking, deterministic financial correctness, AI safety boundaries, and reviewer-visible workflow quality.

## Next Production Steps

1. Database-backed groups, proposals, and audit history.
2. Real auth, invite links, and participant identity.
3. Notification delivery for reminders and reconfirmation.
4. Multi-device sync and collaborative proposal review.
5. Immutable settlement ledger with uploaded proof.
6. Richer receipt parsing and OCR.
7. Production observability and permissioned API access.
