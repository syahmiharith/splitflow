"use client";

import { MessageSquareText } from "lucide-react";

export function ChatEmptyState({ onPrompt }: { onPrompt: (message: string) => void }) {
  return (
    <section data-testid="chat-empty-state" className="rounded-lg border border-dashed border-app-border bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-app-blue">
          <MessageSquareText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-app-text">Start with messy group-payment context</h2>
          <p className="mt-1 text-sm leading-6 text-app-muted">
            SplitFlow will extract costs, rules, claimed payments, and readiness blockers into a reviewable agreement workflow.
          </p>
          <button
            type="button"
            onClick={() => onPrompt("Create Han River BBQ proposal")}
            className="mt-3 min-h-9 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-app-blue hover:bg-blue-100"
          >
            Create Han River BBQ proposal
          </button>
        </div>
      </div>
    </section>
  );
}
