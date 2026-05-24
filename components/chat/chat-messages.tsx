"use client";

import { compactTime } from "@/lib/format";
import type { BotMessage } from "@/lib/types";

export function ChatThread({ messages }: { messages: BotMessage[] }) {
  return (
    <div className="space-y-3" data-testid="chat-messages">
      {messages.map((chatMessage) => (
        <ChatMessageBubble key={chatMessage.id} message={chatMessage} />
      ))}
    </div>
  );
}

export function ChatMessages(props: { messages: BotMessage[] }) {
  return <ChatThread {...props} />;
}

export function ChatMessageBubble({ message }: { message: BotMessage }) {
  const isUser = message.sender === "user";
  const align = isUser ? "justify-end" : "justify-start";
  const width = isUser ? "max-w-[min(560px,78%)]" : "max-w-[min(640px,86%)]";

  return (
    <div className={`flex ${align}`} data-testid={isUser ? "chat-user-message" : "chat-assistant-message"}>
      <div
        className={`${width} rounded-lg border px-4 py-3 text-sm leading-6 shadow-[0_1px_2px_rgba(24,33,47,0.03)] ${
          isUser ? "border-blue-200 bg-blue-50 text-app-text" : "border-app-border bg-white text-app-text"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <div className="mt-2 text-xs text-app-muted" suppressHydrationWarning>
          {compactTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
