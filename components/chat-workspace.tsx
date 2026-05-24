"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { createSplitFlowChatTransport } from "@/lib/ai/splitflow-chat-transport";
import { useSplitFlow } from "@/lib/store";
import type { AgentRunContext } from "@/lib/types";
import { ArtifactPreviewGroup } from "@/components/chat/artifact-preview-grid";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatThread } from "@/components/chat/chat-messages";
import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { DecisionSummaryCard } from "@/components/chat/decision-summary-card";
import { WorkspaceDetailPanel } from "@/components/workspace-detail-panel";
import { deriveReadinessSummary } from "@/lib/readiness";

const MIN_WORKFLOW_VISIBLE_MS = 2800;

export function ChatWorkspace() {
  const {
    activeGroup,
    activeChat,
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
  const pendingRunRef = useRef<AgentRunContext | undefined>(undefined);
  const runStartedAtRef = useRef<Map<string, number>>(new Map());
  const responseTimersRef = useRef<number[]>([]);
  const { sendMessage, status, error } = useChat({
    messages: activeChat.messages.map((chatMessage) => ({
      id: chatMessage.id,
      role: chatMessage.sender === "user" ? "user" : "assistant",
      parts: [{ type: "text", text: chatMessage.content }]
    })),
    transport: createSplitFlowChatTransport({
      getRunContext: () => pendingRunRef.current,
      onResponse: (response, sourceMessage, context, result) => {
        if (!context) {
          applyAgentResponse(response, sourceMessage, context, result);
          return;
        }
        const startedAt = runStartedAtRef.current.get(context.runId) ?? performance.now();
        const remaining = Math.max(0, MIN_WORKFLOW_VISIBLE_MS - (performance.now() - startedAt));
        const timer = window.setTimeout(() => {
          applyAgentResponse(response, sourceMessage, context, result);
          runStartedAtRef.current.delete(context.runId);
          responseTimersRef.current = responseTimersRef.current.filter((item) => item !== timer);
        }, remaining);
        responseTimersRef.current.push(timer);
      },
      onRunEvent: applyAgentRunEvent
    })
  });
  const submitting = status === "submitted" || status === "streaming";
  const hasConversation = activeChat.messages.length > 0;
  const hasUserMessages = activeChat.messages.some((message) => message.sender === "user");
  const chatProposalId =
    activeArtifacts.find((artifact) => artifact.proposalId)?.proposalId ??
    activeChat.messages.slice().reverse().find((message) => message.relatedProposalId)?.relatedProposalId;
  const chatProposal = chatProposalId ? activeGroup.proposals.find((proposal) => proposal.id === chatProposalId) : undefined;
  const readiness = chatProposal ? deriveReadinessSummary(chatProposal) : undefined;

  useEffect(() => {
    return () => {
      responseTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      responseTimersRef.current = [];
    };
  }, []);

  async function handleSend(message: string, files?: File[]) {
    const trimmed = message.trim();
    if (!trimmed || submitting) return;
    setChatError(undefined);
    const attachmentNote = files?.length ? `\n\n[${files.length} image attachment uploaded in the prototype composer; OCR is not enabled.]` : "";
    const outgoingMessage = `${trimmed}${attachmentNote}`;
    const runContext = { runId: crypto.randomUUID(), groupId: activeGroup.id, chatId: activeChat.id };
    pendingRunRef.current = runContext;
    runStartedAtRef.current.set(runContext.runId, performance.now());
    recordChatUserMessage(outgoingMessage, runContext);
    try {
      await sendMessage({ text: outgoingMessage });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Agent workflow unavailable.";
      failAgentRun(runContext.runId, message);
      runStartedAtRef.current.delete(runContext.runId);
      setChatError(message);
    } finally {
      if (pendingRunRef.current?.runId === runContext.runId) {
        pendingRunRef.current = undefined;
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-page lg:flex-row" data-testid="chat-route">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-4 md:px-6 md:pb-4 md:pt-5" data-testid="chat-scroll-region">
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4" data-testid="chat-centered-column">
            {hasConversation ? (
              <ChatThread messages={activeChat.messages} agentRuns={state.agentRuns} agentSteps={state.agentSteps} />
            ) : (
              <ChatEmptyState onPrompt={(prompt) => void handleSend(prompt)} />
            )}

            {chatProposal && readiness ? (
              <DecisionSummaryCard
                proposal={chatProposal}
                summary={readiness}
                onReview={() => openProposalPanel(chatProposal.id)}
              />
            ) : null}

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
            showStarterPrompts={!hasUserMessages}
          />
        </div>
      </section>

      <WorkspaceDetailPanel desktopPersistent />
    </div>
  );
}
