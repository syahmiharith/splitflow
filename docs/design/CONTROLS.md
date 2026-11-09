# Conversation-first controls

The controls support the existing activity conversation. They do not introduce a dashboard, additional review step or separate manual destination.

## Mobbin references inspected

- [ChatGPT model menu](https://mobbin.com/screens/83ee2b5a-1692-4041-896b-67d85ac1696d): a quiet inline trigger, compact floating surface, selected checkmark and understated row hover. Applied to composer destination and the sample-person switcher; longer form choices use the same menu with a full-width trigger.
- [Linear target-date picker](https://mobbin.com/screens/cbdd5350-87f5-4304-8f13-93bc72275348): an anchored single-month calendar and small navigation controls. Applied to recurring-cost start dates, retaining ISO dates and the existing period calculations.
- [Linear confirmation](https://mobbin.com/screens/c4e6a99e-5c6f-4d93-894a-f566b758608b): a compact focused surface with a clear title, short explanation and nearby actions. Applied to sign-in and legacy review dialogs; activity reviews remain inline.

## Contract

Neutral white surfaces, subtle borders/shadows, visible selected state, 44px touch menu rows, width constrained to the viewport, and no branded assets copied. Advanced controls remain behind Enter manually. Date selection uses local calendar dates without timezone conversion. Escape dismisses without changing the selection; selecting a value returns focus to its trigger. Dialogs trap focus, restore it on close and prevent dismissal during existing busy operations. Navigation remains a narrow drawer.

Custom selects preserve controlled values, empty optional selections, disabled choices and native FormData through a hidden input. Radix primitives supply listbox behavior, type-ahead, collision avoidance and focus management. The calendar supports arrow keys, Home/End, Page Up/Down, Enter and Escape. No changes to deterministic money, permissions, confirmation or persistence services.

Browser constraint validation remains enforced, but errors render next to the field and are linked through aria-describedby instead of opening browser-native bubbles. Existing server errors stay inline.

Validation: typecheck, lint, production build, 275 unit/API tests and 52 desktop/mobile browser checks passed (18 environment-specific browser checks skipped). Focused checks cover nested drawer selection, type-ahead, focus return, calendar keyboard navigation and inline validation. Sixteen responsive states (four controls at 320/375/768/1440px) have no horizontal overflow or uncaught browser errors. The Select and Popover versions are aligned with the existing Dialog primitive to share a single focus-scope stack.

## Current audit

See [Mobbin control audit](MOBBIN-CONTROL-AUDIT.md) for the November 10 reference inventory, retained patterns and conversation search, manual menu, friend filtering and sharing refinements.
