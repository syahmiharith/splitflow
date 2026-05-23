import { beforeEach, describe, expect, it } from "vitest";
import { defaultGroup, initialState } from "@/lib/demo-data";
import { CURRENT_SCHEMA_VERSION, getDemoState, getProposalById, getProposals, resetDemoData, saveDemoState, saveProposal, SPLITFLOW_STORAGE_KEY, updateParticipantResponse } from "@/lib/prototype-persistence";
import { createJejuTripProposal } from "@/lib/prototype-proposals";
import type { AgentRun, ChatSession, SplitFlowGroup } from "@/lib/types";

describe("prototype persistence helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDemoData();
  });

  it("saves and loads proposals", () => {
    const proposal = createJejuTripProposal("test-group", "jeju-test-trip");
    saveProposal(proposal);

    expect(getProposalById(proposal.id)?.title).toBe("Jeju Airbnb Trip Split");
    expect(getProposals()[0].id).toBe(proposal.id);
  });

  it("updates participant responses", () => {
    const proposal = createJejuTripProposal("test-group", "jeju-test-trip");
    saveProposal(proposal);

    const updated = updateParticipantResponse(proposal.id, "alex", "requested_changes", "I can only join Saturday night.");

    expect(updated?.participants.find((participant) => participant.id === "alex")?.status).toBe("requested_changes");
    expect(getProposalById(proposal.id)?.participants.find((participant) => participant.id === "alex")?.changeRequestNote).toBe("I can only join Saturday night.");
  });

  it("resets demo state", () => {
    window.localStorage.setItem("splitflow.demoState.v1", JSON.stringify({ proposals: [] }));
    window.localStorage.setItem("splitflow.demoState.v2", JSON.stringify({ proposals: [] }));
    window.localStorage.setItem("splitflow.demoState.v3", JSON.stringify({ proposals: [] }));
    resetDemoData();
    expect(getProposals()[0].id).toBe("jeju-airbnb-trip");
    expect(window.localStorage.getItem("splitflow.demoState.v1")).toBeNull();
    expect(window.localStorage.getItem("splitflow.demoState.v2")).toBeNull();
    expect(window.localStorage.getItem("splitflow.demoState.v3")).toBeNull();
    expect(window.localStorage.getItem(SPLITFLOW_STORAGE_KEY)).toContain("jeju-trip");
    expect(getDemoState().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("migrates legacy state without schema metadata", () => {
    const legacyState = { ...initialState };
    delete (legacyState as Partial<typeof legacyState>).schemaVersion;
    delete (legacyState as Partial<typeof legacyState>).migrationLog;

    window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify(legacyState));

    const loaded = getDemoState();
    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.migrationLog).toContain("Migrated local state from schema v4 to v5.");
  });

  it("writes the current schema when saving older state", () => {
    saveDemoState({ ...initialState, schemaVersion: 4, migrationLog: ["legacy"] });

    const raw = JSON.parse(window.localStorage.getItem(SPLITFLOW_STORAGE_KEY) ?? "{}") as { schemaVersion?: number; migrationLog?: string[] };
    expect(raw.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(raw.migrationLog).toEqual(["legacy"]);
  });

  it("falls back to canonical data when persisted state is invalid", () => {
    window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify({ proposals: [{ id: "bad", title: "Bad" }] }));

    expect(getProposals()[0].id).toBe("jeju-airbnb-trip");
    expect(getDemoState().selectedGroupId).toBe("jeju-trip");
    expect(getDemoState().groups[0].name).toBe("Jeju Trip");
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
    expect(getProposals()[0].id).toBe("jeju-airbnb-trip");
  });

  it("recalculates valid persisted proposals on load", () => {
    const proposal = createJejuTripProposal(defaultGroup.id, "jeju-test-trip");
    const current = getDemoState();
    window.localStorage.setItem(
      SPLITFLOW_STORAGE_KEY,
      JSON.stringify({
        ...current,
        groups: current.groups.map((group) => (group.id === defaultGroup.id ? { ...group, proposals: [{ ...proposal, totalCost: 1 }] } : group))
      })
    );

    expect(getProposals()[0].totalCost).toBe(570000);
  });

  it("persists selected user-created groups ahead of the fallback group", () => {
    const customGroup: SplitFlowGroup = {
      ...defaultGroup,
      id: "busan-trip",
      name: "Busan Trip",
      description: "Trip planning workspace",
      proposals: [],
      chats: defaultGroup.chats.map((chat) => ({ ...chat, id: "jeju-chat" })),
      artifacts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveDemoState({ ...initialState, groups: [customGroup, defaultGroup], selectedGroupId: customGroup.id });

    const loaded = getDemoState();
    expect(loaded.selectedGroupId).toBe("busan-trip");
    expect(loaded.groups.map((group) => group.id)).toEqual(["busan-trip", "jeju-trip"]);
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

  it("preserves valid agent runs for chat correlation", () => {
    const agentRun: AgentRun = {
      id: "run-jeju-1",
      groupId: defaultGroup.id,
      chatId: defaultGroup.chats[0].id,
      sourceMessageId: "m2",
      status: "completed",
      retryCount: 0,
      createdAt: "2026-05-22T10:22:00.000+09:00",
      startedAt: "2026-05-22T10:22:00.000+09:00",
      endedAt: "2026-05-22T10:22:01.000+09:00",
      eventIds: ["event-1"],
      events: [
        {
          id: "event-1",
          runId: "run-jeju-1",
          at: "2026-05-22T10:22:01.000+09:00",
          type: "run_completed",
          detail: "Applied to originating chat."
        }
      ]
    };

    window.localStorage.setItem(SPLITFLOW_STORAGE_KEY, JSON.stringify({ ...initialState, agentRuns: [agentRun] }));

    expect(getDemoState().agentRuns[0]).toMatchObject({
      id: "run-jeju-1",
      groupId: defaultGroup.id,
      chatId: defaultGroup.chats[0].id,
      status: "completed"
    });
  });
});
