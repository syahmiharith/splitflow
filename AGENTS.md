# SplitFlow Agent Instructions

## Product Direction

SplitFlow is a production-style AI split agreement dashboard.

It helps an organizer turn a messy group expense into an explicit shared-cost proposal, send it to participants, track responses, recalculate fair shares, resolve disputes, and decide whether it is safe to pay, book, or collect.

The product should feel like:

- Splitwise for group money coordination
- ChatGPT for natural-language split creation
- An operations dashboard for agreement tracking
- A proposal/review workflow, not just an expense calculator

The core product loop is:

```text
Messy input
→ structured expense proposal
→ deterministic split calculation
→ participant review
→ accept / request change / opt out
→ organizer tracks responses
→ safe settlement decision
```

## Non-Negotiable Implementation Rules

### Preserve deterministic money logic

Money math must stay in deterministic, typed application logic.

AI may:

* draft proposals
* classify expense type
* explain split reasoning
* suggest next actions
* summarize participant objections

AI must not be the source of truth for:

* split calculation
* rounding
* net settlement
* status transitions
* participant eligibility
* reconfirmation logic
* risk/safety checks
* final amount owed
* payment readiness decisions

All monetary calculations must be implemented in TypeScript utility/domain functions with tests where possible.

### Keep OpenAI usage server-side only

OpenAI API usage must stay server-side only.

Never expose:

* `OPENAI_API_KEY`
* server-only prompts
* raw AI tool responses
* hidden chain/system prompts
* sensitive environment variables

Do not print secrets in:

* client components
* logs
* rendered HTML
* error messages
* test output
* README examples

### Preserve current app boundaries

Use:

* Next.js App Router
* TypeScript
* Tailwind CSS
* custom components

Do not add:

* shadcn/ui
* another UI framework
* real payment processing
* real authentication
* real push notifications
* production database
* external billing provider
* unnecessary backend services

This version is a prototype/MVP with production-style architecture, not a production financial system.

### Maintain existing behavior

When editing the codebase:

* Preserve existing routes unless they are already broken.
* Preserve existing business logic.
* Preserve existing data shape where possible.
* Preserve important `data-testid` attributes.
* Preserve working tests.
* Do not refactor unrelated code.
* Do not rewrite the app architecture for visual changes.
* Do not hardcode the full app into one component if reusable structure already exists.

## Product Model

SplitFlow should model these main entities:

* Group
* Proposal
* Expense item
* Participant
* Split rule
* Participant response
* Change request
* Payment/settlement status
* Agent workflow step
* Risk/action queue item

The app should support different proposal types through shared workflow templates:

```text
Food → item-level receipt split
Travel → trip ledger and settlement
Subscription → recurring collection
Bills → due-date household split
```

Do not build four separate apps. Use one shared proposal workflow with category-specific UI sections.

## Agent Workflow Contract

The UI may present SplitFlow as a multi-agent system, but the user should primarily interact with one main assistant.

Recommended agent roles:

* Intake Agent
* Cost Agent
* Split Agent
* Fairness Agent
* Proposal Agent
* Participant Agent
* Reminder Agent
* Resolution Agent

The visible agent workflow should be compact and operational. It should show what the system has understood and what still needs action.

Example workflow:

```text
Intake Agent       → understood event and participants
Cost Agent         → parsed cost items
Split Agent        → calculated deterministic split
Fairness Agent     → generated explanation
Participant Agent  → waiting to send proposal
```

Agent names may be made more user-friendly on mobile, but naming must stay consistent across the app.

## Required UX Direction

The UI must be:

* dense
* calm
* operational
* trustworthy
* mobile-first
* easy to scan
* action-oriented

The UI must not feel like:

* a landing page
* a marketing site
* a playful finance app
* a generic chatbot
* a static mockup

Avoid:

* hero sections
* marketing copy
* decorative gradients
* random illustrations
* heavy shadows
* oversized cards
* excessive animations
* unnecessary nested cards

## Visual Contract

Use this visual system consistently.

```text
Page background:     #f8fafc or #f7f8fa
Surface background:  #ffffff
Borders:             #dfe3e8
Main text:           #18212f
Muted text:          #667085
Accent blue:         #2563eb
Success:             #15803d
Warning:             #d97706
Danger:              #dc2626
```

Radius:

```text
Desktop/tablet: 6px–8px for most UI
Mobile cards: 12px–16px acceptable where needed
```

Use:

* clear 1px borders
* restrained shadows only when helpful
* compact spacing
* readable typography
* lucide-react icons where useful
* stable dimensions for nav, headers, cards, badges, tables, and panels

## Core Screens

### 1. Chat / AI Split Agent

This is the primary product surface.

The user should be able to describe a split naturally, then receive a structured draft proposal.

The chat screen should include:

* assistant message bubbles
* user message bubbles
* draft proposal card
* agent workflow summary
* review/send actions
* chat input

The assistant should feel like it is operating the workflow, not merely chatting.

