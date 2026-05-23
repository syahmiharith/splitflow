import { describe, expect, it } from "vitest";
import { deriveGlobalAnalytics, deriveGroupAnalytics } from "@/lib/analytics";
import { defaultGroup } from "@/lib/demo-data";
import { updatePaymentRecordStatus } from "@/lib/prototype-proposals";

describe("derived analytics", () => {
  it("derives group analytics from proposal state", () => {
    const summary = deriveGroupAnalytics(defaultGroup);

    expect(summary.activeProposals).toBe(1);
    expect(summary.openChangeRequests).toBeGreaterThan(0);
    expect(summary.pendingResponses).toBeGreaterThan(0);
    expect(summary.stillOwed).toBeGreaterThan(0);
  });

  it("derives global analytics across groups without owning proposal state", () => {
    const settledProposal = { ...defaultGroup.proposals[0], status: "settled" as const };
    const secondGroup = { ...defaultGroup, id: "settled-group", name: "Settled Group", proposals: [settledProposal] };
    const summary = deriveGlobalAnalytics([defaultGroup, secondGroup]);

    expect(summary.activeGroups).toBe(2);
    expect(summary.openProposals).toBe(1);
    expect(summary.recentActivity[0].groupId).toBeTruthy();
  });

  it("tracks claimed and confirmed credit ledger totals", () => {
    const proposal = {
      ...defaultGroup.proposals[0],
      paymentRecords: [
        {
          id: "credit-1",
          groupId: defaultGroup.id,
          proposalId: defaultGroup.proposals[0].id,
          fromParticipantId: "daniel",
          toParticipantId: "you",
          amount: 1000,
          currency: "KRW" as const,
          kind: "prior_payment" as const,
          status: "claimed" as const,
          createdAt: new Date().toISOString()
        }
      ]
    };
    const claimedSummary = deriveGroupAnalytics({ ...defaultGroup, proposals: [proposal] });
    const confirmed = updatePaymentRecordStatus(proposal, "credit-1", "confirmed");
    const confirmedSummary = deriveGroupAnalytics({ ...defaultGroup, proposals: [confirmed] });

    expect(claimedSummary.claimedUnconfirmedCredits).toBe(1000);
    expect(claimedSummary.confirmedPayments).toBe(0);
    expect(confirmedSummary.claimedUnconfirmedCredits).toBe(0);
    expect(confirmedSummary.confirmedPayments).toBe(1000);
  });
});
