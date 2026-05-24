"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { createSplitFlowChatTransport } from "@/lib/ai/splitflow-chat-transport";
import { useSplitFlow } from "@/lib/store";
import type { AgentRunContext } from "@/lib/types";
import { AgentRunCard, agentProgress } from "@/components/chat/agent-progress";
import { ArtifactPreviewGroup } from "@/components/chat/artifact-preview-grid";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatThread } from "@/components/chat/chat-messages";
import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { DecisionSummaryCard } from "@/components/chat/decision-summary-card";
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
    applyAgentRunEvent,
    failAgentRun,
    openArtifact,
    openProposalPanel
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
      onResponse: applyAgentResponse,
      onRunEvent: applyAgentRunEvent
    })
  });
  const submitting = status === "submitted" || status === "streaming";
  const activeRun = state.agentRuns.find((run) => run.id === pendingRunRef.current?.runId);
  const showProgress = submitting && pendingRunRef.current?.groupId === activeGroup.id && pendingRunRef.current?.chatId === activeChat.id;
  const readiness = deriveReadinessSummary(activeProposal);
  const latestRun = activeRun ?? state.agentRuns.find((run) => run.groupId === activeGroup.id && run.chatId === activeChat.id);
  const shouldShowRun = showProgress || Boolean(latestRun) || activeArtifacts.length > 0;
  const hasConversation = activeChat.messages.length > 0;

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
    <div className="flex min-h-[calc(100vh-68px)] flex-col bg-page lg:h-[calc(100vh-76px)] lg:min-h-0 lg:flex-row" data-testid="chat-route">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4" data-testid="chat-centered-column">
            <DecisionSummaryCard
              proposal={activeProposal}
              summary={readiness}
              onReview={() => openProposalPanel(activeProposal.id)}
            />

            {hasConversation ? <ChatThread messages={activeChat.messages} /> : <ChatEmptyState onPrompt={(prompt) => void handleSend(prompt)} />}

            {shouldShowRun ? <AgentRunCard progressIndex={progressIndex} run={latestRun} showEstimated={!latestRun && !showProgress} /> : null}

            <ArtifactPreviewGroup artifacts={activeArtifacts} onOpenArtifact={openArtifact} />

            {state.aiUnavailable || error || chatError ? (
              <div data-testid="ai-unavailable" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-app-text">
                AI unavailable: {chatError ?? error?.message ?? state.lastAiError ?? "Configure the server API key to enable live AI drafting."}
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0">
          <ChatComposer
            isLoading={submitting}
            onSend={handleSend}
            placeholder={`Message ${activeGroup.name}...`}
          />
        </div>
      </section>

      <WorkspaceDetailPanel desktopPersistent />
    </div>
  );
}
