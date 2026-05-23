import { beforeEach, describe, expect, it } from "vitest";
import { defaultGroup, initialState } from "@/lib/demo-data";
import { getDemoState, getProposalById, getProposals, resetDemoData, saveDemoState, saveProposal, SPLITFLOW_STORAGE_KEY, updateParticipantResponse } from "@/lib/prototype-persistence";
import { createBbqProposalFromPrompt } from "@/lib/prototype-proposals";
import type { ChatSession, SplitFlowGroup } from "@/lib/types";

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
    window.localStorage.setItem("splitflow.demoState.v3", JSON.stringify({ proposals: [] }));
    resetDemoData();
    expect(getProposals()[0].id).toBe("bbq-dinner");
    expect(window.localStorage.getItem("splitflow.demoState.v1")).toBeNull();
    expect(window.localStorage.getItem("splitflow.demoState.v2")).toBeNull();
    expect(window.localStorage.getItem("splitflow.demoState.v3")).toBeNull();
    expect(window.localStorage.getItem(SPLITFLOW_STORAGE_KEY)).toContain("bbq-crew");
  });

  it("falls back to canonical data when persisted state is invalid", () => {
    window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify({ proposals: [{ id: "bad", title: "Bad" }] }));

    expect(getProposals()[0].id).toBe("bbq-dinner");
    expect(getDemoState().selectedGroupId).toBe("bbq-crew");
    expect(getDemoState().groups[0].name).toBe("BBQ Crew");
  });

  it("ignores stale global proposal and message mirrors", () => {
    window.localStorage.setItem(
      SPLITFLOW_STORAGE_KEY,
      JSON.stringify({
        ...initialState,
        proposals: [{ id: "global-copy", title: "Stale global proposal" }],
        messages: [{ id: "global-message", content: "stale" }]
      })
    );

    expect("proposals" in getDemoState()).toBe(false);
    expect("messages" in getDemoState()).toBe(false);
    expect(getProposals()[0].id).toBe("bbq-dinner");
  });

  it("recalculates valid persisted proposals on load", () => {
    const proposal = createBbqProposalFromPrompt(
      "BBQ dinner for 8. Syahmi paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef."
    )!;
    const current = getDemoState();
    window.localStorage.setItem(
      SPLITFLOW_STORAGE_KEY,
      JSON.stringify({
        ...current,
        groups: current.groups.map((group) => (group.id === defaultGroup.id ? { ...group, proposals: [{ ...proposal, totalCost: 1 }] } : group))
      })
    );

    expect(getProposals()[0].totalCost).toBe(128000);
  });

  it("persists selected user-created groups ahead of the fallback group", () => {
    const customGroup: SplitFlowGroup = {
      ...defaultGroup,
      id: "jeju-trip",
      name: "Jeju Trip",
      description: "Trip planning workspace",
      proposals: [],
      chats: defaultGroup.chats.map((chat) => ({ ...chat, id: "jeju-chat" })),
      artifacts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveDemoState({ ...initialState, groups: [customGroup, defaultGroup], selectedGroupId: customGroup.id });

    const loaded = getDemoState();
    expect(loaded.selectedGroupId).toBe("jeju-trip");
    expect(loaded.groups.map((group) => group.id)).toEqual(["jeju-trip", "bbq-crew"]);
  });

  it("keeps only the newest three chats per persisted group", () => {
    const chats: ChatSession[] = Array.from({ length: 4 }, (_, index) => ({
      ...defaultGroup.chats[0],
      id: `chat-${index + 1}`,
      title: `Chat ${index + 1}`,
      createdAt: new Date(2026, 0, index + 1).toISOString(),
      updatedAt: new Date(2026, 0, index + 1).toISOString()
    }));

    window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify({ ...initialState, groups: [{ ...defaultGroup, chats }], selectedGroupId: defaultGroup.id }));

    expect(getDemoState().groups[0].chats.map((chat) => chat.id)).toEqual(["chat-2", "chat-3", "chat-4"]);
  });
});
