# SplitFlow UI element audit — 10 November 2026

## Scope and preservation

Audit the controls used to find a private activity conversation, ask SplitFlow to act, review a precise money proposal, inspect money records and use secondary manual controls. This is a relevant-pattern audit, not an exhaustive catalog of Mobbin. No new financial capabilities, bank connections, payment processing, direct member chat or framework.

Preserve private threads, deterministic KRW calculations, reviewed commands, immutable historical cards, separate claims/agreement/receipt states, existing routes and the unified guest/real interface. References lend interaction structure, not branding or example data.

## Inspected references and decisions

| Product / screen | Visible pattern | SplitFlow decision |
|---|---|---|
| [ChatGPT conversation search, web](https://mobbin.com/screens/169c1c0e-8ed0-486e-ac7b-ba18036558d8) | Search field above compact title/secondary-text result rows | Add Search conversations in navigation. Search authorized activity and unattached thread titles, including archived activities; selecting resumes the existing thread. No duplicated activity/thread rows. |
| [ChatGPT composer menu, web](https://mobbin.com/screens/18548847-534b-4263-9ffb-3f6cfdda7582) | Plus trigger opens a compact anchored action list | Replace the disclosure-based manual menu with the installed accessible popover primitive. Keep manual actions secondary, trap no conversation state, dismiss on Escape/outside click, restore trigger focus and avoid viewport collisions. |
| [Revolut recipient selection, iOS](https://mobbin.com/screens/e287ef62-7803-4aeb-a685-e9248c2acb05) | Search by name/email, compact avatar/name rows | Add local filtering to the existing Friends panel and align initials, identity and relationship state. Retain Add back versus Remove friend; do not adopt payment/contact syncing or infer friendship from selection. |
| [Slack invitation dialog, web](https://mobbin.com/screens/4689ccda-74c0-4f68-95e3-6f9c08932503) | Focused invite surface, distinct copy-link action | Place copy next to the existing read-only link and keep eligible people in a disclosure. Copy feedback says Copied, never emailed. No new access rights. |
| [Splitwise group expenses, iOS](https://mobbin.com/screens/31e69d68-6688-42f2-bd9a-bbc95cfd28f5) | Date, title, payer and amount in one expense row; compact view actions | Retain the existing compact read-only money ledger and view tabs. Do not add the large image header, charts promotion or floating Add expense button. Actions stay in conversation. |
| [Splitwise settle up, iOS](https://mobbin.com/screens/f9ccb11d-e020-436f-9ed5-8caf559871f6) | Recipient and amount rows, secondary options | Existing obligation/repayment rows already pair people and amounts with a conversation handoff. Preserve recipient confirmation, disputes and expense-specific obligations. |
| [YNAB move money, iOS](https://mobbin.com/screens/4b36c835-5285-4ae7-a4d6-d4ebb24d8eb5) | Source/destination categories, moved amount and changed destination value | Retain the shared pending/saved before→after category cards. Do not introduce a number keypad/slider as the primary conversation method or treat allowances as cash. |
| [YNAB category details, iOS](https://mobbin.com/screens/1f9213c1-e34e-4ead-abcd-a51bb57feb74) | Focused details sheet with secondary hide/delete actions | Existing optional inline editor and Details disclosure cover the same job without adding a second overlay or destructive planning action. |
| [Linear date picker, web](https://mobbin.com/screens/38362b03-3661-4e35-807a-e504a0a0b1b6) | Named month, calendar selection and explicit apply/cancel | Retain existing keyboard-operable custom calendar and review before recurring-term commit. Two-month display is unnecessary for monthly costs. |
| [Linear empty search, web](https://mobbin.com/screens/d0b98680-66e2-47d4-9dc4-28bc9450c27f) | Plain no-results message tied to the query | New conversation search and friend filtering show explicit empty results without illustration, fake suggestions or a model request. |
| [Cleo chat loading, iOS](https://mobbin.com/screens/16d3880b-76a5-4af1-89a8-6b5b87680270) | Pending assistant response indicator above composer | Existing tool/loading status remains; do not add fabricated progress, decorative chat wallpaper or lending navigation. |
| [ChatGPT image composer, web](https://mobbin.com/screens/fa37370a-0355-451d-a3a4-c3d6ba9a90a5) | Attachment preview and image prompts | Excluded: receipt/image input is outside this task; adding a nonfunctional attachment affordance would mislead. Search result did not show the requested open menu. |
| [ChatGPT personalization menu, web](https://mobbin.com/screens/1d342988-8bfa-4563-bf95-13e78807f2fe) | Selected option checkmark and secondary text | Existing Select primitive already supplies selected state. Excluded from composer redesign because this is a settings screen, not a composer tool menu. |

## Element coverage

- Navigation: conversation list, search, archived results and profile row.
- Conversation: text input, send state, manual action popover, tool/loading status, pending/saved/discarded/superseded cards and expandable details.
- Money: expense rows, balances, repayment rows/status, view navigation and search.
- People: friend search, identity rows, reciprocal relationship state, invitation link and access disclosure.
- Planning: before/after category allocation, recurring dates, optional editing and explicit reviewed confirmation.
- Shared controls: buttons, selected states, custom selects, calendar, dialogs, disclosure, focus return, empty results, copy feedback, errors/retry and disabled states.

Adopted changes are intentionally limited to missing behaviors. Existing components remain where the inspected pattern already matches. Mobile references inform compact row structure; SplitFlow remains a responsive web application with semantic HTML and existing Radix primitives.

## Behavior and maintenance

Search uses records already loaded and authorized for the signed-in account; it does not query private message content or call OpenAI. Activity results use the existing owner-scoped thread resolver. Archived results are labeled and opening them does not restore them. Earlier private threads remain under Earlier conversations. Search state is ephemeral.

Composer menu is a non-modal Popover with accessible button items, collision handling, Escape/outside dismissal and focus restoration. Existing custom Select nesting retains its own focus behavior. Opening a manual form preserves composer text and existing drafts. All mutations still use current command services and reviewed proposals.

## Validation

Typecheck, lint, 323 unit/API tests (3 environment-specific tests skipped), and production build pass. Browser regressions cover search/empty results, keyboard selection, switching from the mobile drawer, composer dismissal/focus return/draft preservation, friend filtering, share access disclosure, profile selection and recurring calendar keyboard use. Sharing layout is exercised at 320, 375, 768 and 1440 pixels. Local rendered search and friend filtering were also inspected directly. The initial development-server profile test was obstructed by the Next.js development overlay; the production-build check exercises the actual control without suppressing product errors.
