"use client";

import { PromptInputBox } from "@/components/ui/ai-prompt-box";

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
        <PromptInputBox
          isLoading={isLoading}
          onSend={onSend}
          placeholder={placeholder}
        />
        <p className="mt-2 text-center text-xs leading-5 text-app-muted">
          AI can make mistakes. Review calculated amounts before sending.
        </p>
      </div>
    </div>
  );
}
