"use client";

import type { ClientCategory, ClientMessage } from "@/client/api";
import { MessageItem } from "./MessageItem";

type MessageListProps = {
  messages: ClientMessage[];
  onReadToggle: (id: string, isRead: boolean) => Promise<void>;
  onCategoryChange: (id: string, category: ClientCategory) => Promise<void>;
};

export function MessageList({
  messages,
  onReadToggle,
  onCategoryChange
}: MessageListProps) {
  if (messages.length === 0) {
    return <p className="empty-state">没有匹配的短信</p>;
  }

  return (
    <section className="message-list" aria-label="短信列表">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onReadToggle={onReadToggle}
          onCategoryChange={onCategoryChange}
        />
      ))}
    </section>
  );
}
