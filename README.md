# SplitFlow

Agree on shared costs before anyone pays. SplitFlow turns an expense description into a proposal that participants can accept, challenge or revise.

[Try demo](https://splitflow-xi.vercel.app/) · [Case study](https://zsyahmi.dev/work/splitflow) · [Architecture](docs/TECHNICAL.md)

## Walk through an agreement

1. Describe a shared expense, including who paid and who joined each item.
2. Review the calculated shares and send the proposal.
3. Switch demo participants to accept, request a change or opt out.
4. Revise the proposal and inspect who must reconfirm.
5. Resolve payment claims and check the remaining readiness blockers.

The demo uses local state and simulated participants. It does not authenticate real users, verify bank payments or move money.

## Decisions in the implementation

**Interpretation and calculation have separate responsibilities.** A parser structures the expense; optional server-side OpenAI support can assist drafting. Typed TypeScript functions own amounts, eligibility, rounding and settlement balances.

**A changed amount needs a new agreement.** Participant responses and proposal revisions determine who must reconfirm. A generated proposal is a draft, not permission to settle.

**A payment claim is not confirmation.** Claimed and disputed payments remain visible in the readiness check until resolved.

## Maintenance evidence

A [readiness fix](https://github.com/syahmiharith/splitflow/commit/929425f9242f78ff357c054bf807a614424d92b0) keeps claimed and disputed payments in the blocker check. The [regression tests](tests/unit/readiness.test.ts) make those cases inspectable.

For the underlying contracts, read the [state machine](docs/engineering/STATE_MACHINE.md), [financial invariants](docs/engineering/FINANCIAL_INVARIANTS.md) and [edge-case matrix](docs/engineering/EDGE_CASE_TEST_MATRIX.md).

## Run locally

Requires Node.js and pnpm.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. No OpenAI key is needed for the deterministic demo. Optional agent configuration is documented in [technical setup](docs/TECHNICAL.md#local-development); credentials stay server-side.

## Check a change

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Vitest covers calculations, proposal transitions, parser behavior, readiness and API contracts. Playwright covers the interactive flow and responsive layouts. See [technical documentation](docs/TECHNICAL.md#testing) for the optional live-agent check.

## Scope and history

Built with Next.js, React, TypeScript and Tailwind CSS. [Prototype boundaries](docs/engineering/PROTOTYPE_BOUNDARIES.md) explain the persistence and infrastructure limits.

The [original product case study](docs/shardlab-product-case-study.md) remains available alongside the [current portfolio story](https://zsyahmi.dev/work/splitflow).
