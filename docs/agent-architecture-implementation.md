# SplitFlow Agent Architecture

SplitFlow exposes one server-side agent orchestration path: `/api/agent`.

This architecture is a product decision, not only a technical one. SplitFlow uses AI where it reduces organizer effort: parsing messy context, drafting a proposal, explaining why someone owes an amount, and summarizing blockers. It does not use AI as the authority for money. Deterministic domain services own calculation, rounding, participant eligibility, payment-claim effects, and readiness because trust is the product.

The UI presents one compact AI Split Agent. Internally, the server keeps the workflow decomposed into focused roles: intake, proposal, recalculation, response tracking, risk decision, participant communication, and recommendation.

## Current Contract

- Package manager: `pnpm`
- Main validation commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`
- Primary server route: `/api/agent`
- Workflow run routes: `/api/agent/runs/*`
- Optional live runtime: `@openai/agents` when `SPLITFLOW_USE_OPENAI_AGENTS_SDK=1` and `OPENAI_API_KEY` are configured
- Deterministic services own split math, rounding, payment-claim effects, proposal state, participant responses, recalculation, and risk

## Runtime Shape

Normal reviewer/demo mode uses the deterministic parser and workflow service without requiring a live OpenAI key.

When live SDK mode is enabled, `/api/agent` creates the OpenAI Agents runtime server-side and records safe metadata such as whether the SDK was attempted and invoked. The response never exposes secrets, server-only prompts, hidden system prompts, or raw SDK payloads.

## Implementation Order

1. Parse organizer input into a reviewable proposal draft.
2. Run deterministic itemized split and settlement calculations.
3. Persist workflow run events and artifacts.
4. Render participant review, organizer actions, and readiness blockers.
5. Optionally ask the server-side agent runtime for drafting, summarization, or explanation support.
6. Keep final amounts and safety decisions in typed TypeScript domain logic.

## Reviewer Notes

The architecture intentionally avoids real auth, payment processing, push notifications, and a production database. Those are production integration steps, not hidden assumptions. The prototype focuses on the product question that matters first: can an agreement-before-payment workflow reduce social friction enough to justify deeper infrastructure?
