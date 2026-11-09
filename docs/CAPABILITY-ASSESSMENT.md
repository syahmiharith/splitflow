# Capability assessment — 10 November 2026

SplitFlow can compete on a focused shared-cost job. Current evidence does not establish full feature parity or equivalent reliability with mature budgeting, finance or messaging applications. Conversation is an interaction method; it is not proof that every underlying workflow is complete.

| Counterpart | Implemented in SplitFlow | Missing or deliberately excluded |
|---|---|---|
| [Splitwise](https://www.splitwise.com/) | Groups, equal/custom/unit splits, item exclusions, multiple payers, revisions, participant decisions, disputes, external repayment reports/receipts, monthly terms, balances/search | KRW only; no receipt scanning/import, production offline sync, payment integration, broad reporting or automatic reminder delivery. Debt reassignment deliberately excluded. |
| [YNAB](https://www.ynab.com/features) | Activity limits, category allowances, allowance adjustments, explicit cost classification and remaining allowance | Not a full personal budget: no income/account ledger, bank reconciliation/import, targets, rollover, loan planner or net-worth history. Activities currently require 2–30 people. |
| [Revolut transfers](https://www.revolut.com/money-transfer/) and [budgeting](https://www.revolut.com/blog/post/how-to-budget/) | Reports external payments and obtains recipient confirmation | No actual money movement, bank feeds, cards, verified bank receipts, savings products or automated transaction alerts. Recording a transfer is not executing one. |
| [Telegram](https://telegram.org/faq) / group messaging | Private assistant threads, saved history, inline tools/reviews/results, title search, activity summary | No person-to-person chat, media/files, voice/video calls, reactions, delivery/read receipts, push, offline messaging, polls or topics. Direct member chat is explicitly excluded by the product decision, not an unfinished chat feature. |
| Group coordination | Membership/invite/join/leave/remove, separate private threads, shared committed results, terms acceptance | No shared discussion or event polls; no ownership transfer or granular moderator roles. The assistant coordinates financial decisions rather than replacing group conversation. |

## What is verified

- `lib/assistant/provider.ts`: OpenAI Responses API; authorized `read_workspace` and `prepare_actions`, no model commit tool.
- `lib/activity/operations.ts`: shared manual/conversational command path with membership, revisions, mutual-friend rules and deterministic calculations.
- `lib/assistant/service.ts` and `server-store.ts`: stored-proposal confirmation, execution-time validation and transactional persistence.
- `tests/unit/assistant-actions.test.ts` and `expense-claims.test.ts`: atomic batches, retries, stale reviews, unauthorized references, allocation, recipient-only receipt confirmation, overpayments and preservation of agreements.
- `tests/e2e/planning-trust.spec.ts`: browser orchestration across independent accounts with scripted tool calls. This is not live-language quality evidence.
- `docs/CONVERSATION-VERIFICATION.md`: actual deployed OpenAI planning and allowance adjustment with save/reload. Does not establish live success for every supported action.

No measured unassisted completion rate, response-time comparison, longitudinal reliability or independent organizer retention evidence was found. The five-organizer/repeat-use pilot remains necessary before claiming superiority or adoption.

## Workflow gaps that matter more than another UI pattern

1. Long-running activity continuity: service rejects threads at 160 messages while activity navigation resolves the same canonical thread. No continuation/rollover path is currently implemented.
2. Context retrieval: only the latest 30 nonempty text turns go to the provider. Workspace reads cap at 20 records and have no paging tool; older or larger-workspace references can be incomplete.
3. Live model coverage: group membership, excluded dinner, revised rent, disputes, recipient confirmation and stale-review recovery need repeatable real-provider evaluation. Measure wrong-target selection, missing/extra clarifications, completion, latency and retries.
4. Recurrence: monthly only, due dates 1–28; variable actual costs require explicit recording. Scheduled fixed-period SQL existing is not proof of ongoing deployed scheduler operation.
5. Follow-through: shareable links and copyable reminders are not delivered notifications. Other participants still need to return and act.
6. Records: no personal-finance ledger/import/reconciliation or durable offline queue. Decide whether those belong before expanding into a budgeting replacement.

## Product judgment

Position as a conversational coordinator for shared KRW costs and agreements. Its plausible advantage is expressing a complex allocation or revision in one message and reviewing a deterministic result. This advantage remains a hypothesis until compared with ordinary forms on equivalent tasks. Judge parity by complete jobs: record → review → participant agreement → repayment → recovery, not tool count or visual resemblance.

This UI release does not implement the above functional gaps. It improves readability and action handoff while keeping current financial rules intact.
