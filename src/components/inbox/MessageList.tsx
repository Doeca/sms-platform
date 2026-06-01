"use client";

import type { ClientCategory, ClientMessage } from "@/client/api";
import { MessageItem } from "./MessageItem";

type MessageListProps = {
  emptyMessage: string;
  messages: ClientMessage[];
  selectedIds: Set<string>;
  selectMode: boolean;
  onCategoryChange: (id: string, category: ClientCategory) => Promise<void>;
  onMessageOpen?: (id: string) => void;
  onSelectionToggle: (id: string) => void;
};

export function MessageList({
  emptyMessage,
  messages,
  selectedIds,
  selectMode,
  onCategoryChange,
  onMessageOpen,
  onSelectionToggle
}: MessageListProps) {
  if (messages.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <section className="message-list" aria-label="短信列表">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          selected={selectedIds.has(message.id)}
          selectMode={selectMode}
          onCategoryChange={onCategoryChange}
          onOpen={onMessageOpen}
          onSelectionToggle={onSelectionToggle}
        />
      ))}
    </section>
  );
}
