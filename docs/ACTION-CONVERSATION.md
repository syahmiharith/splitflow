# Action-capable conversation

Every composer message goes to a private assistant conversation. Direct user-to-user messaging is disabled in UI, domain commands and database commits; historical discussion is preserved read-only. Shared expenses and the compact money pages remain authoritative; assistant prose is never proof of a committed action.

## Execution

`/api/workspace/assistant` authenticates the actor, loads owner-scoped threads and exposes send, confirm, cancel, retry, manual handoff and context attachment. GET supports an owner-scoped recent-conversation list, including recovery on another device. A user turn is persisted before inference. Provider failures preserve the turn and draft; interrupted requests can be retried without publishing a second expense or repayment.

The Responses adapter uses the existing configured model, `store: false`, strict function schemas, a 45-second request bound and at most five tool rounds. `read_workspace` retrieves only accessible context. `prepare_actions` validates an ordered set of group/activity domain commands, calculates exact KRW allocations and produces a private proposal. No model tool can directly commit shared mutations. Aliases resolve server-generated IDs when an activity and its expenses are created together. Unknown tools and invalid commands return bounded errors.

Confirmation consumes the stored proposal ID, expected revisions, dependency revisions and operation keys. The server reruns shared authorization and domain validation. `commit_assistant_batch` locks the thread and targets, checks dependencies, invokes existing activity commits, and saves the result in one Postgres transaction. A failed later write rolls back earlier writes. The database records revisions and idempotent results. Concurrent edits require a fresh review. Only a recipient may confirm a receipt; reported/disputed transfers never reduce debt.

## Scope and manual fallback

Tools cover creation and membership operations for groups; new and repeated activities; equal, excluded, unit and custom expense allocations; multiple payers; revisions, planned responses and corrections; monthly terms, acceptance and pause/resume; and repayment reports, receipt confirmation/dispute and dispute resolution. Existing domain restrictions remain in force. Invitations produce account-bound links, not automatic email delivery. External repayments are recorded, never executed.

Enter manually retains the private draft and transfers prepared expense, group, schedule or payment values to existing controls. Saved expense drafts are supplied as private context on later assistant turns. No private user request is automatically copied into group discussion. Real and sample storage remain isolated. Guest samples use the same command validators and calculations; they do not call OpenAI anonymously.

## Verification and operational boundary

OpenAI setup was resumed by the user. No credential was created or changed by this implementation. Tests inject scripted function calls, clearly separate from live model output; production has no scripted provider switch. Without a key, the real endpoint persists the user turn and returns Assistant unavailable with Retry and Enter manually. Live model interpretation, tool selection quality, API latency and billing behavior are not established by scripted-provider tests.

Live preview verification on 2026-11-10 used two independently signed-in Safari sessions and actual `gpt-5.4-mini-2026-03-17`. Both accounts added each other through context lookup, inline review and confirmation. On desktop, one combined review created a planned activity with a KRW 600,000 limit, Food 400,000 and Transport 200,000. At a 375×812 Safari responsive viewport, a natural-language adjustment retrieved the saved plan and reviewed Food 400,000 → 370,000 and Transport 200,000 → 230,000. Confirmation and reload preserved both amounts, the unchanged limit and zero reported costs. The independent desktop account retrieved those revised amounts through its own OpenAI conversation without seeing the author's private assistant messages. Mobile evidence is responsive-browser verification, not a physical-device test. No expenses or payments were created.

The mobile test exposed a lookup continuity bug: category queries could exclude the current activity before prioritization. Workspace reads now always retain the authorized current activity and keep the existing 20-record limit; a regression test covers a category query that does not match its title.

The exported strict tool schema converts disjoint `oneOf` commands to `anyOf`, removes defaults and leaves JavaScript regex validation to the server Zod boundary. Live requests with the generated regex patterns returned `incomplete/max_output_tokens` with zero output/reasoning tokens; removing the patterns restored generation. Empty/incomplete responses are retryable failures, never fabricated clarification text. Safe diagnostics contain only bounded provider identifiers, model, status and token counts.

