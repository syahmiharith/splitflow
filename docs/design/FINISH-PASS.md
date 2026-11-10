# Conversation hierarchy finish pass

The current activity and the person's share lead the conversation. Recurring costs now show the monthly share above a concise total/start/due summary. Allocation and publication explanations live with the people/rules disclosure. Existing acceptance, stale-review and paused-period information stays visible where a decision depends on it.

Assistant reviews name the affected record, or the number of changes in a batch. One short privacy label identifies the private thread; the composer only adds a visibility note in Message group mode. Review instructions remain beside confirmation. Primary confirmation stays dark, editing uses a secondary surface, and pause/resume uses a quieter action. Copied-link feedback is brief and animated only on success, with reduced-motion support.

Shared numerals are tabular, secondary text uses darker contrast, long headings wrap, and spacing between related conversation sections is tighter. Existing checkmarked menus, calendar, full-row account menu and inline manual workflows remain in the same conversation. Accent is limited to selected money-view navigation and success feedback.

Validation covers the existing unit/API suite, production build and desktop/mobile browser journeys; responsive inspection covers 320, 375, 768 and 1440 pixels. This work does not establish live OpenAI execution or real-user adoption evidence.

Money-view scope text is conditional: multi-activity views show their activity count, and archived inclusion appears only when applicable. Single-activity views omit that redundant helper. Repayment obligations use bordered full-row buttons, explicit Report payment or View repayment text, a chevron, hover/active/focus states, and keyboard activation that returns to the expense conversation. Reporting and receipt confirmation still happen there.

Placeholders use opaque #626262 text on light input surfaces. Nested menu geometry uses a 12px surface radius, 4px inset and 8px item radius. Calendar cells use the same subtraction rule with a 4px optical minimum for discrete controls. These refinements reuse the inspected ChatGPT menus and Linear calendar references documented in CONTROLS.md.

## Conversation continuity research

The following audit describes the prior implementation. The typed timeline correction is now implemented; see ACTION-CONVERSATION.md for the current contract.

The finish pass addresses presentation, not the remaining conversation-history model gap. Current Recent conversations maps activities; private assistant threads have a separate list. Activity messages/expenses render together, followed by a separately rendered assistant transcript. Assistant turns currently contain text, with a single pending/draft proposal and lastResults on the thread. Provider tool calls are handled inside a request rather than persisted as typed timeline parts. Confirmation clears the pending proposal and produces generic success text. Thus a rendered expense is not necessarily accompanied by its originating request, tool status, reviewed revision and execution receipt.

Inspected references:
- ChatGPT shopping-research inline card: https://mobbin.com/screens/740b0b9f-805d-46c6-86c1-de07d8b5907b — user request followed by a task-status label, contextual result card and relevant card actions inside one transcript.
- ChatGPT generated-image result: https://mobbin.com/screens/e461d666-9a0e-4c9a-9afe-78de81a5ca86 — generated output is attached to the assistant response that produced it.
- ChatGPT conversation flow: https://mobbin.com/flows/be100cd4-ee02-4e2d-87dc-43d23681e4fe — chronological exchanges and an anchored composer; inspected previews include search/source results and voice exchanges, not a financial action workflow.
- OpenAI ChatKit widgets: https://developers.openai.com/api/docs/guides/chatkit-widgets — interactive cards can sit in conversation and dispatch actions to the application backend.
- OpenAI ChatKit actions: https://developers.openai.com/api/docs/guides/chatkit-actions — widget actions can produce further thread items; server actions validate typed payloads.

Recommended implementation: persist typed message parts (text, safe tool activity, clarification, proposal review, execution receipt) linked to their originating turn. Render them chronologically in one private conversation. Keep compact statuses factual and human-readable; do not expose raw arguments, prompts, reasoning, or internal agent names. After confirmation retain the reviewed snapshot and append a result receipt with record/revision references. Later revisions append new receipts, preserving historical amounts and distinguishing them from current state. Stale reviews remain visibly superseded and cannot be submitted. Buttons dispatch the same authorized command services and add their outcomes to the originating thread. Publish only committed results to shared activity history; private prompts and proposed changes remain private.

