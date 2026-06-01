"use client";

import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { ClientCategory, ClientMessage } from "@/client/api";
import { getCategoryLabel, inboxCategoryTabs } from "./category-config";

type MessageItemProps = {
  message: ClientMessage;
  selected?: boolean;
  selectMode?: boolean;
  onCategoryChange: (id: string, category: ClientCategory) => Promise<void>;
  onOpen?: (id: string) => void;
  onSelectionToggle: (id: string) => void;
};

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest("a, button, input, label, select, textarea")
  );
}

export function MessageItem({
  message,
  selected = false,
  selectMode = false,
  onCategoryChange,
  onOpen = () => undefined,
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

  function openMessage() {
    onOpen(message.id);
  }

  function handleRowClick(event: MouseEvent<HTMLElement>) {
    if (!selectMode && isInteractiveTarget(event.target)) {
      return;
    }

    if (selectMode) {
      toggleSelection();
      return;
    }

    openMessage();
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();

    if (selectMode) {
      toggleSelection();
      return;
    }

    openMessage();
  }

  return (
    <article
      aria-label={`短信 ${message.sender}`}
      aria-pressed={selectMode ? selected : undefined}
      className={`message-item ${
        message.isRead ? "is-read" : "is-unread"
      }${selectedClass}${modeClass}`}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      role="button"
      tabIndex={0}
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
              {inboxCategoryTabs.map((tab) => (
                <option key={tab.category} value={tab.category}>
                  {getCategoryLabel(tab.category)}
                </option>
              ))}
            </select>
          </footer>
        )}
      </div>
    </article>
  );
}
