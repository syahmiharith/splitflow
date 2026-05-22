"use client";

import { FormEvent, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { FileText, MessageCircle, Plus, Send, Sparkles } from "lucide-react";
import { compactTime, humanStatus } from "@/lib/format";
import { createSplitFlowChatTransport } from "@/lib/ai/splitflow-chat-transport";
import { useSplitFlow } from "@/lib/store";
import { DemoToolbar } from "@/components/demo-toolbar";
import { WorkspaceDetailPanel } from "@/components/workspace-detail-panel";

const agentProgress = [
  "Reading expense request",
  "Extracting items and participants",
  "Checking exclusions and credits",
  "Validating totals",
  "Running deterministic split engine",
  "Creating proposal artifact"
];

export function ChatWorkspace() {
  const {
    activeGroup,
    activeChat,
    activeArtifacts,
    state,
    createChat,
    selectChat,
    recordChatUserMessage,
    applyAgentResponse,
    openArtifact
  } = useSplitFlow();
  const [message, setMessage] = useState("");
  const [chatError, setChatError] = useState<string | undefined>();
  const { sendMessage, status, error } = useChat({
    messages: activeChat.messages.map((chatMessage) => ({
      id: chatMessage.id,
      role: chatMessage.sender === "user" ? "user" : "assistant",
      parts: [{ type: "text", text: chatMessage.content }]
    })),
    transport: createSplitFlowChatTransport({ onResponse: applyAgentResponse })
  });
  const submitting = status === "submitted" || status === "streaming";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || submitting) return;
    setMessage("");
    setChatError(undefined);
    recordChatUserMessage(trimmed);
    try {
      await sendMessage({ text: trimmed });
    } catch (sendError) {
      setChatError(sendError instanceof Error ? sendError.message : "Agent workflow unavailable.");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col lg:h-[calc(100vh-76px)] lg:min-h-0 lg:flex-row" data-testid="chat-route">
      <aside className="border-b border-app-border bg-white p-3 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
        <DemoToolbar compact={false} showLoaders={false} />
        <button
          type="button"
          data-testid="new-chat"
          onClick={() => createChat()}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-app-blue px-3 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New chat
        </button>
        <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-app-muted">Previous chats · max 3</div>
        <div className="mt-2 space-y-1" data-testid="chat-session-list">
          {activeGroup.chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => selectChat(chat.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                chat.id === activeChat.id ? "bg-blue-50 text-app-blue" : "text-app-text hover:bg-slate-50"
              }`}
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{chat.title}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          <div className="rounded-lg border border-app-border bg-white p-4">
            <div className="text-sm font-semibold text-app-muted">{activeGroup.name}</div>
            <h2 className="mt-1 text-xl font-bold">Group chat</h2>
            <p className="mt-1 text-sm text-app-muted">Conversation creates artifacts. Proposal math stays deterministic.</p>
          </div>

          <div className="space-y-4" data-testid="chat-messages">
            {activeChat.messages.map((chatMessage) => {
              const isUser = chatMessage.sender === "user";
              return (
                <div key={chatMessage.id} className={isUser ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[82%] rounded-lg border px-4 py-3 text-sm leading-6 ${isUser ? "border-blue-200 bg-blue-50" : "border-app-border bg-white"}`}>
                    <p>{chatMessage.content}</p>
                    <div className="mt-2 text-xs text-app-muted">{compactTime(chatMessage.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {(submitting || state.agentSteps.length > 0) ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4" data-testid="agent-progress">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-app-blue">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Agent progress
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {agentProgress.map((step, index) => (
                  <div key={step} className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm">
                    <span className="mr-2 font-bold text-app-blue">{index + 1}</span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeArtifacts.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2" data-testid="artifact-preview-list">
              {activeArtifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  type="button"
                  data-testid={`artifact-preview-${artifact.type}`}
                  onClick={() => openArtifact(artifact.id)}
                  className="rounded-lg border border-app-border bg-white p-4 text-left hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <FileText className="h-4 w-4 text-app-blue" aria-hidden="true" />
                    {artifact.title}
                  </div>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-app-muted">{humanStatus(artifact.type)}</div>
                  <p className="mt-2 text-sm leading-6 text-app-muted">{artifact.summary}</p>
                </button>
              ))}
            </div>
          ) : null}

          {state.aiUnavailable || error || chatError ? (
            <div data-testid="ai-unavailable" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-app-text">
              AI unavailable: {chatError ?? error?.message ?? state.lastAiError ?? "Configure the server API key to enable live AI drafting."}
            </div>
          ) : null}
        </div>

        <div className="border-t border-app-border bg-page px-4 py-2 md:px-6 md:py-3" data-testid="chat-input-area">
          <form onSubmit={onSubmit} className="flex min-h-16 items-center gap-3 rounded-2xl border border-app-border bg-white p-2 shadow-[0_1px_2px_rgba(24,33,47,0.04)] md:min-h-0 md:rounded-lg">
            <input
              data-testid="chat-input"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={`Message ${activeGroup.name}...`}
              className="min-w-0 flex-1 bg-transparent px-4 py-2 text-base outline-none placeholder:text-app-muted md:text-sm"
            />
            <button
              data-testid="chat-send"
              type="submit"
              disabled={submitting}
              className="grid h-12 w-14 place-items-center rounded-xl bg-app-blue text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 md:h-10 md:w-10 md:rounded-md"
              aria-label="Send message"
            >
              <Send className="h-6 w-6 md:h-5 md:w-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>

      <WorkspaceDetailPanel />
    </div>
  );
}
