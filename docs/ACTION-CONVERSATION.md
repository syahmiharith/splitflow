# Action-capable conversation

The composer defaults to a private assistant conversation. Message group explicitly posts human discussion without invoking an assistant. Shared expenses and the compact money pages remain authoritative; assistant prose is never proof of a committed action.

## Execution

`/api/workspace/assistant` authenticates the actor, loads owner-scoped threads and exposes send, confirm, cancel, retry, manual handoff and context attachment. GET supports an owner-scoped recent-conversation list, including recovery on another device. A user turn is persisted before inference. Provider failures preserve the turn and draft; interrupted requests can be retried without publishing a second expense or repayment.

The Responses adapter uses the existing configured model, `store: false`, strict function schemas, a 45-second request bound and at most five tool rounds. `read_workspace` retrieves only accessible context. `prepare_actions` validates an ordered set of group/activity domain commands, calculates exact KRW allocations and produces a private proposal. No model tool can directly commit shared mutations. Aliases resolve server-generated IDs when an activity and its expenses are created together. Unknown tools and invalid commands return bounded errors.

Confirmation consumes the stored proposal ID, expected revisions, dependency revisions and operation keys. The server reruns shared authorization and domain validation. `commit_assistant_batch` locks the thread and targets, checks dependencies, invokes existing activity commits, and saves the result in one Postgres transaction. A failed later write rolls back earlier writes. The database records revisions and idempotent results. Concurrent edits require a fresh review. Only a recipient may confirm a receipt; reported/disputed transfers never reduce debt.

## Scope and manual fallback

Tools cover creation and membership operations for groups; new and repeated activities; equal, excluded, unit and custom expense allocations; multiple payers; revisions, planned responses and corrections; monthly terms, acceptance and pause/resume; and repayment reports, receipt confirmation/dispute and dispute resolution. Existing domain restrictions remain in force. Invitations produce account-bound links, not automatic email delivery. External repayments are recorded, never executed.

Enter manually retains the private draft and transfers prepared expense, group, schedule or payment values to existing controls. Saved expense drafts are supplied as private context on later assistant turns. No private user request is automatically copied into group discussion. Real and sample storage remain isolated. Guest samples use the same command validators and calculations; they do not call OpenAI anonymously.

## Verification and operational boundary

OpenAI setup is on hold. No credential was created or changed. Tests inject scripted function calls, clearly separate from live model output; production has no scripted provider switch. Without a key, the real endpoint persists the user turn and returns Assistant unavailable with Retry and Enter manually. Live model interpretation, tool selection quality, API latency and billing behavior are not verified until setup resumes.

Coverage includes the Responses request envelope, multi-step reviewed creation, integer allocations, stale proposals, failed/duplicate submissions, group permissions, recipient-only confirmation, overpayment, recurring acceptance and pause, unknown tools, owner-scoped storage and actual local Postgres transaction rollback. Browser fixtures exercise message-only review/confirmation, reload recovery, private versus group discussion and manual fallback. Local Supabase tests use synthetic verified users; no real invitations or payments are sent.

Deployment uses an additive migration and the existing preview branch. Keep the PR draft. Rollback the application deployment first if necessary; retain the additive private tables so reviewed conversations are not lost. API error handling does not log user messages, email addresses or raw provider payloads.

## Persistent inline timeline

Assistant turns now carry optional typed parts: tool activity, proposal review and saved result. A user message and an empty response turn are persisted before inference. Registered tool execution reports safe labels and running/complete/failed state; raw arguments, prompts and reasoning never enter the rendered timeline. Signed-in clients poll their private thread during a request to display persisted progress. Plain greetings can return text without tools or cards.

Each review snapshot belongs to the response that prepared it. Editing supersedes it, cancellation discards it, and confirmation marks it saved in the same transaction that appends the execution receipt. Previous reviews collapse but remain inspectable. The result card retains deterministic participant amounts and record revision references; later revisions do not rewrite that snapshot. Lost-response replay returns the original receipt. Interrupted running tools are marked interrupted on retry.

Existing activity records are collapsed attached context. Manual workflows and money-overview handoffs can explicitly expand them. Generated activity events carry an event kind; historical untyped messages are attributed as activity updates rather than being represented as private user prompts. Actual assistant threads appear under Recent conversations; activities have their own sidebar section. No synthetic request history is invented for existing sample expenses.

Persistence uses the existing private JSON documents and transaction RPCs. New fields are optional for backward compatibility; no table migration or financial-history rewrite is needed. An application rollback may ignore the typed parts but must retain the stored documents. Private prompts, reviews and tool activity are never published to group discussion.

The visual treatment adapts the ChatGPT inline shopping card and generated-result references in docs/design/FINISH-PASS.md and OpenAI's ChatKit widget/action documentation, using the existing React components and Responses backend rather than adding ChatKit or another service. Tests inject scripted providers explicitly; their screenshots are not proof of live OpenAI execution.