### 2. Proposal Review

The organizer must review before sending.

Show:

* proposal summary
* total amount
* participants
* split method
* cost items
* participant breakdown
* special rules
* fairness explanation
* deterministic calculated amounts
* actions to edit, ask AI, or send

### 3. Participant Proposal Review

This screen is for a participant who receives a proposal.

It must clearly answer:

* Who sent this?
* What is this for?
* How much do I owe?
* Why am I paying this?
* What items am I included in?
* What can I do next?

Required participant actions:

* Accept
* Request change
* Opt out
* Ask AI why
* Mark as paid, if already supported

### 4. Dashboard

The dashboard should be action-first.

Prioritize:

* active proposals
* pending responses
* requested changes
* unpaid participants
* amount still owed
* risk/action queue
* quick actions

Avoid vanity metrics that do not help the organizer act.

### 5. Proposals

The proposals screen should show active, draft, sent, recurring, and paid proposals.

Cards should show:

* title
* category
* total
* participants/members
* split method
* status
* progress
* response summary
* next action

### 6. Groups

Groups should represent recurring split contexts such as:

* BBQ Crew
* Housemates
* Jeju Trip
* Netflix Family

Group cards should show:

* member count
* active proposals
* unpaid bills
* outstanding amount
* last activity
* status badge
* primary action

### 7. Analytics

Analytics should stay lightweight.

It should answer:

* How much did I pay upfront?
* How much did I recover?
* How much am I still owed?
* Which groups respond slowly?
* Who often requests changes?
* Which split methods cause disputes?

Do not turn this into a complex finance dashboard.

## Mobile UX Contract

Mobile is a first-class surface.

Use:

* fixed/sticky top header
* bottom navigation for primary screens
* single-column layout
* cards instead of dense desktop tables
* accordions for secondary details
* full-width primary actions
* safe-area padding
* no horizontal overflow

Bottom nav should include:

* Chat
* Dashboard
* Proposals
* Groups
* Analytics

Proposal Review may hide bottom nav to keep the decision flow focused.

Mobile must pass these checks:

* no text overlap
* no clipped buttons
* no content hidden behind bottom nav
* no broken long names
* no broken currency values
* no accidental horizontal scrolling
* all touch targets at least 44px where possible

## Component Guidance

Prefer improving existing components before creating new ones.

Useful shared components may include:

* AppShell
* AppHeader
* BottomNav
* Sidebar
* Card
* Button
* Badge
* StatusBadge
* KpiCard
* ProposalCard
* ParticipantRow
* AgentWorkflow
* AgentStep
* ActionQueue
* EmptyState
* Accordion
* ChatBubble
* ChatInput

Keep component APIs stable when tests or other files depend on them.

## Tailwind Guidance

Use Tailwind CSS consistently.

Avoid long unreadable class strings when a component becomes complex. Extract repeated visual patterns into small reusable components.

Do not add shadcn or another UI framework.

Use responsive Tailwind patterns for:

* mobile default
* tablet `md:`
* desktop `lg:`

Use `min-w-0`, `truncate`, `overflow-hidden`, and `break-words` carefully to prevent layout bugs.

Do not truncate critical values like money amounts unless absolutely necessary.

## Data and State Rules

For this version:

* mock data is acceptable
* local deterministic state is acceptable
* server actions/API routes are acceptable if already used
* no production database
* no real auth
* no real payment settlement
* no real push notifications

If a feature appears to require real infrastructure, simulate it safely with typed mock/state behavior.

Examples:

* “Send proposal” can update local/mock proposal status.
* “Accept” can update participant response.
* “Request change” can create a mock change request.
* “Remind” can create a mock activity event.
* “Mark as paid” can update payment status.

## Risk and Safety Logic

The app should help the organizer decide whether it is safe to proceed.

Risk logic should be deterministic.

Examples of risk signals:

* participant requested changes
* important participants have not responded
* amount changed after proposal was sent
* too many participants opted out
* payment not confirmed
* recurring bill is overdue
* split has unresolved special rules

AI may explain the risk, but deterministic code decides the risk level.

## Testing and Validation

Before considering work complete, run relevant checks.

Required when applicable:

```bash
npm run lint
npm run test
npm run build
```

If the project uses different commands, inspect `package.json` and use the correct scripts.

For UI work, inspect at minimum:

* desktop width
* tablet width
* mobile width around 375px

Check these screens if present:

* Chat / AI Split Agent
* Dashboard
* Proposals
* Proposal detail/review
* Participant proposal review
* Groups
* Analytics

UI validation checklist:

* no horizontal overflow
* no overlapping text
* no clipped buttons
* no broken badges
* no hidden bottom content
* no layout shift from changing statuses
* all major actions are clickable
* active nav state works
* empty/loading/error states are acceptable
* production build passes

## Final Response Format

When completing a coding task, respond with a compact audit only:

```text
- Status
- Files changed
- Checks run
- Issues fixed
- Remaining risks
```
