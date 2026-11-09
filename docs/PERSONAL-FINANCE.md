# Conversational personal and shared finance

The November 10 direction extends the shared-cost app with private recorded accounts, multi-currency budgeting and CSV imports. It supersedes older prototype-only and KRW-only guidance for the new personal ledger. Shared activity allowances remain KRW; shared expenses can carry their own currency. No bank connection or payment execution is implied.

## Boundaries

The assistant prepares commands; the user confirms one stored proposal. Shared and personal commands can commit in the same database transaction with audit records and idempotency. Personal ledger ownership comes from the signed-in session, never tool arguments. A private account balance is not visible to another activity member.

Amounts use safe integer minor units and explicit ISO currency precision. Existing shared records without a currency remain KRW. Currency cannot change after publication; different currencies are never netted. Exchanges record both actual amounts and fees without estimating a rate. Available-money budgets exclude future income. Transfers and card repayments do not create additional spending.

The assistant reads relevant paginated workspace and ledger records. Historical turns are data, not authority. Confirmation recalculates commands against current revisions and authorization. Model success text alone never establishes a saved result.

## Review and recovery

Personal `allocate` commands preserve signed-delta behavior for existing records. For a requested monthly allocation target, `mode: "setMonthly"` supplies the desired total allocated in that month; the server derives the delta. The target is distinct from the remaining category balance after spending and rollover. Reviews show deterministic before/after amounts and transaction category allocations.

Accounts, Plan & goals and Upcoming are inspection spaces. Contextual actions return to the composer. Manual account/transaction entry and CSV mapping prepare the same inline proposals as the assistant. Import previews reject malformed rows, exclude exact repeated imports and require review of possible matches. Imports are atomic and limited to 500 selected rows per review. CSV mappings are remembered locally per account and signed-in identity.

Conversation history archives older turns under the same owner/thread identity after 160 turns, normally retaining 40 active turns and keeping related review/result cards together. Earlier turns load on demand; no historical conversation is rewritten into invented user messages.

## Notifications

Reviewed group invitations enqueue delivery intents in the same transaction. Reminder preferences are owner-scoped and opt-in. Disputed, expired, revoked and resolved tasks are excluded; recipient mute and snooze apply. Provider acceptance is not proof of delivery or reading.

Outbound activation is ON HOLD at the user's November 10 request. NOTIFICATIONS_ENABLED defaults off. BREVO_API_KEY, NOTIFICATION_FROM_EMAIL, APP_URL and CRON_SECRET must be configured server-side before enabling the worker. Supabase authentication SMTP does not provide application delivery credentials. No live-delivery result may be claimed while disabled.

## Verification evidence

See tests/unit/assistant-history.test.ts, assistant-retrieval.test.ts, assistant-finance.test.ts and the finance/notification tests. SQL tests under tests/sql are transaction-wrapped and roll back fixtures. Live OpenAI and deployed UI evidence must be recorded separately from scripted tests.

## Applied pilot database validation — November 10

Migrations `20261110110000_conversation_segments`, `20261110111000_personal_finance` and `20261110120000_notification_outbox` were applied to the dedicated SplitFlow pilot. Their corresponding SQL suites completed successfully with transaction rollback. Outbound notifications remain disabled. Deployment/UI and actual model verification are separate gates; this database result does not establish them.

## Deployed live-model verification — November 10

Preview commit `cf32749` reached Ready. In a signed-in browser, actual OpenAI prepared one reviewed batch creating two synthetic recorded accounts (KRW 1,000,000 and USD 200.50), a Food category and KRW 300,000 allocation. Confirmation saved the batch. Independent Accounts and Plan & goals views showed the separate balances, Food allocation and KRW 700,000 / USD 200.50 available to assign.

A subsequent allocation request exposed target-versus-delta ambiguity before confirmation; that proposal was discarded. The follow-up patch adds explicit target semantics, removes repeated saved-card amounts, exposes transaction categories in review and separates Responses API commentary from final answers. A live grocery request reached review after a payee clarification. The Mac locked before its confirmation could be verified. Remaining live action families, responsive screenshots and the allocation-fix retest are pending; scripted checks do not establish those outcomes. Brevo activation remains on hold.
