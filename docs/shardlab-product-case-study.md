# SplitFlow: ShardLab 1-page Product Case Study

## Part 1 - Find a Moment

The moment I chose is organizing a Han River BBQ for 8 friends before the organizer fronts ₩128,000 for supplies.

This is not just "splitting food costs." It is a specific agreement problem: Syahmi is about to buy meat, drinks, charcoal, and sides for the group, but Daniel does not eat beef, Sarah says she already sent ₩10,000, and Ali may object if his share goes above ₩20,000. If Syahmi buys first and asks later, the split can become a social negotiation after money is already spent.

## Part 2 - Define the Problem

The primary user is the recurring group organizer who pays first because someone has to make the plan real. They are not a finance power user. They are a friend trying to avoid becoming the debt collector.

Today, this person usually handles the split through group chat, mental math, spreadsheets, screenshots, and payment-app reminders. That workaround fails because the agreement state is scattered:

- Cost items live in chat messages.
- Exclusions are remembered informally.
- "I already paid" claims are mixed with confirmed payments.
- People accept different versions of the split.
- The organizer has no clear signal for whether it is safe to buy, book, or collect.

The emotional cost matters as much as the functional one. The organizer feels exposed because they are fronting money and may need to chase friends. Participants feel defensive if they are asked to pay for items they did not consume or terms they did not agree to. The product opportunity is to make the agreement explicit before money creates friction.

## Part 3 - Working Prototype

SplitFlow turns a messy organizer prompt into an agreement workflow.

In the prototype, a reviewer can:

1. Enter a natural-language BBQ prompt in Chat.
2. Watch the inline agent workflow parse, validate, calculate, and create a proposal artifact without leaving the conversation.
3. Open one proposal artifact bundle instead of sorting through separate parser, math, settlement, and ledger cards.
4. Review a structured proposal with itemized costs and participant shares.
5. See deterministic math for Daniel's meat exclusion.
6. Track Sarah's ₩10,000 as a claimed payment until the organizer confirms it.
7. Re-submit the same prompt and see the artifact update/reuse behavior instead of duplicate clutter.
8. Send the proposal for participant review.
9. Switch into a participant view and accept, request a change, opt out, ask why, or mark as paid.
10. Return to the organizer dashboard to see blockers, response progress, and settlement readiness.

The most important product decision is that AI does not calculate final money. AI helps parse and explain. Typed TypeScript domain logic owns split calculation, rounding, eligibility, payment-claim effects, and readiness. That keeps the product trustworthy in the part of the workflow where mistakes damage relationships.

The most important interaction decision is that the agent work is visible but not noisy. The workflow appears inline in the chat transcript, and the output resolves into one proposal artifact bundle with Review, Math, Settlement, Ledger, and Warnings. That makes the prototype feel like an agreement workflow rather than a chatbot that throws disconnected files into a sidebar.

## AI tools used

I used Codex as an AI-assisted development tool while building SplitFlow. It helped with implementation planning, refactoring suggestions, UI iteration, test updates, and documentation critique. I used it to move faster and pressure-test decisions, not to outsource the product judgment.

What was easy with AI support: exploring edge cases, generating implementation options, drafting test coverage, and iterating on UI surfaces.

What required my judgment: keeping the product from becoming a generic chatbot or generic dashboard. I evaluated suggestions against the real user moment: the organizer needs confidence before paying. I also rejected any direction where AI would become the source of truth for money, because trust in this product depends on auditable deterministic logic.

## Part 4 - Validation Plan

The first validation test should be with people who regularly organize small group events: BBQs, trips, house dinners, birthday gifts, or shared subscriptions.

I would test one question first: would they use an agreement proposal before paying, or do they only care about collecting after the fact?

Useful signals:

- The organizer can describe a recent painful split without prompting.
- They understand the proposal in under one minute.
- They notice the inline workflow and trust that the system did structured work before showing an answer.
- They understand that one artifact bundle is the current proposal, not five unrelated outputs.
- They say they would send it before buying or booking.
- Participants say the explanation makes the amount feel fair.
- The organizer notices the difference between claimed and confirmed payment.

Disconfirming signals:

- Organizers say the setup is more effort than group chat.
- Participants ignore the proposal and still negotiate in chat.
- The readiness state does not change the organizer's decision to buy or wait.

If the signal is positive, I would test adjacent moments next: trip deposits, shared subscriptions, and rent/bills. The roadmap should expand from one strong agreement workflow, not from a generic expense app with many shallow categories.
