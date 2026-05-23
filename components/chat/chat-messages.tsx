"use client";

import { compactTime } from "@/lib/format";
import type { BotMessage } from "@/lib/types";

export function ChatMessages({ messages }: { messages: BotMessage[] }) {
  return (
    <div className="space-y-4" data-testid="chat-messages">
      {messages.map((chatMessage) => {
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
  );
}