Recent conversations should open actual assistant threads and their scroll position/context. Groups and activities remain contextual records and browsing destinations. Existing seeded activities must not be retroactively presented as AI-generated conversations. Any sample conversational walkthrough must be clearly labeled and isolated; real tool events must come from real execution. This is a product adaptation of the inspected references, not a claim about ChatGPT's internal implementation. It does not require adopting ChatKit or introducing another backend.

## Conversational money cards (2026-11-09)

Inspected references: [ChatGPT inline shopping card](https://mobbin.com/screens/740b0b9f-805d-46c6-86c1-de07d8b5907b), [WeChat transfer message](https://mobbin.com/screens/4a38a0ab-5b16-44bd-9e72-0d98d3c0ec47), [Revolut transfer message](https://mobbin.com/screens/f7b049d6-b03c-4ef9-b703-9e5130e688f7), and [KakaoPay's official chat transfer flow](https://contents.kakaopay.com/contents/2357). Mobbin's KakaoTalk results showed gift checkout/payment settings, not inline transfers; the official Kakao guide supplies the interaction reference, not a claim of inspected Mobbin transfer screens.

Use ChatGPT's assistant-owned card placement and messaging products' compact amount/purpose/status hierarchy. Cards appear only after their originating message and tool result. Equal splits lead with the per-person amount; unequal splits and multiple payers retain individual amounts in the review. Exclusions remain visible. Group access changes, recurring terms, revision comparisons and receipt consequences remain visible before commitment. Secondary calculations disclose on demand. Explicit Edit reuses the existing prefilled manual workflow; conversational corrections remain available. Saved cards collapse details and omit repeated participant tables, revision metadata and explanatory footnotes. These are external-payment records, never proof that SplitFlow moved money.

## YNAB-inspired activity planning (2026-11-09)

Inspected YNAB iOS references on Mobbin:
- [Planning categories](https://mobbin.com/screens/e495fa63-410f-4d39-84d4-a7c828f5ae54): compact grouped rows, aligned meaningful amounts and explicit states.
- [Recurring target](https://mobbin.com/screens/0add07fd-dfa0-44bd-8857-7e73ac30f46e): an amount paired with cadence and due date, with secondary controls disclosed only when editing.
- [Move money](https://mobbin.com/screens/d4385427-4995-4ac2-a5dc-2a8f0bd27403): source/destination consequences remain visible during an adjustment.
- [Spending breakdown](https://mobbin.com/screens/f9387a42-18ab-4c36-a7f5-425845680ff8): ranked readable rows and meaningful amounts rather than a grid of oversized cards.

SplitFlow adapts these into optional activity spending limits, named category allowances, explicit expense classification and old/new allowance reviews inside the private assistant conversation. Its read-only Planning view shows reported costs against allowances and recurring terms; all edit actions return to the activity conversation. The compact plan card distinguishes allowance from cash and reported costs from verified facts. It does not copy YNAB's brand, bank-account model, funding semantics or manager access to personal plans. Manual editing is secondary and uses the same deterministic parser with an explicit review before saving.

## Compact conversation receipts and live context (2026-11-10)

- Cleo chat: https://mobbin.com/screens/4eae3178-b951-4116-8b5f-c67928c84041 — brief contextual responses, without its promotional imagery or lending features.
- Splitwise group balances: https://mobbin.com/screens/973e57e7-b7d4-4be1-bfc6-d24711597608 — compact person/amount rows and explicit owes/gets-back language.
- YNAB: https://support.ynab.com/moving-money-in-your-plan-ryyCKbBJi — visible category-to-category adjustments and retained history, not a claim about bank cash.
- Telegram: https://telegram.org/blog/pinned-messages-locations-playlists — persistent chat context adapted into a toggleable live activity summary.

Pending and historical reviews share money-card components. Confirmation changes the original card to Saved; matching execution results do not repeat it. Planning adjustments show changed allowances, with complete historical review lines behind Details. The summary above the conversation reads current authorized records; historical cards retain their original values.

Activities and private unattached threads share Conversations navigation. Each member has a separate canonical activity conversation; earlier threads stay accessible and are never merged. Summary expansion is a device-local preference scoped to account and activity.
