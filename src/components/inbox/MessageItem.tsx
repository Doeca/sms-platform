"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import type { ClientCategory, ClientMessage } from "@/client/api";

type MessageItemProps = {
  message: ClientMessage;
  selected?: boolean;
  selectMode?: boolean;
  onCategoryChange: (id: string, category: ClientCategory) => Promise<void>;
  onSelectionToggle: (id: string) => void;
};

const categoryLabels: Record<ClientCategory, string> = {
  verification: "验证码",
  loan_collection: "金融",
  other: "其他"
};

const categoryOptions: ClientCategory[] = [
  "verification",
  "loan_collection",
  "other"
];

export function MessageItem({
  message,
  selected = false,
  selectMode = false,
  onCategoryChange,
  onSelectionToggle
}: MessageItemProps) {
  const [pending, setPending] = useState(false);
  const selectedClass = selected ? " is-selected" : "";
  const modeClass = selectMode ? " is-select-mode" : "";

  async function changeCategory(category: ClientCategory) {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      await onCategoryChange(message.id, category);
    } finally {
      setPending(false);
    }
  }

  function toggleSelection() {
    onSelectionToggle(message.id);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    toggleSelection();
  }

  return (
    <article
      aria-label={`短信 ${message.sender}`}
      aria-pressed={selectMode ? selected : undefined}
      className={`message-item ${
        message.isRead ? "is-read" : "is-unread"
      }${selectedClass}${modeClass}`}
      onClick={selectMode ? toggleSelection : undefined}
      onKeyDown={selectMode ? handleRowKeyDown : undefined}
      role={selectMode ? "button" : undefined}
      tabIndex={selectMode ? 0 : undefined}
    >
      {selectMode ? (
        <span
          aria-hidden="true"
          className="message-item__select-control"
        >
          {selected ? "✓" : ""}
        </span>
      ) : message.isRead ? (
        <span aria-hidden="true" className="message-item__unread-spacer" />
      ) : (
        <span aria-label="未读" className="message-item__unread-dot" />
      )}

      <div className="message-item__content">
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

        {!selectMode && (
          <footer className="message-item__actions">
            <select
              aria-label="修改分类"
              className="message-item__category-control"
              value={message.category}
              disabled={pending}
              onChange={(event) =>
                void changeCategory(event.target.value as ClientCategory)
              }
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </footer>
        )}
      </div>
    </article>
  );
}
