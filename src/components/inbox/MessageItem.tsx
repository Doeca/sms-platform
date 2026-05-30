"use client";

import { useState } from "react";
import { Mail, MailOpen } from "lucide-react";
import type { ClientCategory, ClientMessage } from "@/client/api";

type MessageItemProps = {
  message: ClientMessage;
  onReadToggle: (id: string, isRead: boolean) => Promise<void>;
  onCategoryChange: (id: string, category: ClientCategory) => Promise<void>;
};

const categoryLabels: Record<ClientCategory, string> = {
  verification: "验证码",
  loan_collection: "贷款/催收",
  other: "其他"
};

export function MessageItem({
  message,
  onReadToggle,
  onCategoryChange
}: MessageItemProps) {
  const [pending, setPending] = useState(false);

  async function runAction(action: () => Promise<void>) {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      await action();
    } finally {
      setPending(false);
    }
  }

  return (
    <article
      className={`message-item ${message.isRead ? "is-read" : "is-unread"}`}
    >
      <header className="message-item__header">
        <span className={`category category--${message.category}`}>
          {categoryLabels[message.category]}
        </span>
        <strong>{message.sender}</strong>
        <span>{message.source.label}</span>
        <time dateTime={message.receivedAt}>
          {new Date(message.receivedAt).toLocaleString("zh-CN")}
        </time>
      </header>

      <p className="message-item__body">{message.body}</p>

      <footer className="message-item__actions">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            void runAction(() => onReadToggle(message.id, !message.isRead))
          }
        >
          {message.isRead ? <Mail size={16} /> : <MailOpen size={16} />}
          {message.isRead ? "标记未读" : "标记已读"}
        </button>

        <label>
          修改分类
          <select
            value={message.category}
            disabled={pending}
            onChange={(event) =>
              void runAction(() =>
                onCategoryChange(message.id, event.target.value as ClientCategory)
              )
            }
          >
            <option value="verification">验证码</option>
            <option value="loan_collection">贷款/催收</option>
            <option value="other">其他</option>
          </select>
        </label>
      </footer>
    </article>
  );
}
