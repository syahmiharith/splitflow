"use client";

import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { createSplitFlowChatTransport } from "@/lib/ai/splitflow-chat-transport";
import { useSplitFlow } from "@/lib/store";
import { AgentProgress, agentProgress } from "@/components/chat/agent-progress";
import { ArtifactPreviewGrid } from "@/components/chat/artifact-preview-grid";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessages } from "@/components/chat/chat-messages";
import { WorkspaceDetailPanel } from "@/components/workspace-detail-panel";

export function ChatWorkspace() {
  const {
    activeGroup,
    activeChat,
    activeArtifacts,
    state,
    recordChatUserMessage,
    applyAgentResponse,
    openArtifact
  } = useSplitFlow();
  const [chatError, setChatError] = useState<string | undefined>();
  const [progressIndex, setProgressIndex] = useState(0);
  const { sendMessage, status, error } = useChat({
    messages: activeChat.messages.map((chatMessage) => ({
      id: chatMessage.id,
      role: chatMessage.sender === "user" ? "user" : "assistant",
      parts: [{ type: "text", text: chatMessage.content }]
    })),
    transport: createSplitFlowChatTransport({ onResponse: applyAgentResponse })
  });
  const submitting = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!submitting) {
      setProgressIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setProgressIndex((current) => Math.min(current + 1, agentProgress.length - 1));
    }, 900);

    return () => window.clearInterval(interval);
  }, [submitting]);

  async function handleSend(message: string, files?: File[]) {
    const trimmed = message.trim();
    if (!trimmed || submitting) return;
    setChatError(undefined);
    const attachmentNote = files?.length ? `\n\n[${files.length} image attachment uploaded in the prototype composer; OCR is not enabled.]` : "";
    const outgoingMessage = `${trimmed}${attachmentNote}`;
    recordChatUserMessage(outgoingMessage);
    try {
      await sendMessage({ text: outgoingMessage });
    } catch (sendError) {
      setChatError(sendError instanceof Error ? sendError.message : "Agent workflow unavailable.");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col lg:h-[calc(100vh-76px)] lg:min-h-0 lg:flex-row" data-testid="chat-route">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          <ChatMessages messages={activeChat.messages} />

          {submitting ? <AgentProgress progressIndex={progressIndex} /> : null}

          <ArtifactPreviewGrid artifacts={activeArtifacts} onOpenArtifact={openArtifact} />

          {state.aiUnavailable || error || chatError ? (
            <div data-testid="ai-unavailable" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-app-text">
              AI unavailable: {chatError ?? error?.message ?? state.lastAiError ?? "Configure the server API key to enable live AI drafting."}
            </div>
          ) : null}
        </div>

        <ChatComposer
          isLoading={submitting}
          onSend={handleSend}
          placeholder={`Message ${activeGroup.name}...`}
        />
      </section>

      <WorkspaceDetailPanel desktopPersistent />
    </div>
  );
}
