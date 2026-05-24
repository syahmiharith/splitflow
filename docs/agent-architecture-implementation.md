# SplitFlow Agent Architecture

SplitFlow exposes one server-side agent orchestration path: `/api/agent`.

The product presents a compact AI Split Agent in the UI, while the server keeps the workflow decomposed into focused roles: intake, proposal, recalculation, response tracking, risk decision, participant communication, and recommendation. These agents can draft, classify, explain, and summarize, but deterministic domain services remain the authority for money and readiness.

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
5. Optionally ask the server-side agent runtime for drafting or explanation support.
6. Keep final amounts and safety decisions in typed TypeScript domain logic.

## Reviewer Notes

The architecture intentionally avoids real auth, payment processing, push notifications, and a production database. Those are production integration steps, not hidden assumptions. The submission focuses on product workflow, deterministic financial correctness, AI boundary discipline, mobile/desktop UX, and testable state transitions.
