import { describe, expect, it } from "vitest";
import { applyPrototypeAdjustment, createJejuTripProposal, recalculateProposal } from "@/lib/prototype-proposals";

describe("prototype proposal recalculation", () => {
  it("excludes Alex from Friday lodging after an accepted change request", () => {
    const base = createJejuTripProposal();
    const proposal = recalculateProposal({
      ...base,
      costItems: base.costItems.map((item) => (item.id === "friday-airbnb" ? { ...item, excludedParticipantIds: undefined } : item))
    });
    const beforeAlexShare = proposal.calculationResult?.itemizedBreakdown.find((item) => item.itemId === "friday-airbnb")?.shareByParticipant.alex;

    const adjusted = applyPrototypeAdjustment(
      {
        ...proposal,
        status: "changes_requested",
        participants: proposal.participants.map((participant) =>
          participant.id === "alex" ? { ...participant, status: "requested_changes", changeRequestNote: "Alex is only joining Saturday night" } : participant
        )
      },
      "Alex is only joining Saturday night"
    );

    const fridayAirbnb = adjusted.proposal.calculationResult?.itemizedBreakdown.find((item) => item.itemId === "friday-airbnb");

    expect(beforeAlexShare).toBeGreaterThan(0);
    expect(adjusted.changed).toBe(true);
    expect(fridayAirbnb?.eligibleParticipantIds).not.toContain("alex");
    expect(fridayAirbnb?.shareByParticipant.alex).toBeUndefined();
    expect(adjusted.proposal.calculationResult?.fairShareByParticipant.alex).toBeLessThan(
      adjusted.proposal.calculationResult?.fairShareByParticipant.mina ?? 0
    );
  });
});
