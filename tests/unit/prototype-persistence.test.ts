import { beforeEach, describe, expect, it } from "vitest";
import { getProposalById, getProposals, resetDemoData, saveProposal, updateParticipantResponse } from "@/lib/prototype-persistence";
import { createBbqProposalFromPrompt } from "@/lib/prototype-proposals";

describe("prototype persistence helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDemoData();
  });

  it("saves and loads proposals", () => {
    const proposal = createBbqProposalFromPrompt(
      "BBQ dinner for 8. Syahmi paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef."
    );
    expect(proposal).toBeDefined();
    saveProposal(proposal!);

    expect(getProposalById(proposal!.id)?.title).toBe("BBQ Dinner");
    expect(getProposals()[0].id).toBe(proposal!.id);
  });

  it("updates participant responses", () => {
    const proposal = createBbqProposalFromPrompt(
      "BBQ dinner for 8. Syahmi paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef."
    )!;
    saveProposal(proposal);

    const updated = updateParticipantResponse(proposal.id, "daniel", "requested_changes", "I did not eat beef");

    expect(updated?.participants.find((participant) => participant.id === "daniel")?.status).toBe("requested_changes");
    expect(getProposalById(proposal.id)?.participants.find((participant) => participant.id === "daniel")?.changeRequestNote).toBe("I did not eat beef");
  });

  it("resets demo state", () => {
    resetDemoData();
    expect(getProposals()[0].id).toBe("bbq-dinner");
  });
});
