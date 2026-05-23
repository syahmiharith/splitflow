"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { createSplitFlowChatTransport } from "@/lib/ai/splitflow-chat-transport";
import { useSplitFlow } from "@/lib/store";
import type { AgentRunContext } from "@/lib/types";
import { AgentProgress, agentProgress } from "@/components/chat/agent-progress";
import { ArtifactPreviewGrid } from "@/components/chat/artifact-preview-grid";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ReadinessChecklist, SafeToBookSummary } from "@/components/readiness-widgets";
import { WorkspaceDetailPanel } from "@/components/workspace-detail-panel";
import { deriveReadinessSummary } from "@/lib/readiness";

export function ChatWorkspace() {
  const {
    activeGroup,
    activeChat,
    activeProposal,
    activeArtifacts,
    state,
    recordChatUserMessage,
    applyAgentResponse,
    failAgentRun,
    openArtifact
  } = useSplitFlow();
  const [chatError, setChatError] = useState<string | undefined>();
  const [progressIndex, setProgressIndex] = useState(0);
  const pendingRunRef = useRef<AgentRunContext | undefined>(undefined);
  const { sendMessage, status, error } = useChat({
    messages: activeChat.messages.map((chatMessage) => ({
      id: chatMessage.id,
      role: chatMessage.sender === "user" ? "user" : "assistant",
      parts: [{ type: "text", text: chatMessage.content }]
    })),
    transport: createSplitFlowChatTransport({
      getRunContext: () => pendingRunRef.current,
      onResponse: applyAgentResponse
    })
  });
  const submitting = status === "submitted" || status === "streaming";
  const activeRun = state.agentRuns.find((run) => run.id === pendingRunRef.current?.runId);
  const showProgress = submitting && pendingRunRef.current?.groupId === activeGroup.id && pendingRunRef.current?.chatId === activeChat.id;
  const readiness = deriveReadinessSummary(activeProposal);

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
    const runContext = { runId: crypto.randomUUID(), groupId: activeGroup.id, chatId: activeChat.id };
    pendingRunRef.current = runContext;
    recordChatUserMessage(outgoingMessage, runContext);
    try {
      await sendMessage({ text: outgoingMessage });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Agent workflow unavailable.";
      failAgentRun(runContext.runId, message);
      setChatError(message);
    } finally {
      if (pendingRunRef.current?.runId === runContext.runId) {
        pendingRunRef.current = undefined;
      }
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col lg:h-[calc(100vh-76px)] lg:min-h-0 lg:flex-row" data-testid="chat-route">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          <SafeToBookSummary summary={readiness} totalCost={activeProposal.calculationResult?.totalCost ?? activeProposal.totalCost} />
          <ReadinessChecklist items={readiness.checklist} />

          <ChatMessages messages={activeChat.messages} />

          {showProgress ? <AgentProgress progressIndex={progressIndex} run={activeRun} /> : null}

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
