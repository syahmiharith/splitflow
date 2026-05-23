import type { OrchestratorResponse } from "@/lib/agents/agent-types";
import type { AgentRunContext } from "@/lib/types";
import type { WorkflowRunResult } from "@/lib/workflow/schema";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export type SplitFlowChatTransportOptions = {
  getRunContext?: () => AgentRunContext | undefined;
  onResponse?: (response: OrchestratorResponse, sourceMessage: string, context?: AgentRunContext, result?: WorkflowRunResult) => void;
};

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function chunkStream(text: string): ReadableStream<UIMessageChunk> {
  const textId = crypto.randomUUID();

  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: "start" });
      controller.enqueue({ type: "text-start", id: textId });
      controller.enqueue({ type: "text-delta", id: textId, delta: text });
      controller.enqueue({ type: "text-end", id: textId });
      controller.enqueue({ type: "finish", finishReason: "stop" });
      controller.close();
    }
  });
}

function resultToResponse(result: WorkflowRunResult): OrchestratorResponse {
  return {
    message: result.assistantMessage?.content ?? result.run.events.find((event) => event.type === "text_delta")?.delta ?? "Workflow completed.",
    proposal: result.proposal as never,
    nextActions: ["review_proposal", "send_proposal"],
    trace: result.run.events
      .filter((event) => event.type === "step_completed")
      .map((event) => ({
        agent: event.step as never,
        action: "server_workflow_step",
        status: "completed",
        detail: event.detail
      }))
  };
}

function chunkStreamFromRun(result: WorkflowRunResult): ReadableStream<UIMessageChunk> {
  const text = result.run.events
    .filter((event) => event.type === "text_delta")
    .map((event) => event.delta)
    .join("") || result.assistantMessage?.content || "Workflow completed.";
  return chunkStream(text);
}

export function createSplitFlowChatTransport({ getRunContext, onResponse }: SplitFlowChatTransportOptions = {}): ChatTransport<UIMessage> {
  return {
    async sendMessages({ messages, abortSignal }) {
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
      const message = lastUserMessage ? getMessageText(lastUserMessage) : "";
      const context = getRunContext?.();

      const response = await fetch("/api/agent/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: context?.runId,
          groupId: context?.groupId ?? "jeju-trip",
          chatId: context?.chatId ?? "chat-jeju-intake",
          message,
          idempotencyKey: context?.runId ?? `${Date.now()}:${message}`
        }),
        signal: abortSignal
      });

      const payload = (await response.json()) as WorkflowRunResult | { error?: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload && payload.error ? payload.error : "Agent workflow unavailable.");
      }

      const result = payload as WorkflowRunResult;
      onResponse?.(resultToResponse(result), message, context, result);
      return chunkStreamFromRun(result);
    },

    async reconnectToStream() {
      return null;
    }
  };
}
