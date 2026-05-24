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
  onSend
}: {
  isLoading: boolean;
  placeholder: string;
  onSend: (message: string, files?: File[]) => void;
}) {
  return (
    <div className="border-t border-app-border bg-page px-4 pb-5 pt-3 md:px-6 md:pb-6 md:pt-4" data-testid="chat-input-area">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" data-testid="chat-starter-prompts">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSend(prompt)}
              disabled={isLoading}
              className="min-h-9 shrink-0 rounded-lg border border-app-border bg-white px-3 text-xs font-semibold text-app-text hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {prompt}
            </button>
          ))}
        </div>
        <PromptInputBox
          isLoading={isLoading}
          onSend={onSend}
          placeholder={placeholder}
        />
        <p className="mt-2 text-center text-xs leading-5 text-app-muted">
          AI drafts artifacts. Deterministic math and human review decide settlement readiness.
        </p>
      </div>
    </div>
  );
}
