import { beforeEach, describe, expect, it } from "vitest";
import { getDemoState, getProposalById, getProposals, resetDemoData, saveProposal, SPLITFLOW_STORAGE_KEY, updateParticipantResponse } from "@/lib/prototype-persistence";
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
    window.localStorage.setItem("splitflow.demoState.v1", JSON.stringify({ proposals: [] }));
    window.localStorage.setItem("splitflow.demoState.v2", JSON.stringify({ proposals: [] }));
    resetDemoData();
    expect(getProposals()[0].id).toBe("bbq-dinner");
    expect(window.localStorage.getItem("splitflow.demoState.v1")).toBeNull();
    expect(window.localStorage.getItem("splitflow.demoState.v2")).toBeNull();
  });

  it("falls back to canonical data when persisted state is invalid", () => {
    window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify({ proposals: [{ id: "bad", title: "Bad" }] }));

    expect(getDemoState().proposals[0].id).toBe("bbq-dinner");
  });

  it("recalculates valid persisted proposals on load", () => {
    const proposal = createBbqProposalFromPrompt(
      "BBQ dinner for 8. Syahmi paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef."
    )!;
    window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify({ ...getDemoState(), proposals: [{ ...proposal, totalCost: 1 }] }));

    expect(getDemoState().proposals[0].totalCost).toBe(128000);
  });
});
