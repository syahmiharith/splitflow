import { afterEach, describe, expect, it, vi } from "vitest";
import { createSplitFlowChatTransport } from "@/lib/ai/splitflow-chat-transport";
import type { AgentRunContext } from "@/lib/types";
import type { WorkflowRunResult } from "@/lib/workflow/schema";

describe("SplitFlow chat transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends workflow id and returns the same run context with the response", async () => {
    const context: AgentRunContext = { runId: "run-123", groupId: "group-a", chatId: "chat-a" };
    const payload: WorkflowRunResult = {
      run: {
        id: "run-123",
        groupId: "group-a",
        chatId: "chat-a",
        sourceMessageId: "message-1",
        status: "completed",
        retryCount: 0,
        createdAt: "2026-05-22T10:22:00.000+09:00",
        startedAt: "2026-05-22T10:22:00.000+09:00",
        endedAt: "2026-05-22T10:22:01.000+09:00",
        eventIds: ["event-1"],
        events: [
          {
            id: "event-1",
            runId: "run-123",
            at: "2026-05-22T10:22:01.000+09:00",
            type: "text_delta",
            delta: "Proposal ready.",
            detail: "Prepared response."
          }
        ]
      },
      group: {
        id: "group-a",
        name: "Group A",
        description: "",
        members: [],
        proposals: [],
        chats: [],
        artifacts: [],
        analyticsSummary: { activeProposals: 0, openChangeRequests: 0, pendingSettlements: 0, totalFronted: 0, stillOwed: 0, pendingResponses: 0, confirmedPayments: 0, claimedUnconfirmedCredits: 0 },
        createdAt: "2026-05-22T10:22:00.000+09:00",
        updatedAt: "2026-05-22T10:22:00.000+09:00"
      },
      artifacts: []
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onResponse = vi.fn();

    const transport = createSplitFlowChatTransport({
      getRunContext: () => context,
      onResponse
    });

    await transport.sendMessages({
      messages: [
        {
          id: "message-1",
          role: "user",
          parts: [{ type: "text", text: "Split dinner four ways." }]
        }
      ],
      abortSignal: undefined
    } as never);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/runs",
      expect.objectContaining({
        body: JSON.stringify({
          runId: "run-123",
          groupId: "group-a",
          chatId: "chat-a",
          message: "Split dinner four ways.",
          idempotencyKey: "run-123"
        })
      })
    );
    expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ message: "Proposal ready." }), "Split dinner four ways.", context, payload);
  });
});
