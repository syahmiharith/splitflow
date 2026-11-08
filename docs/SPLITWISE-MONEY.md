# Inline group money

The ChatGPT-style conversation shell remains the primary interface. Splitwise references inform the money hierarchy inside it:

- [Group expense ledger](https://mobbin.com/screens/9f36de33-ee48-426a-b3df-65cba508f5b2): current balance first, dated expense rows, payer and personal impact (`expense-card.tsx`).
- [Group balances](https://mobbin.com/screens/973e57e7-b7d4-4be1-bfc6-d24711597608): people, amounts owed and named repayment paths (`money-overview.tsx`).
- [Expense entry](https://mobbin.com/screens/7d5b695d-659f-4f8f-8a50-dc82651d79de): title and amount first; payer, participants and split rules behind one disclosure (`pilot-expense-form.tsx`).

Group summaries include accessible activities, including archived records. Historical participants remain visible. They do not imply access to private activities. Planned shares stay separate from incurred costs. Owed and owing amounts across different expenses are not cancelled into a misleading settled status. Each obligation opens its original expense; no cross-expense payment is created.

Only recipient-confirmed receipts reduce balances. Reported and disputed payments remain historical records without reducing debt. Overpayments remain visible as credits. Changing a repayment recipient prefills the matching obligation amount. Financial changes still require explicit review and existing server authorization.

Validation: typecheck, lint, production build; 260 unit/API tests; 42 browser tests (16 conditional tests skipped); 12 additional local Supabase tests covering independent sessions, invitations, permissions, revisions and confirmed transfers. Twenty visual states at 320, 375, 768 and 1440 pixels had no overflow or browser errors and retained the composer. These checks do not establish real-user adoption or operational pilot readiness. OpenAI configuration remains on hold.
