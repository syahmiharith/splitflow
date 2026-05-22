# SplitFlow Agent Architecture Implementation

Phase 0 baseline:

- Package manager: `pnpm`
- Validation commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`
- Existing UI routes, client state, and `/api/ai/split-agent` are preserved.
- New agent workflow code is additive and orchestrator-first.
- The server orchestrator can use the OpenAI Agents SDK through `@openai/agents` when `SPLITFLOW_USE_OPENAI_AGENTS_SDK=1` and `OPENAI_API_KEY` are configured.
- Deterministic domain services own money math, proposal state, participant responses, recalculation, and risk.

Implementation order:

1. Build and test deterministic domain services.
2. Add shared agent contracts and orchestrator skeleton.
3. Add specialized agents one by one behind the orchestrator.
4. Add `/api/agent` as the structured server-only orchestrator route.
5. Add manual UI harness and README documentation after tests cover the workflow.
