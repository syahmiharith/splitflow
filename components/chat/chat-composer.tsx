"use client";

import { PromptInputBox } from "@/components/ui/ai-prompt-box";

const starterPrompts = [
  "Create Han River BBQ proposal",
  "Parse pasted receipt",
  "Resolve participant exclusion",
  "Create settlement plan"
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
                key={prompt}
                type="button"
                onClick={() => onSend(prompt)}
                disabled={isLoading}
                className="min-h-8 shrink-0 rounded-md border border-app-border bg-white px-2.5 text-[11px] font-semibold text-app-text hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
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
