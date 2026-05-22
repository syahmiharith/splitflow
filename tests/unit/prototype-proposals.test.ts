import { describe, expect, it } from "vitest";
import { applyPrototypeAdjustment, createBbqProposalFromPrompt } from "@/lib/prototype-proposals";

const bbqPrompt =
  "BBQ dinner for 8. Syahmi paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000.";

describe("prototype proposal recalculation", () => {
  it("excludes Daniel from beef after an accepted change request", () => {
    const proposal = createBbqProposalFromPrompt(bbqPrompt)!;
    const beforeDanielShare = proposal.calculationResult?.itemizedBreakdown.find((item) => item.itemId === "meat")?.shareByParticipant.daniel;

    const adjusted = applyPrototypeAdjustment(
      {
        ...proposal,
        status: "changes_requested",
        participants: proposal.participants.map((participant) =>
          participant.id === "daniel" ? { ...participant, status: "requested_changes", changeRequestNote: "I did not eat beef" } : participant
        )
      },
      "I did not eat beef"
    );

    const meat = adjusted.proposal.calculationResult?.itemizedBreakdown.find((item) => item.itemId === "meat");

    expect(beforeDanielShare).toBeGreaterThan(0);
    expect(adjusted.changed).toBe(true);
    expect(meat?.eligibleParticipantIds).not.toContain("daniel");
    expect(meat?.shareByParticipant.daniel).toBeUndefined();
    expect(adjusted.proposal.calculationResult?.fairShareByParticipant.daniel).toBeLessThan(
      adjusted.proposal.calculationResult?.fairShareByParticipant.aiman ?? 0
    );
  });
});
