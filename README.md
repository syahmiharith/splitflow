# SplitFlow

SplitFlow is an interactive AI-assisted agreement workspace for shared costs. It is built for the moment before someone fronts money, when the real problem is not arithmetic yet. It is getting a group to agree on what is fair, what is included, who is still unsure, and whether it is safe to pay.

This prototype was built for the ShardLab Product Intern Challenge as a product-development case study, not as a static mockup. A reviewer can tap through the full loop: describe a messy shared cost, review a structured proposal, inspect deterministic split math, simulate participant responses, confirm a payment claim, and decide whether settlement is ready.

## Reviewer Quick Path

- Product moment: `Han River BBQ Crew` needs agreement before Syahmi fronts ₩128,000.
- Start route: `/`
- Primary flow: Home -> Chat -> Proposal artifact -> Proposals -> Your Share -> Proposals
- 1-page explanation: [`docs/shardlab-product-case-study.md`](docs/shardlab-product-case-study.md)
- Local validation: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`

## Why This Moment

I chose a Han River BBQ because it creates cost-sharing tension quickly without needing a complex financial setting:

- The organizer pays before everyone has committed.
- Food exclusions are personal and easy to mishandle.
- Prior transfers are socially sensitive because "I already paid" is not the same as confirmed money.
- One participant has a threshold where the amount may stop feeling fair.

The current workaround is usually a group chat, mental math, screenshots of transfers, and someone manually chasing friends. That works when everyone agrees instantly. It fails when someone has an exclusion, pays early, opts out, or questions the amount after the organizer has already spent money.

The emotional cost is the real product opportunity: the organizer becomes the uncomfortable debt collector, and participants may feel they are being charged for something they did not agree to.

## Working Prototype

Use this canonical prompt in Chat:

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

What to check:

1. Chat turns the messy prompt into a reviewable proposal artifact.
2. Proposal review shows itemized costs, participant shares, Daniel's meat exclusion, and Sarah's claimed payment.
3. Sending the proposal moves participants into a response workflow.
4. Your Share lets a participant accept, request a change, opt out, ask why, or claim payment.
5. Proposals shows blockers, response progress, payment-claim status, and settlement readiness.

This is intentionally a workflow prototype, not a payment app. The important behavior is that the organizer can see whether it is safe to buy, book, or collect before acting.

## Product Decisions

- SplitFlow is not another bill splitter. The product moves agreement before money is spent.
- AI accelerates messy-input intake and explanation, but deterministic TypeScript owns amounts, rounding, participant eligibility, payment-claim effects, and readiness.
- The first user is specific: a recurring group organizer who fronts money and carries social risk if the split becomes disputed.
- The prototype uses local state and simulated profiles because the challenge asks for functional interaction, not production banking, auth, or notifications.
- Mobile is first-class because group-expense coordination usually happens in chat-like contexts on phones.

## Product Surfaces

- `/` - global agreement dashboard and next best action.
- `/groups` - recurring split contexts.
- `/groups/[groupId]/chat` - AI Split Agent intake and artifact generation.
- `/groups/[groupId]/proposals` - proposal operations, blockers, claims, and readiness.
- `/groups/[groupId]/inbox` - participant review simulation through the selected profile.
- `/analytics` - lightweight recovery, response, and friction signals.

Shortcut routes `/chat`, `/proposals`, and `/inbox` route to the canonical Han River BBQ demo group for reviewer convenience.

## Architecture

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
  prototype-persistence.ts         LocalStorage schema and migration guardrails
```

## AI Tools Used

I used Codex as the main AI development partner for implementation planning, refactoring, UI iteration, test updates, and documentation critique. AI was useful for moving fast across product, frontend, and test surfaces. The hard part was not generating code. The hard part was keeping the product decision sharp: agreement-first workflow, deterministic money logic, no fake payment verification, and no overbuilt infrastructure for a 48-hour prototype.

I challenged AI-generated directions when they drifted toward generic dashboards, marketing-style pages, or AI-owned money calculations. The final shape is deliberately operational: a user can act, not just admire a mockup.

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

Normal demo mode does not require an OpenAI key. The deterministic parser and proposal workflow still run locally.

## Verification

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

These boundaries are product decisions. They keep the prototype focused on validating whether agreement-before-payment reduces social friction before investing in production infrastructure.

## Next Product Questions

1. Do organizers actually want agreement before spending, or only help collecting afterward?
2. Which moment creates the strongest pull: food exclusions, trip deposits, subscriptions, or rent?
3. Will participants respond faster when the proposal explains why they owe a specific amount?
4. What level of proof is enough for "paid" before real banking integrations exist?
5. Which readiness signal would make an organizer trust the product enough to use it for a real group?
