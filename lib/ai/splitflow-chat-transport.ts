import type { OrchestratorResponse } from "@/lib/agents/agent-types";
import { normalizeIdentityText, stableHash } from "@/lib/artifact-identity";
import type { AgentRunContext, AgentRunEvent } from "@/lib/types";
import type { WorkflowRunResult } from "@/lib/workflow/schema";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export type SplitFlowChatTransportOptions = {
  getRunContext?: () => AgentRunContext | undefined;
  onResponse?: (response: OrchestratorResponse, sourceMessage: string, context?: AgentRunContext, result?: WorkflowRunResult) => void;
  onRunEvent?: (event: AgentRunEvent, context?: AgentRunContext) => void;
};

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function getResultText(result: WorkflowRunResult): string {
  return result.assistantMessage?.content ?? result.run.events.find((event) => event.type === "text_delta")?.delta ?? "Workflow completed.";
}

function resultToResponse(result: WorkflowRunResult): OrchestratorResponse {
  return {
    message: getResultText(result),
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

function parseSseBlock(block: string): AgentRunEvent | undefined {
  const lines = block.split(/\r?\n/);
  const dataLine = lines.find((line) => line.startsWith("data: "));
  if (!dataLine) return undefined;
  return JSON.parse(dataLine.slice("data: ".length)) as AgentRunEvent;
}

function runEventsUrl(runId: string, afterEventId?: string): string {
  const params = afterEventId ? `?afterEventId=${encodeURIComponent(afterEventId)}` : "";
  return `/api/agent/runs/${encodeURIComponent(runId)}/events${params}`;
}

function isTerminalResult(result: WorkflowRunResult): boolean {
  return result.run.status === "completed" || result.run.status === "failed";
}

async function fetchRunResult(runId: string): Promise<WorkflowRunResult> {
  const response = await fetch(`/api/agent/runs/${encodeURIComponent(runId)}`);
  const payload = (await response.json()) as WorkflowRunResult | { error?: string };
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload && payload.error ? payload.error : "Workflow snapshot unavailable.");
  }
  return payload as WorkflowRunResult;
}

export function createSplitFlowChatTransport({ getRunContext, onResponse, onRunEvent }: SplitFlowChatTransportOptions = {}): ChatTransport<UIMessage> {
  let lastRunContext: AgentRunContext | undefined;
  let lastSourceMessage = "";
  let lastEventId: string | undefined;

  function streamTerminalResult(result: WorkflowRunResult, sourceMessage: string, context?: AgentRunContext): ReadableStream<UIMessageChunk> {
    const textId = crypto.randomUUID();
    return new ReadableStream<UIMessageChunk>({
      start(controller) {
        try {
          controller.enqueue({ type: "start" });
          for (const event of result.run.events) {
            lastEventId = event.id;
            onRunEvent?.(event, context);
          }

          if (result.run.status === "failed") {
            onResponse?.(resultToResponse(result), sourceMessage, context, result);
            controller.error(new Error(result.run.error ?? "Workflow run failed safely."));
            return;
          }

          controller.enqueue({ type: "text-start", id: textId });
          controller.enqueue({ type: "text-delta", id: textId, delta: getResultText(result) });
          controller.enqueue({ type: "text-end", id: textId });
          onResponse?.(resultToResponse(result), sourceMessage, context, result);
          controller.enqueue({ type: "finish", finishReason: "stop" });
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  function streamRunEvents(runId: string, sourceMessage: string, context?: AgentRunContext, abortSignal?: AbortSignal, afterEventId?: string): ReadableStream<UIMessageChunk> {
    const textId = crypto.randomUUID();
    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        let textStarted = false;
        controller.enqueue({ type: "start" });

        try {
          const response = await fetch(runEventsUrl(runId, afterEventId), { signal: abortSignal });
          if (!response.ok || !response.body) throw new Error("Agent event stream unavailable.");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split(/\n\n/);
            buffer = blocks.pop() ?? "";

            for (const block of blocks) {
              const event = parseSseBlock(block.trim());
              if (!event) continue;
              lastEventId = event.id;
              onRunEvent?.(event, context);

              if (event.type === "text_delta") {
                if (!textStarted) {
                  textStarted = true;
                  controller.enqueue({ type: "text-start", id: textId });
                }
                controller.enqueue({ type: "text-delta", id: textId, delta: event.delta });
              }

              if (event.type === "run_completed") {
                if (textStarted) controller.enqueue({ type: "text-end", id: textId });
                const result = await fetchRunResult(runId);
                onResponse?.(resultToResponse(result), sourceMessage, context, result);
                controller.enqueue({ type: "finish", finishReason: "stop" });
                controller.close();
                return;
              }

              if (event.type === "run_failed") {
                const result = await fetchRunResult(runId);
                onResponse?.(resultToResponse(result), sourceMessage, context, result);
                throw new Error(event.detail);
              }
            }
          }

          const result = await fetchRunResult(runId);
          if (result.run.status === "completed") {
            if (!textStarted) {
              controller.enqueue({ type: "text-start", id: textId });
              controller.enqueue({ type: "text-delta", id: textId, delta: getResultText(result) });
              textStarted = true;
            }
            controller.enqueue({ type: "text-end", id: textId });
            onResponse?.(resultToResponse(result), sourceMessage, context, result);
            controller.enqueue({ type: "finish", finishReason: "stop" });
            controller.close();
            return;
          }

          throw new Error("Agent event stream ended before completion.");
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  return {
    async sendMessages({ messages, abortSignal }) {
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
      const message = lastUserMessage ? getMessageText(lastUserMessage) : "";
      const sourceMessageId = lastUserMessage?.id ?? crypto.randomUUID();
      const context = getRunContext?.() ?? {
        runId: crypto.randomUUID(),
        groupId: "han-river-bbq",
        chatId: "chat-han-river-bbq"
      };
      lastRunContext = context;
      lastSourceMessage = message;
      lastEventId = undefined;

      const response = await fetch("/api/agent/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: context?.runId,
          groupId: context?.groupId ?? "han-river-bbq",
          chatId: context?.chatId ?? "chat-han-river-bbq",
          sourceMessageId,
          message,
          idempotencyKey: context?.runId ?? `chat:${context?.groupId ?? "han-river-bbq"}:${context?.chatId ?? "chat-han-river-bbq"}:${stableHash(normalizeIdentityText(message))}`
        }),
        signal: abortSignal
      });

      const payload = (await response.json()) as WorkflowRunResult | { error?: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload && payload.error ? payload.error : "Agent workflow unavailable.");
      }

      const result = payload as WorkflowRunResult;
      lastRunContext = { runId: result.run.id, groupId: result.run.groupId, chatId: result.run.chatId };
      if (isTerminalResult(result)) return streamTerminalResult(result, message, lastRunContext);
      return streamRunEvents(result.run.id, message, lastRunContext, abortSignal);
    },

    async reconnectToStream() {
      if (!lastRunContext) return null;
      return streamRunEvents(lastRunContext.runId, lastSourceMessage, lastRunContext, undefined, lastEventId);
    }
  };
}
