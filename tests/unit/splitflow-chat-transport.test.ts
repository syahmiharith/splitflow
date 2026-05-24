import { afterEach, describe, expect, it, vi } from "vitest";
import { createSplitFlowChatTransport } from "@/lib/ai/splitflow-chat-transport";
import type { AgentRunContext } from "@/lib/types";
import type { WorkflowRunResult } from "@/lib/workflow/schema";

describe("SplitFlow chat transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends workflow id, streams SSE events, and returns the same run context with the response", async () => {
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
        eventIds: ["event-1", "event-2"],
        events: [
          {
            id: "event-1",
            runId: "run-123",
            at: "2026-05-22T10:22:01.000+09:00",
            type: "text_delta",
            delta: "Proposal ready.",
            detail: "Prepared response."
          },
          {
            id: "event-2",
            runId: "run-123",
            at: "2026-05-22T10:22:01.000+09:00",
            type: "run_completed",
            detail: "Completed."
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
    const runningPayload: WorkflowRunResult = { ...payload, run: { ...payload.run, status: "running", events: [], eventIds: [], endedAt: undefined } };
    const sse = [
      "id: event-1",
      "event: text_delta",
      `data: ${JSON.stringify(payload.run.events[0])}`,
      "",
      "id: event-2",
      "event: run_completed",
      `data: ${JSON.stringify(payload.run.events[1])}`,
      "",
      ""
    ].join("\n");
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/agent/runs") return Promise.resolve(new Response(JSON.stringify(runningPayload), { status: 200 }));
      if (url === "/api/agent/runs/run-123/events") return Promise.resolve(new Response(sse, { status: 200 }));
      if (url === "/api/agent/runs/run-123") return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ error: "unexpected url" }), { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const onResponse = vi.fn();
    const onRunEvent = vi.fn();

    const transport = createSplitFlowChatTransport({
      getRunContext: () => context,
      onResponse,
      onRunEvent
    });

    const stream = await transport.sendMessages({
      messages: [
        {
          id: "message-1",
          role: "user",
          parts: [{ type: "text", text: "Split dinner four ways." }]
        }
      ],
      abortSignal: undefined
    } as never);
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/runs",
      expect.objectContaining({
        body: JSON.stringify({
          runId: "run-123",
          groupId: "group-a",
          chatId: "chat-a",
          sourceMessageId: "message-1",
          message: "Split dinner four ways.",
          idempotencyKey: "run-123"
        })
      })
    );
    expect(chunks).toContainEqual(expect.objectContaining({ type: "text-delta", delta: "Proposal ready." }));
    expect(onRunEvent).toHaveBeenCalledWith(payload.run.events[0], context);
    expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ message: "Proposal ready." }), "Split dinner four ways.", context, payload);
  });

  it("renders a terminal POST result without opening the SSE stream", async () => {
    const context: AgentRunContext = { runId: "run-inline", groupId: "group-a", chatId: "chat-a" };
    const payload: WorkflowRunResult = {
      run: {
        id: "run-inline",
        groupId: "group-a",
        chatId: "chat-a",
        sourceMessageId: "message-inline",
        status: "completed",
        retryCount: 0,
        createdAt: "2026-05-22T10:22:00.000+09:00",
        startedAt: "2026-05-22T10:22:00.000+09:00",
        endedAt: "2026-05-22T10:22:01.000+09:00",
        eventIds: ["event-inline-1", "event-inline-2"],
        events: [
          {
            id: "event-inline-1",
            runId: "run-inline",
            at: "2026-05-22T10:22:01.000+09:00",
            type: "text_delta",
            delta: "Inline proposal ready.",
            detail: "Prepared response."
          },
          {
            id: "event-inline-2",
            runId: "run-inline",
            at: "2026-05-22T10:22:01.000+09:00",
            type: "run_completed",
            detail: "Completed."
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
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/agent/runs") return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ error: "unexpected url" }), { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const onResponse = vi.fn();
    const onRunEvent = vi.fn();

    const transport = createSplitFlowChatTransport({
      getRunContext: () => context,
      onResponse,
      onRunEvent
    });

    const stream = await transport.sendMessages({
      messages: [
        {
          id: "message-inline",
          role: "user",
          parts: [{ type: "text", text: "Split dinner inline." }]
        }
      ],
      abortSignal: undefined
    } as never);
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(chunks).toContainEqual(expect.objectContaining({ type: "text-delta", delta: "Inline proposal ready." }));
    expect(onRunEvent).toHaveBeenCalledWith(payload.run.events[0], context);
    expect(onRunEvent).toHaveBeenCalledWith(payload.run.events[1], context);
    expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ message: "Inline proposal ready." }), "Split dinner inline.", context, payload);
  });
});
