import { describe, expect, it } from "vitest";
import { upsertArtifactsForChat } from "@/lib/artifact-upsert";
import { stableArtifactKey } from "@/lib/artifact-identity";
import type { Artifact, SplitFlowGroup } from "@/lib/types";

function artifact(id: string, sourceText: string): Artifact {
  return {
    id,
    type: "proposal_draft",
    title: "Han River BBQ Proposal",
    summary: "Proposal artifact bundle.",
    proposalId: "han-river-bbq-proposal",
    sourceText,
    ...stableArtifactKey({
      groupId: "han-river-bbq",
      chatId: "chat-han-river-bbq",
      proposalId: "han-river-bbq-proposal",
      type: "proposal_draft",
      sourceText
    }),
    createdAt: "2026-05-24T00:00:00.000Z"
  };
}

function groupWith(artifacts: Artifact[] = []): SplitFlowGroup {
  return {
    id: "han-river-bbq",
    name: "Han River BBQ Crew",
    description: "Test group",
    members: [],
    proposals: [],
    chats: [
      {
        id: "chat-han-river-bbq",
        title: "Chat",
        messages: [],
        artifactIds: artifacts.map((item) => item.id),
        createdAt: "2026-05-24T00:00:00.000Z",
        updatedAt: "2026-05-24T00:00:00.000Z"
      }
    ],
    artifacts,
    analyticsSummary: {
      activeProposals: 0,
      openChangeRequests: 0,
      pendingSettlements: 0,
      totalFronted: 0,
      stillOwed: 0,
      pendingResponses: 0,
      confirmedPayments: 0,
      claimedUnconfirmedCredits: 0
    },
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:00:00.000Z"
  };
}

describe("artifact upsert", () => {
  it("reuses the existing visible artifact for the same stable key", () => {
    const first = artifact("artifact-1", "Han River BBQ prompt");
    const next = upsertArtifactsForChat(groupWith([first]), "chat-han-river-bbq", [artifact("artifact-2", "han river bbq prompt")]);

    expect(next.artifacts).toHaveLength(1);
    expect(next.artifacts[0].id).toBe("artifact-1");
    expect(next.chats[0].artifactIds).toEqual(["artifact-1"]);
  });

  it("adds a new artifact when the source changes meaningfully", () => {
    const first = artifact("artifact-1", "Han River BBQ prompt");
    const next = upsertArtifactsForChat(groupWith([first]), "chat-han-river-bbq", [artifact("artifact-2", "Han River BBQ prompt with a new dessert cost")]);

    expect(next.artifacts.map((item) => item.id)).toEqual(["artifact-2", "artifact-1"]);
    expect(next.chats[0].artifactIds).toEqual(["artifact-2", "artifact-1"]);
  });
});
