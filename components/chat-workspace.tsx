"use client";

import { FormEvent, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Utensils } from "lucide-react";
import { compactTime } from "@/lib/format";
import { createSplitFlowChatTransport } from "@/lib/ai/splitflow-chat-transport";
import { useSplitFlow } from "@/lib/store";
import { AssistantAvatar, ProposalSummaryCard } from "@/components/proposal-summary-card";
import { BreakdownPanels } from "@/components/breakdown-panels";
import { DemoToolbar } from "@/components/demo-toolbar";
import { RightWorkflowPanel } from "@/components/right-panel";

export function ChatWorkspace() {
  const { state, activeProposal, applyAgentResponse, sendProposal, reviewProposal, askAiToAdjust } = useSplitFlow();
  const [message, setMessage] = useState("");
  const [chatError, setChatError] = useState<string | undefined>();
  const { messages, sendMessage, status, error } = useChat({
    messages: state.messages.map((chatMessage) => ({
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
    try {
      await sendMessage({ text: trimmed });
    } catch (sendError) {
      setChatError(sendError instanceof Error ? sendError.message : "Agent workflow unavailable.");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col lg:h-[calc(100vh-76px)] lg:min-h-0 lg:flex-row" data-testid="chat-route">
      <section className="flex h-[calc(100vh-152px-env(safe-area-inset-bottom))] shrink-0 flex-col lg:h-auto lg:min-h-0 lg:min-w-0 lg:flex-1">
        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          <DemoToolbar />
          <div className="space-y-5 md:space-y-3">
            {messages.map((chatMessage) => {
              const content = chatMessage.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("");
              const isUser = chatMessage.role === "user";

              return (
              <div key={chatMessage.id} className={isUser ? "flex justify-end gap-3" : "flex justify-start gap-3"}>
                {!isUser ? <AssistantAvatar /> : null}
                <div className={`max-w-[78%] md:max-w-[720px] ${isUser ? "order-1" : ""}`}>
                  <div
                    className={`rounded-2xl border px-4 py-3 text-base leading-7 shadow-[0_1px_2px_rgba(24,33,47,0.04)] md:rounded-lg md:px-5 md:leading-6 ${
                      isUser
                        ? "border-app-blue bg-app-blue text-white md:border-blue-200 md:bg-blue-50 md:text-app-text"
                        : "border-app-border bg-white text-app-text"
                    }`}
                  >
                    {content}
                  </div>
                  <div className={`mt-2 text-sm text-app-muted md:mt-1.5 md:text-xs ${isUser ? "text-right" : "pl-3"}`}>
                    {compactTime(new Date().toISOString())}
                  </div>
                </div>
                {isUser ? (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-200 text-xs font-semibold">You</div>
                ) : null}
              </div>
              );
            })}
          </div>

          {state.aiUnavailable || error || chatError ? (
            <div data-testid="ai-unavailable" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-app-text">
              AI unavailable: {chatError ?? error?.message ?? state.lastAiError ?? "Configure the server API key to enable live AI drafting."}
            </div>
          ) : null}

          <ProposalSummaryCard proposal={activeProposal} onReview={reviewProposal} onAdjust={askAiToAdjust} onSend={sendProposal} />
          <BreakdownPanels proposal={activeProposal} />
        </div>

        <div className="border-t border-app-border bg-page px-4 py-2 md:px-6 md:py-3" data-testid="chat-input-area">
          <form onSubmit={onSubmit} className="flex min-h-16 items-center gap-3 rounded-2xl border border-app-border bg-white p-2 shadow-[0_1px_2px_rgba(24,33,47,0.04)] md:min-h-0 md:rounded-lg">
            <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-app-muted hover:bg-slate-50 md:h-10 md:w-10 md:rounded-md" aria-label="Attach file">
              <Utensils className="h-6 w-6 md:h-5 md:w-5" aria-hidden="true" />
            </button>
            <input
              data-testid="chat-input"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Message Split Agent..."
              className="min-w-0 flex-1 border-l border-app-border bg-transparent px-4 py-2 text-base outline-none placeholder:text-app-muted md:text-sm"
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

      <RightWorkflowPanel proposal={activeProposal} agentSteps={state.agentSteps} />
    </div>
  );
}
