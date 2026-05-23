"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { FileText, Send, Sparkles } from "lucide-react";
import { compactTime, humanStatus } from "@/lib/format";
import { createSplitFlowChatTransport } from "@/lib/ai/splitflow-chat-transport";
import { useSplitFlow } from "@/lib/store";
import { WorkspaceDetailPanel } from "@/components/workspace-detail-panel";

const agentProgress = [
  { agent: "Intake Agent", detail: "Reading expense request" },
  { agent: "Cost Agent", detail: "Extracting items and participants" },
  { agent: "Fairness Agent", detail: "Checking exclusions and credits" },
  { agent: "Validation Agent", detail: "Validating totals" },
  { agent: "Split Agent", detail: "Running deterministic split engine" },
  { agent: "Proposal Agent", detail: "Creating proposal artifact" }
];

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
  const [message, setMessage] = useState("");
  const [chatError, setChatError] = useState<string | undefined>();
  const [progressIndex, setProgressIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, status, error } = useChat({
    messages: activeChat.messages.map((chatMessage) => ({
      id: chatMessage.id,
      role: chatMessage.sender === "user" ? "user" : "assistant",
      parts: [{ type: "text", text: chatMessage.content }]
    })),
    transport: createSplitFlowChatTransport({ onResponse: applyAgentResponse })
  });
  const submitting = status === "submitted" || status === "streaming";
  const currentProgress = agentProgress[Math.min(progressIndex, agentProgress.length - 1)];
  const progressPercent = Math.round(((Math.min(progressIndex, agentProgress.length - 1) + 1) / agentProgress.length) * 100);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, window.innerHeight * 0.25)}px`;
    input.style.overflowY = input.scrollHeight > window.innerHeight * 0.25 ? "auto" : "hidden";
  }, [message]);

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

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col lg:h-[calc(100vh-76px)] lg:min-h-0 lg:flex-row" data-testid="chat-route">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
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

          {submitting ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4" data-testid="agent-progress">
              <div className="flex items-center gap-2 text-sm font-bold text-app-blue">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Running {currentProgress.agent}
              </div>
              <div className="mt-3 rounded-md border border-blue-100 bg-white px-3 py-2 text-sm">
                {currentProgress.detail}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-app-blue transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mt-2 text-xs font-semibold text-app-muted">
                Step {Math.min(progressIndex, agentProgress.length - 1) + 1} of {agentProgress.length}
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
            <textarea
              ref={inputRef}
              data-testid="chat-input"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={`Message ${activeGroup.name}...`}
              rows={1}
              className="max-h-[25vh] min-h-11 min-w-0 flex-1 resize-none bg-transparent px-4 py-2 text-base outline-none placeholder:text-app-muted md:min-h-10 md:text-sm"
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
