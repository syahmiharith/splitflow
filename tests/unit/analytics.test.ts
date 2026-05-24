import { describe, expect, it } from "vitest";
import { deriveActiveWorkflows, deriveGlobalAnalytics, deriveGlobalNextAction, deriveGroupAnalytics } from "@/lib/analytics";
import { defaultGroup } from "@/lib/demo-data";
import { updatePaymentRecordStatus } from "@/lib/prototype-proposals";
import type { Proposal } from "@/lib/types";

describe("derived analytics", () => {
  it("derives group analytics from proposal state", () => {
    const summary = deriveGroupAnalytics(defaultGroup);

    expect(summary.activeProposals).toBe(1);
    expect(summary.openChangeRequests).toBe(0);
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

  it("prioritizes global next action by agreement risk", () => {
    const baseProposal = defaultGroup.proposals[0];
    const claimed = {
      ...baseProposal,
      id: "claimed-payment",
      title: "Claimed Payment Split",
      participants: baseProposal.participants.map((participant) => ({ ...participant, status: "pending" as const, changeRequestNote: undefined }))
    };
    const changed = {
      ...baseProposal,
      id: "changed-split",
      title: "Changed Split",
      paymentRecords: [],
      participants: baseProposal.participants.map((participant) =>
        participant.id === "daniel"
          ? { ...participant, status: "requested_changes" as const, changeRequestNote: "Exclude Daniel from meat." }
          : { ...participant, status: "pending" as const, changeRequestNote: undefined }
      )
    };

    const action = deriveGlobalNextAction([{ ...defaultGroup, proposals: [claimed, changed] }]);

    expect(action?.priority).toBe("high");
    expect(action?.proposalId).toBe("changed-split");
    expect(action?.title).toContain("Daniel requested a change");
  });

  it("derives active workflows with blockers and next actions", () => {
    const workflows = deriveActiveWorkflows([defaultGroup]);

    expect(workflows[0].groupName).toBe(defaultGroup.name);
    expect(workflows[0].proposalTitle).toBe(defaultGroup.proposals[0].title);
    expect(workflows[0].nextAction).toBeTruthy();
    expect(workflows[0].responseProgress.label).toContain("confirmed");
  });

  it("defensively handles partial calculation, payment, and timeline state", () => {
    const proposal = {
      ...defaultGroup.proposals[0],
      calculationResult: {
        fairShareByParticipant: { daniel: 6858 },
        netBalanceByParticipant: {},
        itemizedBreakdown: []
      },
      paymentRecords: undefined,
      timeline: undefined
    } as unknown as Proposal;

    const summary = deriveGlobalAnalytics([{ ...defaultGroup, proposals: [proposal] }]);

    expect(summary.stillOwed).toBe(0);
    expect(summary.claimedUnconfirmedCredits).toBe(0);
    expect(summary.recentActivity).toEqual([]);
  });
});