Coverage includes the Responses request envelope, multi-step reviewed creation, integer allocations, stale proposals, failed/duplicate submissions, group permissions, recipient-only confirmation, overpayment, recurring acceptance and pause, unknown tools, owner-scoped storage and actual local Postgres transaction rollback. Browser fixtures exercise message-only review/confirmation, reload recovery, private versus group discussion and manual fallback. Local Supabase tests use synthetic verified users; no real invitations or payments are sent.

Deployment uses an additive migration and the existing preview branch. Keep the PR draft. Rollback the application deployment first if necessary; retain the additive private tables so reviewed conversations are not lost. API error handling does not log user messages, email addresses or raw provider payloads.

## Persistent inline timeline

Assistant turns now carry optional typed parts: tool activity, proposal review and saved result. A user message and an empty response turn are persisted before inference. Registered tool execution reports safe labels and running/complete/failed state; raw arguments, prompts and reasoning never enter the rendered timeline. Signed-in clients poll their private thread during a request to display persisted progress. Plain greetings can return text without tools or cards.

Each review snapshot belongs to the response that prepared it. Editing supersedes it, cancellation discards it, and confirmation marks it saved in the same transaction that appends the execution receipt. Previous reviews collapse but remain inspectable. The result card retains deterministic participant amounts and record revision references; later revisions do not rewrite that snapshot. Lost-response replay returns the original receipt. Interrupted running tools are marked interrupted on retry.

Existing activity records are collapsed attached context. Manual workflows and money-overview handoffs can explicitly expand them. Generated activity events carry an event kind; historical untyped messages are attributed as activity updates rather than being represented as private user prompts. Actual assistant threads appear under Recent conversations; activities have their own sidebar section. No synthetic request history is invented for existing sample expenses.

Persistence uses the existing private JSON documents and transaction RPCs. New fields are optional for backward compatibility; no table migration or financial-history rewrite is needed. An application rollback may ignore the typed parts but must retain the stored documents. Private prompts, reviews and tool activity are never published to group discussion.

The visual treatment adapts the ChatGPT inline shopping card and generated-result references in docs/design/FINISH-PASS.md and OpenAI's ChatKit widget/action documentation, using the existing React components and Responses backend rather than adding ChatKit or another service. Tests inject scripted providers explicitly; their screenshots are not proof of live OpenAI execution.

Conversation reviews use compact, read-only transaction cards. Manual editing is explicit and reuses the retained draft; switching to payment controls also expands their activity context. Optional server-derived preview summaries carry repayment amounts/status and recurring dates for compact saved receipts. Older stored previews without summaries retain their original detail fallback. This additive JSON change requires no migration; historical snapshots and transactional confirmation remain unchanged. Full proposed access changes, revised shares and receipt consequences remain visible before confirmation, while saved details disclose on demand.

## Activity spending plans

An activity may contain an optional `plan`: an integer-KRW limit and named category allowances. The owner prepares or revises the complete plan through the `plan` command and supplies a reason. Existing activity expected revisions, proposal confirmation, audit events and transactional batch execution apply unchanged. Plans never create expenses, debts, acceptance or transfers. An additive JSON field preserves old activities without a data migration.

Category allowances cannot exceed the total limit. Unallocated allowance remains explicit. Expense-to-category assignments are explicit IDs from the same activity; duplicate assignments and unknown references are rejected. Removing a category or changing an assignment appears in the review. Category names and expense titles are data, never instructions. The assistant must ask for missing facts rather than infer an expense classification.

`reportedCost` sums recorded paid-mode expenses, even if their underlying claims still await agreement or are disputed. It is deliberately labeled reported cost. Planned expenses are shown separately; confirmed repayments do not change spending totals. Remaining allowance is the limit minus reported cost and can be negative. It is not available cash, bank funding or proof of an obligation. Shared obligations and receipt confirmations retain their independent consent rules.

