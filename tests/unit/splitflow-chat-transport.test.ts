import { afterEach, describe, expect, it, vi } from "vitest";
import { createSplitFlowChatTransport } from "@/lib/ai/splitflow-chat-transport";
import type { OrchestratorResponse } from "@/lib/agents/agent-types";
import type { AgentRunContext } from "@/lib/types";

describe("SplitFlow chat transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends workflow id and returns the same run context with the response", async () => {
    const context: AgentRunContext = { runId: "run-123", groupId: "group-a", chatId: "chat-a" };
    const payload: OrchestratorResponse = {
      message: "Proposal ready.",
      nextActions: [],
      trace: []
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
      "/api/agent",
      expect.objectContaining({
        body: JSON.stringify({
          type: "user_message",
          message: "Split dinner four ways.",
          workflowId: "run-123"
        })
      })
    );
    expect(onResponse).toHaveBeenCalledWith(payload, "Split dinner four ways.", context);
  });
});
