"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { ClientCategory, ClientMessage } from "@/client/api";
import { getCategoryLabel, inboxCategoryTabs } from "./category-config";

type MessageDetailDialogProps = {
  message: ClientMessage;
  onCategoryChange: (id: string, category: ClientCategory) => Promise<void>;
  onClose: () => void;
};

export function MessageDetailDialog({
  message,
  onCategoryChange,
  onClose
}: MessageDetailDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [pendingCategory, setPendingCategory] = useState(false);
  const titleId = `message-detail-title-${message.id}`;
  const bodyId = `message-detail-body-${message.id}`;

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  async function changeCategory(category: ClientCategory) {
    if (pendingCategory) {
      return;
    }

    setPendingCategory(true);

    try {
      await onCategoryChange(message.id, category);
    } finally {
      setPendingCategory(false);
    }
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="message-detail-backdrop"
      data-testid="message-detail-backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        aria-describedby={bodyId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="message-detail-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="message-detail-dialog__header">
          <div>
            <p className="message-detail-dialog__eyebrow">短信详情</p>
            <h2 id={titleId}>短信详情 {message.sender}</h2>
          </div>
          <button
            aria-label="关闭短信详情"
            className="message-detail-dialog__close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <dl className="message-detail-dialog__meta">
          <div>
            <dt>发件人</dt>
            <dd>{message.sender}</dd>
          </div>
          <div>
            <dt>来源</dt>
            <dd>{message.source.label}</dd>
          </div>
          <div>
            <dt>时间</dt>
            <dd>
              <time dateTime={message.receivedAt}>
                {new Date(message.receivedAt).toLocaleString("zh-CN")}
              </time>
            </dd>
          </div>
        </dl>

        <p className="message-detail-dialog__body" id={bodyId}>
          {message.body}
        </p>

        <label className="message-detail-dialog__category">
          <span>分类</span>
          <select
            aria-label="修改详情分类"
            disabled={pendingCategory}
            value={message.category}
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
        </label>
      </section>
    </div>
  );
}
