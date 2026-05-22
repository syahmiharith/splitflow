"use client";

import { FormEvent, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { compactTime } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import { AssistantAvatar, ProposalSummaryCard } from "@/components/proposal-summary-card";
import { BreakdownPanels } from "@/components/breakdown-panels";
import { RightWorkflowPanel } from "@/components/right-panel";

export function ChatWorkspace() {
  const { state, activeProposal, sendChatMessage, sendProposal, reviewProposal, askAiToAdjust } = useSplitFlow();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setMessage("");
    await sendChatMessage(trimmed);
    setSubmitting(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col lg:h-[calc(100vh-76px)] lg:min-h-0 lg:flex-row" data-testid="chat-route">
      <section className="flex h-[calc(100vh-152px-env(safe-area-inset-bottom))] shrink-0 flex-col lg:h-auto lg:min-h-0 lg:min-w-0 lg:flex-1">
        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          <div className="space-y-5 md:space-y-3">
            {state.messages.map((chatMessage) => (
              <div key={chatMessage.id} className={chatMessage.sender === "user" ? "flex justify-end gap-3" : "flex justify-start gap-3"}>
                {chatMessage.sender !== "user" ? <AssistantAvatar /> : null}
                <div className={`max-w-[78%] md:max-w-[720px] ${chatMessage.sender === "user" ? "order-1" : ""}`}>
                  <div
                    className={`rounded-2xl border px-4 py-3 text-base leading-7 shadow-[0_1px_2px_rgba(24,33,47,0.04)] md:rounded-lg md:px-5 md:leading-6 ${
                      chatMessage.sender === "user"
                        ? "border-app-blue bg-app-blue text-white md:border-blue-200 md:bg-blue-50 md:text-app-text"
                        : "border-app-border bg-white text-app-text"
                    }`}
                  >
                    {chatMessage.content}
                  </div>
                  <div className={`mt-2 text-sm text-app-muted md:mt-1.5 md:text-xs ${chatMessage.sender === "user" ? "text-right" : "pl-3"}`}>
                    {compactTime(chatMessage.createdAt)}
                  </div>
                </div>
                {chatMessage.sender === "user" ? (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-200 text-xs font-semibold">You</div>
                ) : null}
              </div>
            ))}
          </div>

          {state.aiUnavailable ? (
            <div data-testid="ai-unavailable" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-app-text">
              AI unavailable: {state.lastAiError ?? "Configure the server API key to enable live AI drafting."}
            </div>
          ) : null}

          <ProposalSummaryCard proposal={activeProposal} onReview={reviewProposal} onAdjust={askAiToAdjust} onSend={sendProposal} />
          <BreakdownPanels proposal={activeProposal} />
        </div>

        <div className="border-t border-app-border bg-page px-4 py-2 md:px-6 md:py-3" data-testid="chat-input-area">
          <form onSubmit={onSubmit} className="flex min-h-16 items-center gap-3 rounded-2xl border border-app-border bg-white p-2 shadow-[0_1px_2px_rgba(24,33,47,0.04)] md:min-h-0 md:rounded-lg">
            <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-app-muted hover:bg-slate-50 md:h-10 md:w-10 md:rounded-md" aria-label="Attach file">
              <Paperclip className="h-6 w-6 md:h-5 md:w-5" aria-hidden="true" />
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
