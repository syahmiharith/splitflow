# Conversational personal and shared finance

The November 10 direction extends the shared-cost app with private recorded accounts, multi-currency budgeting and CSV imports. It supersedes older prototype-only and KRW-only guidance for the new personal ledger. Shared activity allowances remain KRW; shared expenses can carry their own currency. No bank connection or payment execution is implied.

## Boundaries

The assistant prepares commands; the user confirms one stored proposal. Shared and personal commands can commit in the same database transaction with audit records and idempotency. Personal ledger ownership comes from the signed-in session, never tool arguments. A private account balance is not visible to another activity member.

Amounts use safe integer minor units and explicit ISO currency precision. Existing shared records without a currency remain KRW. Currency cannot change after publication; different currencies are never netted. Exchanges record both actual amounts and fees without estimating a rate. Available-money budgets exclude future income. Transfers and card repayments do not create additional spending.

The assistant reads relevant paginated workspace and ledger records. Historical turns are data, not authority. Confirmation recalculates commands against current revisions and authorization. Model success text alone never establishes a saved result.

## Review and recovery

Personal `allocate` commands preserve signed-delta behavior for existing records. For a requested monthly allocation target, `mode: "setMonthly"` supplies the desired total allocated in that month; the server derives the delta. The target is distinct from the remaining category balance after spending and rollover. Reviews show deterministic before/after amounts and transaction category allocations.

Future category allocations reserve existing cash across all month views. A later release does not make funds available while an earlier month still reserves them. Overspending stays visible, and negative allocation changes may repair an overallocated plan without requiring new income.

Accounts, Plan & goals and Upcoming are inspection spaces. Contextual actions return to the composer. Manual account/transaction entry and CSV mapping prepare the same inline proposals as the assistant. Import previews reject malformed rows, exclude exact repeated imports and require review of possible matches. Imports are atomic and limited to 500 selected rows per review. CSV mappings are remembered locally per account and signed-in identity.

Conversational export uses `read_finance` with `kind: "export"` and an authorized account ID. It returns a same-origin account-register handoff; the existing **Export CSV** control starts the actual download. The assistant never claims that returning a link downloaded a file. Only this specific overview route is rendered as a link in assistant text; arbitrary model HTML and external URLs remain plain text. Historical-month summaries label cash, card reserves, liabilities and receivables as current, return category amounts through the requested month, and omit a misleading historical ready-to-assign total. Schedule retrieval includes the same deterministic next unhandled occurrence shown in Upcoming, explicitly labeled expected rather than recorded.

Conversation history archives older turns under the same owner/thread identity after 160 turns, normally retaining 40 active turns and keeping related review/result cards together. Earlier turns load on demand; no historical conversation is rewritten into invented user messages.

## Notifications

Reviewed group invitations enqueue delivery intents in the same transaction. Reminder preferences are owner-scoped and opt-in. Disputed, expired, revoked and resolved tasks are excluded; recipient mute and snooze apply. Provider acceptance is not proof of delivery or reading.

Outbound activation is ON HOLD at the user's November 10 request. NOTIFICATIONS_ENABLED defaults off. BREVO_API_KEY, NOTIFICATION_FROM_EMAIL, APP_URL and CRON_SECRET must be configured server-side before enabling the worker. Supabase authentication SMTP does not provide application delivery credentials. No live-delivery result may be claimed while disabled.

## Verification evidence

See tests/unit/assistant-history.test.ts, assistant-retrieval.test.ts, assistant-finance.test.ts and the finance/notification tests. SQL tests under tests/sql are transaction-wrapped and roll back fixtures. Live OpenAI and deployed UI evidence must be recorded separately from scripted tests.

Latest local follow-up: typecheck, lint and production build passed; 399 unit/API tests passed with three conditional local-Supabase tests skipped. Fourteen desktop/mobile browser regressions passed on the production build, including actual CSV download, unauthorized account handoff, Upcoming period handoff, confirmation/reload, import deduplication and responsive finance views. These browser fixtures use isolated sample data or scripted providers.

An additional eight mocked notification-worker tests passed, covering the disabled gate, provider acceptance, recipient mute/stop, invitation acceptance after queueing, snooze attempt preservation, bounded rate-limit retries and ambiguous failure. Typecheck and targeted ESLint passed for that addition. No email was sent.

Completion remains unproven for the following deployed gates: actual OpenAI journeys for every shared/personal action family; signed-in continuation/history beyond 160 turns; the corrected allocation target; import/reconciliation through the live assistant; recovery under stale reviews and interrupted inference; and final signed-in screenshots at 320, 375, 768 and 1440 pixels. Existing unit, SQL and browser fixtures provide regression evidence for those mechanisms, not proof of those deployed journeys. The locked Mac prevents access to the controlled signed-in Safari sessions; unlocking is the next required external step. Live Brevo delivery is separately deferred by user decision.

## Applied pilot database validation — November 10

Migrations `20261110110000_conversation_segments`, `20261110111000_personal_finance` and `20261110120000_notification_outbox` were applied to the dedicated SplitFlow pilot. Their corresponding SQL suites completed successfully with transaction rollback. Outbound notifications remain disabled. Deployment/UI and actual model verification are separate gates; this database result does not establish them.

## Deployed live-model verification — November 10

Preview commit `cf32749` reached Ready. In a signed-in browser, actual OpenAI prepared one reviewed batch creating two synthetic recorded accounts (KRW 1,000,000 and USD 200.50), a Food category and KRW 300,000 allocation. Confirmation saved the batch. Independent Accounts and Plan & goals views showed the separate balances, Food allocation and KRW 700,000 / USD 200.50 available to assign.

A subsequent allocation request exposed target-versus-delta ambiguity before confirmation; that proposal was discarded. The follow-up patch adds explicit target semantics, removes repeated saved-card amounts, exposes transaction categories in review and separates Responses API commentary from final answers. A live grocery request reached review after a payee clarification. The Mac locked before its confirmation could be verified. Remaining live action families, responsive screenshots and the allocation-fix retest are pending; scripted checks do not establish those outcomes. Brevo activation remains on hold.
