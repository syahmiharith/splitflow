# Messy Prompt Examples

These examples show how SplitFlow turns ambiguous shared-cost language into structured agreement state. The parser or AI-assisted layer can interpret the prompt, but deterministic code owns the calculation, validation, and readiness decision.

## Example 1: BBQ With Exclusions And Claimed Payment

### Messy user prompt

```txt
We ordered BBQ for 128,000 KRW. Aina only had drinks, Faris skipped dessert, I paid the deposit separately, and service charge was included. Sarah says she already sent 10,000, but I need to confirm it.
```

### AI-parsed interpretation

- Shared BBQ proposal.
- Total is 128,000 KRW, including service charge.
- Aina should only be eligible for drink-related items if item allocation is clear.
- Faris should be excluded from dessert.
- Organizer paid at least part of the cost.
- Sarah's 10,000 KRW is a claimed payment, not confirmed money.

### Deterministic calculation responsibility

- Item amounts and eligibility must be converted into deterministic `CostItem` records.
- The itemized split engine calculates eligible shares.
- Confirmed payments adjust net balances.
- Claimed payments stay unresolved until organizer confirmation.

### Resulting proposal/status

- If item amounts are clear: draft proposal with item eligibility and claimed-payment warning.
- If item amounts are ambiguous: needs clarification or allocation review.
- Readiness is blocked until Sarah's claim is confirmed, disputed, or voided.

### Safety note

The app should not let the AI guess how much "only had drinks" means unless the drink item is modeled. Ambiguous item allocation must stay in review.

## Example 2: Han River BBQ Before Organizer Fronts Money

### Messy user prompt

```txt
I'm organizing a Han River BBQ for 8 people and need agreement before I front 128,000 won. Meat is 80k, drinks 20k, charcoal 10k, sides 18k. Daniel does not eat beef. Sarah already sent me 10,000 but I need to confirm it. Ali may request a change if his share goes above 20,000.
```

### AI-parsed interpretation

- Proposal type: meal / BBQ.
- Organizer needs participant agreement before spending.
- Itemized costs total 128,000 KRW.
- Daniel is excluded from meat.
- Sarah has a claimed prior payment.
- Ali has a risk note related to fairness threshold.

### Deterministic calculation responsibility

- Meat is split only among eligible participants.
- Drinks, charcoal, and sides are split among active eligible participants.
- Rounding adjustments are recorded.
- Sarah's claim is not counted as confirmed payment unless the organizer confirms it.
- Readiness remains blocked while the claim is unresolved.

### Resulting proposal/status

- Draft proposal with deterministic itemized calculation.
- Participant review required.
- Payment readiness is not available until active participants accept and the claimed payment is resolved.

### Safety note

This is the core product proof: AI structures the agreement, but deterministic state and money logic decide whether it is safe to proceed.

## Example 3: Trip Lodging With Partial Attendance

### Messy user prompt

```txt
We booked a Jeju Airbnb. Friday night was 210,000, Saturday was 210,000, cleaning was 60,000, and Sarah paid a 90,000 van deposit. Alex only joins Saturday night.
```

### AI-parsed interpretation

- Proposal type: travel.
- Friday lodging excludes Alex.
- Saturday lodging includes Alex.
- Cleaning fee is shared unless a rule says otherwise.
- Sarah is a payer for the van deposit.

### Deterministic calculation responsibility

- Friday Airbnb eligibility excludes Alex.
- Saturday Airbnb eligibility includes Alex.
- Sarah's paid amount is represented in paid-by totals.
- Net settlement instructions reimburse fronting participants.

### Resulting proposal/status

- Draft travel proposal with item-level eligibility.
- If sent and later changed, affected participants need reconfirmation.

### Safety note

Partial attendance is a state and eligibility problem, not a text-generation problem. The final shares come from itemized deterministic calculation.

## Example 4: Claim Conflict After Proposal

### Messy user prompt

```txt
Sarah said she already paid 10,000 earlier, but now she says it was 12,000. I cannot tell which one is correct from the chat.
```

### AI-parsed interpretation

- Sarah has conflicting payment claims.
- The organizer needs to review proof or decide which claim to confirm.

### Deterministic calculation responsibility

- Both claims remain unresolved until the organizer confirms, disputes, or voids records.
- Conflicting unresolved claims must block ready-to-pay.
- Confirmed claim changes should recalculate net settlement.

### Resulting proposal/status

- Needs review / unsafe to finalize.
- Not ready to pay.

### Safety note

SplitFlow should never treat a participant's statement as confirmed money by default.
