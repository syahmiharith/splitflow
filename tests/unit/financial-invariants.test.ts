import { describe, expect, it } from "vitest";
import { calculateItemizedSplit } from "@/lib/domain/itemized-split-engine";
import {
  canMarkReadyToPay,
  findConflictingPaymentClaims,
  hasUnresolvedPaymentClaims,
  validateProposalFinancialInvariants
} from "@/lib/domain/financial-invariants";
import { deriveSplitReadiness } from "@/lib/readiness";
import { createHanRiverBbqProposal, createProposalFromPrompt, recalculateProposal } from "@/lib/prototype-proposals";
import type { PaymentRecord, Proposal } from "@/lib/types";

function codes(proposal: Proposal) {
  return validateProposalFinancialInvariants(proposal).map((violation) => violation.code);
}

function withEveryoneAccepted(proposal: Proposal): Proposal {
  return {
    ...proposal,
    status: "safe_to_book",
    participants: proposal.participants.map((participant) => ({ ...participant, status: "accepted" }))
  };
}

function confirmedPaymentRecords(proposal: Proposal): PaymentRecord[] | undefined {
  return proposal.paymentRecords?.map((record) => ({
    ...record,
    status: "confirmed" as const,
    confirmedAt: "2026-05-26T00:00:00.000Z",
    confirmedBy: "Organizer"
  }));
}

describe("financial invariants", () => {
  it("keeps participant shares equal to the expense total after deterministic rounding", () => {
    const first = calculateItemizedSplit({
      currency: "KRW",
      participants: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" }
      ],
      items: [{ id: "snacks", label: "Snacks", amount: 10000, paidByParticipantId: "a" }]
    });
    const second = calculateItemizedSplit({
      currency: "KRW",
      participants: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" }
      ],
      items: [{ id: "snacks", label: "Snacks", amount: 10000, paidByParticipantId: "a" }]
    });

    expect(Object.values(first.fairShareByParticipant).reduce((sum, amount) => sum + amount, 0)).toBe(10000);
    expect(first.fairShareByParticipant).toEqual(second.fairShareByParticipant);
    expect(first.roundingAdjustments).toEqual(second.roundingAdjustments);
  });

  it("blocks payment readiness while a participant payment claim is unresolved", () => {
    const proposal = withEveryoneAccepted(createHanRiverBbqProposal());
    const readiness = deriveSplitReadiness(proposal);

    expect(hasUnresolvedPaymentClaims(proposal)).toBe(true);
    expect(readiness).toMatchObject({
      state: "needs_review",
      nextAction: "Confirm payment claim"
    });
    expect(codes(proposal)).toContain("unresolved_claim_ready");
    expect(canMarkReadyToPay(proposal)).toBe(false);
  });

  it("allows readiness once all participants accepted and claimed payments are confirmed", () => {
    const proposal = recalculateProposal({
      ...withEveryoneAccepted(createHanRiverBbqProposal()),
      paymentRecords: confirmedPaymentRecords(createHanRiverBbqProposal())
    });

    expect(codes(proposal)).toEqual([]);
    expect(deriveSplitReadiness(proposal)).toMatchObject({
      state: "ready",
      nextAction: "Mark settled"
    });
    expect(canMarkReadyToPay(proposal)).toBe(true);
  });

  it("keeps opt-out recalculation in needs-review until remaining participants reconfirm", () => {
    const base = withEveryoneAccepted(createHanRiverBbqProposal());
    const recalculated = recalculateProposal({
      ...base,
      status: "needs_reconfirmation",
      participants: base.participants.map((participant) =>
        participant.id === "minji"
          ? { ...participant, status: "opted_out", shareAmount: 0, paymentStatus: "review" }
          : { ...participant, status: "needs_reconfirmation", paymentStatus: "review" }
      ),
      costItems: base.costItems.map((item) => ({
        ...item,
        excludedParticipantIds: Array.from(new Set([...(item.excludedParticipantIds ?? []), "minji"]))
      })),
      paymentRecords: confirmedPaymentRecords(base)
    });

    expect(deriveSplitReadiness(recalculated)).toMatchObject({
      state: "needs_review",
      nextAction: "Review blockers"
    });
    expect(codes(recalculated)).not.toContain("unresolved_claim_ready");
  });

  it("requires AI-parsed proposal data to reconcile through deterministic validation", () => {
    const { proposal } = createProposalFromPrompt(
      "Movie night: I paid 72,000 for tickets and 24,000 for snacks. Daniel skipped snacks. Sarah already paid me 10,000.",
      "movie-group"
    );
    expect(proposal).toBeDefined();
    expect(codes(proposal!)).not.toContain("share_total_mismatch");
    expect(codes(proposal!)).not.toContain("net_balance_mismatch");

    const tampered: Proposal = {
      ...proposal!,
      calculationResult: {
        ...proposal!.calculationResult!,
        fairShareByParticipant: {
          ...proposal!.calculationResult!.fairShareByParticipant,
          you: (proposal!.calculationResult!.fairShareByParticipant.you ?? 0) + 1
        }
      }
    };

    expect(codes(tampered)).toContain("share_total_mismatch");
  });

  it("flags conflicting unresolved claims as a needs-review condition", () => {
    const base = withEveryoneAccepted(createHanRiverBbqProposal());
    const record = base.paymentRecords?.[0];
    if (!record) throw new Error("Expected seeded payment record.");
    const proposal: Proposal = {
      ...base,
      paymentRecords: [
        { ...record, id: "sarah-claim-a", amount: 10000, status: "claimed" },
        { ...record, id: "sarah-claim-b", amount: 12000, status: "disputed" }
      ]
    };

    expect(findConflictingPaymentClaims(proposal)).toHaveLength(2);
    expect(codes(proposal)).toEqual(expect.arrayContaining(["conflicting_payment_claims", "unresolved_claim_ready"]));
    expect(deriveSplitReadiness(proposal).state).toBe("needs_review");
  });

  it("flags floating-point money values before they can be treated as safe", () => {
    const proposal: Proposal = {
      ...withEveryoneAccepted(createHanRiverBbqProposal()),
      totalCost: 128000.5
    };

    expect(codes(proposal)).toContain("money_not_integer");
  });
});