The Planning tab is read-only. Activity rows return to the original conversation; monthly terms show their amount, due day and acceptance state separately from reported costs. The optional manual editor uses the same domain validator, retains its draft when editing a review, and requires explicit confirmation before handing the typed command to the existing server operation service. Browser/provider failures never turn a prepared allowance into a shared record.


## Claims, agreements and mutual friendship

Each person independently adds the other. Pending friendship gives no authority to create debt. Friendship uses immutable two-person records, independent joined flags and a unique pair constraint. New shared groups/activities and newly published or revised costs require mutual friendship to the acting person. Removing a friend prevents new claims; existing records, responses and confirmed transfer history remain accessible. The database serializes friendship revocation with new cost writes. Existing groups are never silently upgraded into friendships.

An expense begins as a claim. Only full participant consent establishes the first agreed snapshot; the organizer's publication represents their own statement, and all other participants must explicitly accept. A denial is recorded as a dispute, not proof that a claim is false. Until consensus, claimed amounts stay outside agreed balances. Later revisions require affected users to review again and cannot replace the previous agreed snapshot until consent is complete. This conservative whole-expense agreement rule means one unresolved participant can delay the first agreement for the entire expense. No silence-based acceptance is used.

Response history preserves accepted/declined/correction statements and reasons, including legacy responses before any revision clears them. Agreed snapshots and confirmed historical transfers remain intact through later disputes. Existing unaccepted records are not retroactively declared true. Agreement records consent, not independent verification or a legal determination. A pending/disputed claim can remain unresolved; SplitFlow cannot enforce payment or decide who is telling the truth.

Research basis: [Splitwise ledger and automatic balances](https://kb.splitwise.com/getting-started/how-do-i-use-splitwise), [collaborative correction/history](https://kb.splitwise.com/groups/can-i-prevent-group-members-from-changing-expenses-or-set-permissions), [blocking and abuse reports](https://kb.splitwise.com/account-issues/what-do-i-do-if-someone-is-abusing-or-harassing-me-on-splitwise), [Tricount receipt attachments](https://www.tricount.com/features), and [Venmo dispute evidence](https://help.venmo.com/cs/articles/following-up-on-a-dispute-vhel125). These are distinct trust models, not proof that an expense is authentic. SplitFlow adopts explicit consent and preserved history; it does not claim provider-style adjudication or receipt verification.

Deployment requires migration `20261109140000_mutual_friendships.sql` before releasing the new app. It preserves records and adds pair uniqueness and commit guards. Keep these guards during an application rollback; an older app may need read-only mode until a compatible build is restored rather than bypassing mutual consent.

### Acceptance and historical money

Recorded expenses cannot be converted back into plans. Planned expenses may become recorded costs, but that requires fresh acceptance. Legacy planned records still expose confirmed transfer credits; a display mode must never erase payment history. Later objections preserve the last agreed expense snapshot and each person's dated response. The conversational response preview states the reviewed share, current claim status, prior accepted shares where present, and remaining balances after confirmed transfers.

Switching an uncommitted activity-and-plan proposal to manual entry retains its plan. The user explicitly creates the activity, then reviews and saves the retained plan; neither step silently commits the other.

## Stable activity conversation destination

`POST /api/workspace/assistant` accepts `{ action: "resolve", activityId }` to resolve/create the caller's canonical private conversation. The actor comes from authentication; the server-only `resolve_activity_conversation` RPC checks current membership and serializes creation per owner/activity. Migration `20261110090000_activity_conversations.sql` adds the mapping without rewriting existing threads. Latest legacy thread wins (updated timestamp descending, ID ascending). Other threads remain accessible through Earlier conversations. Guest mappings use isolated account-scoped local storage.

Deploy the additive migration before the UI. To roll back the UI, deploy the preceding commit; the mapping table can remain and no financial records need restoration. Do not drop threads or mappings to roll back presentation.
