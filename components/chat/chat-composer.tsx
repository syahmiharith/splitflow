"use client";

import { PromptInputBox } from "@/components/ui/ai-prompt-box";

export const starterPrompts = [
  {
    label: "BBQ with exclusions",
    message:
      "I am organizing a Han River BBQ for 8 people. Meat is ₩80,000, drinks are ₩20,000, charcoal is ₩10,000, and sides are ₩18,000. Daniel does not eat beef, Sarah already sent me ₩10,000, and I need agreement before I buy everything."
  },
  {
    label: "Trip booking",
    message:
      "Create a Jeju trip split for 6 people before I book. Airbnb is ₩420,000, cleaning is ₩60,000, Sarah paid a ₩90,000 van deposit, and Alex only joins Saturday night."
  },
  {
    label: "House bill",
    message:
      "House bill split for 4 housemates: utilities ₩86,000, delivery groceries ₩64,500, and drinks ₩18,000. Hakim does not drink. Create a proposal we can all review."
  }
];

export function ChatComposer({
  isLoading,
  placeholder,
  showStarterPrompts = true,
  onSend
}: {
  isLoading: boolean;
  placeholder: string;
  showStarterPrompts?: boolean;
  onSend: (message: string, files?: File[]) => void;
}) {
  return (
    <div
      className="bg-page/95 px-3 py-1 shadow-[0_-1px_0_rgba(223,227,232,0.28)] md:px-6 md:py-1.5"
      style={{ borderTopStyle: "none" }}
      data-testid="chat-input-area"
    >
      <div className="mx-auto w-full max-w-3xl">
        {showStarterPrompts ? (
          <div className="mb-1.5 flex gap-1.5 overflow-x-auto pb-0.5" data-testid="chat-starter-prompts">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => onSend(prompt.message)}
                disabled={isLoading}
                className="min-h-8 shrink-0 rounded-md border border-app-border bg-white px-2.5 text-[11px] font-semibold text-app-text hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        ) : null}
        <PromptInputBox
          isLoading={isLoading}
          onSend={onSend}
          placeholder={placeholder}
        />
        <p className="mt-1 text-center text-[11px] leading-4 text-app-muted/75" data-testid="chat-disclaimer">
          AI drafts only. Math and settlement require review.
        </p>
      </div>
    </div>
  );
}
