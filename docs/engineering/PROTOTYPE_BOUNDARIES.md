# SplitFlow Prototype Boundaries

SplitFlow is a production-minded prototype, not a production financial system. The current repo is designed to prove the agreement-first workflow and deterministic safety model before adding infrastructure such as a database, native mobile app, real-time collaboration, or payment provider.

## Current Prototype Scope

The prototype currently proves:

- Messy shared-cost prompts can become structured proposal state.
- Itemized split logic can model eligibility and exclusions.
- Deterministic calculation can reconcile shares, paid-by totals, net balances, and settlement instructions.
- Participant responses can move proposals through review, change, opt-out, reconfirmation, and readiness states.
- Claimed payments are tracked separately from confirmed payments.
- Readiness surfaces blockers instead of trusting an AI answer.
- Vitest and Playwright cover core domain, workflow, API, and UI flows.

## What Is Deterministic Today

- Equal, weighted, percentage, fixed, and itemized split calculations
- KRW rounding and itemized remainder assignment
- Per-item participant eligibility
- Paid-by accounting
- Net balance and settlement instruction generation
- Proposal status derivation
- Readiness blockers and next-action selection
- Payment claim conflict detection
- Proposal artifact identity and workflow versioning

## What Is AI-Assisted Today

- Natural-language prompt interpretation through the prototype parser
- Proposal drafting from messy organizer context
- Optional server-side OpenAI Agents runtime for organizer-facing drafting when configured
- Workflow explanation and assistant messaging

AI-assisted output is not final financial truth. It must become typed proposal state and pass deterministic validation before it can support readiness decisions.

## What Is Simulated, Seeded, Or Local Only

- Demo groups and proposals are seeded/local prototype data.
- Profile switching simulates organizer and participant perspectives.
- Payment claims are notes, not bank-verified payments.
- Payment confirmation is organizer-controlled state, not payment-provider proof.
- Notifications/reminders are local workflow actions, not real push notifications.
- Persistence is prototype/local or file-backed for workflow tests, not production database storage.
- The live OpenAI runtime is optional and server-side only.

## What Would Be Needed For Production

- Authenticated users and invite links
- Durable database persistence with audit trails
- Server-side authorization for proposal and participant actions
- Transactional state transitions or concurrency control
- Real-time collaboration if multiple participants edit/respond at once
- Payment-provider integration or external payment proof ingestion
- Fraud, abuse, and rate-limit protections
- Observability, logging, and incident response
- Privacy and data-retention policy for financial conversation data
- Expanded parser coverage and human review flows for ambiguous allocation

## Why Infrastructure Is Not The Immediate Next Proof Point

Firebase, React Native, database persistence, and payment integrations could all be valid future work, but they are not the strongest next proof for this portfolio repo.

The more important engineering proof is:

- What messy cases are handled?
- Which invariants keep money safe?
- Which transitions are blocked?
- Which unsupported cases are honestly marked as future work?
- Which tests prove the safety model?

That is the defensible technical story: AI handles ambiguity; deterministic code handles money.
