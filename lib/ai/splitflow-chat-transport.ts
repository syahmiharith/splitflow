import type { OrchestratorResponse } from "@/lib/agents/agent-types";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export type SplitFlowChatTransportOptions = {
  onResponse?: (response: OrchestratorResponse, sourceMessage: string) => void;
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

export function createSplitFlowChatTransport({ onResponse }: SplitFlowChatTransportOptions = {}): ChatTransport<UIMessage> {
  return {
    async sendMessages({ messages, abortSignal }) {
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
      const message = lastUserMessage ? getMessageText(lastUserMessage) : "";

      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "user_message", message }),
        signal: abortSignal
      });

      const payload = (await response.json()) as OrchestratorResponse | { error?: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload && payload.error ? payload.error : "Agent workflow unavailable.");
      }

      const result = payload as OrchestratorResponse;
      onResponse?.(result, message);
      return chunkStream(result.message);
    },

    async reconnectToStream() {
      return null;
    }
  };
}
