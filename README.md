# SplitFlow

SplitFlow is an interactive AI-assisted agreement workspace for shared costs. It is built for the moment before someone fronts money, when the real problem is not arithmetic yet. It is getting a group to agree on what is fair, what is included, who is still unsure, and whether it is safe to pay.

This prototype was built for the ShardLab Product Intern Challenge as a product-development case study, not as a static mockup. A reviewer can tap through the full loop: describe a messy shared cost, review a structured proposal, inspect deterministic split math, simulate participant responses, confirm a payment claim, and decide whether settlement is ready.

## Reviewer Quick Path

- Product moment: `Han River BBQ Crew` needs agreement before Syahmi fronts ₩128,000.
- Start route: `/`
- Primary flow: Home -> Chat -> inline agent workflow -> Proposal artifact -> Proposals -> Your Share -> Proposals
- 1-page explanation: [`docs/shardlab-product-case-study.md`](docs/shardlab-product-case-study.md)
- Local validation: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`

### 90-second reviewer script

1. Open `/` and notice the dashboard leads with blockers and next action, not vanity finance metrics.
2. Go to Chat and paste the canonical BBQ prompt below.
3. Watch the inline agent workflow stay in the transcript while the system parses, validates, calculates, and creates the proposal artifact.
4. Open the single `Proposal artifact` bundle and inspect Review, Math, Settlement, Ledger, and Warnings from one card.
5. Re-submit the same BBQ prompt and confirm the artifact list does not fill with duplicate-looking parser/math/ledger cards.
6. Send the proposal, switch to `Your Share`, and simulate a participant accepting, requesting a change, opting out, or claiming payment.
7. Return to `Proposals` and check whether the organizer can see who is blocking, what amount is safe, and what action comes next.

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

1. Chat turns the messy prompt into a persistent inline workflow and one reviewable proposal artifact bundle.
2. The workflow steps remain visible after completion, so the reviewer can see what the agent system actually did.
3. Proposal review shows itemized costs, participant shares, Daniel's meat exclusion, and Sarah's claimed payment.
4. Re-running the same prompt reuses or updates the proposal artifact instead of cluttering the chat with duplicate cards.
5. Sending the proposal moves participants into a response workflow.
6. Your Share lets a participant accept, request a change, opt out, ask why, or claim payment.
7. Proposals shows blockers, response progress, payment-claim status, and settlement readiness.

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
  chat-workspace.tsx               Chat transport, composer, paced workflow response handling
  chat/chat-messages.tsx           Inline agent workflow timeline inside the transcript
  chat/artifact-preview-grid.tsx   Single proposal artifact bundle preview
  workspace-detail-panel.tsx       Proposal review, ledger, actions
  readiness-widgets.tsx            Safe-to-book and action queue UI

lib/
  domain/                          Deterministic money, state, and risk logic
  parser/                          Prototype natural-language expense parser
  artifact-identity.ts             Stable proposal/artifact identity for idempotent demo runs
  artifact-upsert.ts               Artifact upsert behavior for repeat prompts
  agents/                          Server orchestrator and agent role modules
  workflow/                        Server workflow service, run events, history
  prototype-persistence.ts         LocalStorage schema and migration guardrails
```

## AI Tools Used

I used Codex as an AI-assisted development tool for implementation planning, code review, UI iteration, test updates, and documentation critique. It helped me move faster across product, frontend, and validation work, but I kept the product direction and engineering constraints explicit: agreement-first workflow, deterministic money logic, no fake payment verification, and no overbuilt infrastructure for a 48-hour prototype.

My role was to make the product and technical calls: choosing the Han River BBQ moment, deciding what the workflow should prove, preserving deterministic TypeScript as the source of truth for money, and rejecting directions that drifted toward generic dashboards, marketing-style pages, or AI-owned calculations. The final shape is deliberately operational: a user can act, not just admire a mockup.

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

The e2e suite covers the canonical demo, inline workflow visibility, artifact bundle dedupe, desktop/mobile layouts, proposal review, participant actions, payment-claim confirmation, route smoke, and horizontal-overflow guards.

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
