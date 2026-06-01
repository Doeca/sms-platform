# Message Detail Read Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users click a single SMS in normal mode to open a centered detail dialog and mark that SMS read immediately.

**Architecture:** Keep `InboxApp` as the state owner for opened message ID, optimistic read updates, and API calls. Add a focused `MessageDetailDialog` component for the centered reading surface, and extend `MessageItem`/`MessageList` with an `onOpen` callback while preserving select mode behavior. Styling stays in `app/globals.css`, matching the existing compact inbox visual system.

**Tech Stack:** Next.js App Router, React 19 client components, TypeScript, Vitest, Testing Library, existing `/api/messages/:id` PATCH client helper.

---

## Scope Check

The approved spec covers one frontend interaction flow: open one message, mark it read, show details, preserve selection behavior, and handle update failures. It does not require backend API changes, database schema changes, routing changes, message deletion, replies, or mark-unread actions. This can be implemented as one cohesive frontend plan.

## File Structure

- Create `src/components/inbox/MessageDetailDialog.tsx`
  - Owns dialog rendering, Escape/backdrop/close button close behavior, focus entry/return, and detail category select.
  - Depends on `ClientMessage`, `ClientCategory`, and existing category labels from `category-config.ts`.

- Create `src/components/inbox/MessageDetailDialog.test.tsx`
  - Unit tests for dialog content, close controls, Escape handling, focus return, and dialog category change.

- Modify `src/components/inbox/MessageItem.tsx`
  - Adds normal-mode row click/keyboard open behavior.
  - Keeps select-mode row selection behavior.
  - Ignores clicks originating from the category select.
  - Reuses `inboxCategoryTabs` and `getCategoryLabel` instead of local duplicate label maps.

- Modify `src/components/inbox/MessageItem.test.tsx`
  - Adds tests for normal-mode open callbacks, keyboard open, category select click isolation, and select mode non-regression.

- Modify `src/components/inbox/MessageList.tsx`
  - Passes the `onOpen` callback from `InboxApp` into each `MessageItem`.

- Modify `src/components/inbox/InboxApp.tsx`
  - Owns `openMessageId`.
  - Performs optimistic read marking and stats decrement.
  - Calls `updateMessage(id, { isRead: true })`.
  - Renders `MessageDetailDialog`.
  - Closes the dialog if the open message disappears after refresh.

- Modify `src/components/inbox/InboxApp.test.tsx`
  - Tests the complete app flow: open, optimistic read, unread filter retention, already-read no-op, read failure, dialog category update, and select mode non-regression.

- Modify `app/globals.css`
  - Adds clickable row focus/hover states and centered dialog/backdrop styles.

## Implementation Notes

- The current working tree may contain unrelated changes from the timestamp/deployment work. During implementation commits, stage only the files listed in the task's commit step.
- Use TDD order: write the failing test, run it, implement, run it again.
- Do not introduce a new backend endpoint. Use the existing `updateMessage` helper.
- Do not refactor the polling or notification hook. Reading a visible message should not block notification refresh.

---

### Task 1: Add The Message Detail Dialog Component

**Files:**
- Create: `src/components/inbox/MessageDetailDialog.test.tsx`
- Create: `src/components/inbox/MessageDetailDialog.tsx`

- [ ] **Step 1: Write the failing dialog tests**

Create `src/components/inbox/MessageDetailDialog.test.tsx` with this content:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@/client/api";
import { MessageDetailDialog } from "./MessageDetailDialog";

const message: ClientMessage = {
  id: "msg-1",
  sender: "955xx",
  body: "第一行验证码\n第二行请勿泄露",
  receivedAt: "2026-05-30T08:30:00.000Z",
  createdAt: "2026-05-30T08:30:01.000Z",
  category: "verification",
  classificationSource: "keyword",
  classificationError: null,
  isRead: false,
  source: {
    id: "source-1",
    receivedPhoneNumber: "+8613800000000",
    deviceName: "Redmi 1",
    simSlot: 1,
    label: "Redmi 1 · SIM 1"
  }
};

describe("MessageDetailDialog", () => {
  it("renders full message details and the category control", () => {
    render(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={() => undefined}
      />
    );

    expect(
      screen.getByRole("dialog", { name: "短信详情 955xx" })
    ).toBeInTheDocument();
    expect(screen.getByText("955xx")).toBeInTheDocument();
    expect(screen.getByText("Redmi 1 · SIM 1")).toBeInTheDocument();
    expect(
      screen.getByText(new Date(message.receivedAt).toLocaleString("zh-CN"))
    ).toBeInTheDocument();
    expect(screen.getByText("第一行验证码\n第二行请勿泄露")).toBeInTheDocument();
    expect(screen.getByLabelText("修改详情分类")).toHaveValue("verification");
  });

  it("closes from the close button, backdrop, and Escape key", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole("button", { name: "关闭短信详情" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={onClose}
      />
    );
    await user.click(screen.getByTestId("message-detail-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={onClose}
      />
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close when the dialog panel itself is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole("dialog", { name: "短信详情 955xx" }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls category change with the selected category", async () => {
    const onCategoryChange = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      <MessageDetailDialog
        message={message}
        onCategoryChange={onCategoryChange}
        onClose={() => undefined}
      />
    );

    await user.selectOptions(screen.getByLabelText("修改详情分类"), "other");

    expect(onCategoryChange).toHaveBeenCalledWith("msg-1", "other");
  });

  it("moves focus into the dialog and returns focus after unmount", () => {
    const opener = document.createElement("button");
    opener.textContent = "opener";
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={() => undefined}
      />
    );

    expect(screen.getByRole("dialog", { name: "短信详情 955xx" })).toHaveFocus();

    unmount();

    expect(opener).toHaveFocus();
    opener.remove();
  });
});
```

- [ ] **Step 2: Run dialog tests to verify they fail**

Run:

```bash
npm test -- src/components/inbox/MessageDetailDialog.test.tsx
```

Expected: FAIL with an error that includes `Cannot find module './MessageDetailDialog'`.

- [ ] **Step 3: Create the dialog component**

Create `src/components/inbox/MessageDetailDialog.tsx` with this content:

```tsx
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
```

- [ ] **Step 4: Run dialog tests to verify they pass**

Run:

```bash
npm test -- src/components/inbox/MessageDetailDialog.test.tsx
```

Expected: PASS with `5 passed`.

- [ ] **Step 5: Commit dialog component**

```bash
git add src/components/inbox/MessageDetailDialog.tsx src/components/inbox/MessageDetailDialog.test.tsx
git commit -m "feat: add message detail dialog"
```

---

### Task 2: Make Message Rows Openable In Normal Mode

**Files:**
- Modify: `src/components/inbox/MessageItem.test.tsx`
- Modify: `src/components/inbox/MessageItem.tsx`

- [ ] **Step 1: Add failing MessageItem interaction tests**

Modify `src/components/inbox/MessageItem.test.tsx`:

1. In the existing `"changes category through the compact category control"` test, pass `onOpen={() => undefined}` to `MessageItem`.
2. Add these tests near the existing select-mode tests:

```tsx
  it("opens the message when the row is clicked in normal mode", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onCategoryChange={async () => undefined}
        onOpen={onOpen}
        onSelectionToggle={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: "短信 955xx" }));

    expect(onOpen).toHaveBeenCalledWith("msg-1");
  });

  it("opens the message from the keyboard in normal mode", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onCategoryChange={async () => undefined}
        onOpen={onOpen}
        onSelectionToggle={() => undefined}
      />
    );

    const row = screen.getByRole("button", { name: "短信 955xx" });

    row.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenNthCalledWith(1, "msg-1");
    expect(onOpen).toHaveBeenNthCalledWith(2, "msg-1");
  });

  it("does not open the message when the category control is used", async () => {
    const onCategoryChange = vi.fn(async () => undefined);
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onCategoryChange={onCategoryChange}
        onOpen={onOpen}
        onSelectionToggle={() => undefined}
      />
    );

    await user.selectOptions(screen.getByLabelText("修改分类"), "other");

    expect(onCategoryChange).toHaveBeenCalledWith("msg-1", "other");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not open the message when clicked in select mode", async () => {
    const onOpen = vi.fn();
    const onSelectionToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        selectMode
        onCategoryChange={async () => undefined}
        onOpen={onOpen}
        onSelectionToggle={onSelectionToggle}
      />
    );

    await user.click(screen.getByRole("button", { name: "短信 955xx" }));

    expect(onSelectionToggle).toHaveBeenCalledWith("msg-1");
    expect(onOpen).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run MessageItem tests to verify they fail**

Run:

```bash
npm test -- src/components/inbox/MessageItem.test.tsx
```

Expected: FAIL because normal-mode rows do not have `role="button"` yet and `onOpen` is not a supported prop.

- [ ] **Step 3: Replace MessageItem implementation**

Replace `src/components/inbox/MessageItem.tsx` with this content:

```tsx
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
```

- [ ] **Step 4: Run MessageItem tests to verify they pass**

Run:

```bash
npm test -- src/components/inbox/MessageItem.test.tsx
```

Expected: PASS with the expanded MessageItem test suite.

- [ ] **Step 5: Commit row open behavior**

```bash
git add src/components/inbox/MessageItem.tsx src/components/inbox/MessageItem.test.tsx
git commit -m "feat: make message rows openable"
```

---

### Task 3: Pass Row Open Events Through MessageList

**Files:**
- Modify: `src/components/inbox/MessageList.tsx`

- [ ] **Step 1: Update MessageList props and rendering**

Modify `src/components/inbox/MessageList.tsx` to this content:

```tsx
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
```

- [ ] **Step 2: Run TypeScript through the focused component tests**

Run:

```bash
npm test -- src/components/inbox/MessageItem.test.tsx
```

Expected: PASS. `onMessageOpen` is optional in this task so `InboxApp` continues compiling until Task 4 wires the real handler.

- [ ] **Step 3: Commit MessageList callback plumbing**

```bash
git add src/components/inbox/MessageList.tsx
git commit -m "feat: pass message open callbacks through list"
```

---

### Task 4: Wire InboxApp Detail State And Optimistic Read Updates

**Files:**
- Modify: `src/components/inbox/InboxApp.test.tsx`
- Modify: `src/components/inbox/InboxApp.tsx`

- [ ] **Step 1: Add read-flow test payload helpers**

In `src/components/inbox/InboxApp.test.tsx`, add this payload near the existing payload constants:

```tsx
const readInboxPayload = {
  ...inboxPayload,
  messages: [
    {
      ...inboxPayload.messages[0],
      isRead: true
    }
  ],
  stats: {
    ...inboxPayload.stats,
    unread: 0,
    unreadByCategory: {
      verification: 0,
      loan_collection: 0,
      other: 0
    }
  }
};
```

- [ ] **Step 2: Add failing InboxApp tests for opening and read updates**

In `src/components/inbox/InboxApp.test.tsx`, add these tests after `"loads the inbox immediately when a valid access cookie is already present"`:

```tsx
  it("opens a message detail dialog and marks an unread message read", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/messages/msg-1" && init?.method === "PATCH") {
        return Response.json({
          message: {
            ...inboxPayload.messages[0],
            isRead: true
          }
        });
      }

      return Response.json(inboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<InboxApp initialAuthenticated />);

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "短信 955xx" }));

    expect(
      screen.getByRole("dialog", { name: "短信详情 955xx" })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText("未读")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "验证码" })).not.toHaveTextContent(
      "1"
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/msg-1",
        expect.objectContaining({
          body: JSON.stringify({ isRead: true }),
          method: "PATCH"
        })
      );
    });
  });

  it("keeps an opened message visible under the unread filter after optimistic read", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/messages/msg-1" && init?.method === "PATCH") {
        return Response.json({
          message: {
            ...inboxPayload.messages[0],
            isRead: true
          }
        });
      }

      return Response.json(inboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<InboxApp initialAuthenticated />);

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "筛选" }));
    await user.click(screen.getByRole("menuitemradio", { name: "未读" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages?readState=unread&category=verification"
      );
    });

    await user.click(screen.getByRole("button", { name: "短信 955xx" }));

    expect(
      screen.getByRole("dialog", { name: "短信详情 955xx" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("您的验证码是 123456").length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.queryByLabelText("未读")).not.toBeInTheDocument();
    });
  });

  it("does not send a read patch for an already-read message", async () => {
    const fetchMock = vi.fn(async () => Response.json(readInboxPayload));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<InboxApp initialAuthenticated />);

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "短信 955xx" }));

    expect(
      screen.getByRole("dialog", { name: "短信详情 955xx" })
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => url === "/api/messages/msg-1" && init?.method === "PATCH"
      )
    ).toBe(false);
  });

  it("keeps select mode clicks as selection instead of opening details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(twoUnreadMessagesPayload))
    );
    const user = userEvent.setup();

    render(<InboxApp initialAuthenticated />);

    await waitFor(() => {
      expect(screen.getByText("第二条未读验证码")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "选择" }));
    await user.click(screen.getByRole("button", { name: "短信 955xx" }));

    expect(screen.getByText("已选择 1 条")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: Add failing InboxApp tests for dialog category and read failure**

In `src/components/inbox/InboxApp.test.tsx`, add these tests near the existing category update error tests:

```tsx
  it("updates category from the message detail dialog", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/messages/msg-1" && init?.method === "PATCH") {
        return Response.json({ message: inboxPayload.messages[0] });
      }

      return Response.json(inboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<InboxApp initialAuthenticated />);

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "短信 955xx" }));
    await user.selectOptions(screen.getByLabelText("修改详情分类"), "other");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/msg-1",
        expect.objectContaining({
          body: JSON.stringify({ category: "other" }),
          method: "PATCH"
        })
      );
    });
  });

  it("shows an error and refreshes when marking a detail message read fails", async () => {
    let patchAttempted = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/messages/msg-1" && init?.method === "PATCH") {
        patchAttempted = true;
        throw new Error("database down");
      }

      return Response.json(inboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<InboxApp initialAuthenticated />);

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });
    const visibleFetchesBeforeOpen = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/messages?category=verification"
    ).length;
    await user.click(screen.getByRole("button", { name: "短信 955xx" }));

    await waitFor(() => {
      expect(screen.getByText("短信更新失败")).toBeInTheDocument();
    });
    expect(patchAttempted).toBe(true);
    expect(
      screen.getByRole("dialog", { name: "短信详情 955xx" })
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === "/api/messages?category=verification"
      ).length
    ).toBeGreaterThan(visibleFetchesBeforeOpen);
  });
```

- [ ] **Step 4: Run InboxApp tests to verify they fail**

Run:

```bash
npm test -- src/components/inbox/InboxApp.test.tsx
```

Expected: FAIL because `MessageList` is not passed `onMessageOpen`, no dialog renders, and no optimistic read logic exists.

- [ ] **Step 5: Add InboxApp state helpers**

Modify the client API import in `src/components/inbox/InboxApp.tsx` so it includes `ClientMessage`:

```tsx
import {
  enterAccessKey,
  fetchMessages,
  updateMessage,
  type ClientCategory,
  type ClientMessage,
  type ClientReadState,
  type InboxResponse
} from "@/client/api";
```

Add this import with the other inbox component imports:

```tsx
import { MessageDetailDialog } from "./MessageDetailDialog";
```

Add these helper functions below `type VisibleFilters`:

```tsx
function decrementUnreadStats(
  stats: InboxResponse["stats"],
  category: ClientCategory
): InboxResponse["stats"] {
  return {
    ...stats,
    unread: Math.max(stats.unread - 1, 0),
    unreadByCategory: {
      ...stats.unreadByCategory,
      [category]: Math.max(stats.unreadByCategory[category] - 1, 0)
    }
  };
}

function markMessageReadInInbox(
  inbox: InboxResponse,
  message: ClientMessage
): InboxResponse {
  if (message.isRead) {
    return inbox;
  }

  return {
    ...inbox,
    messages: inbox.messages.map((item) =>
      item.id === message.id ? { ...item, isRead: true } : item
    ),
    stats: decrementUnreadStats(inbox.stats, message.category)
  };
}
```

- [ ] **Step 6: Add InboxApp opened-message state**

Inside `InboxApp`, near the existing `selectedMessageIds` state, add:

```tsx
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);
  const pendingReadMessageIds = useRef<Set<string>>(new Set());
```

Add this derived value after `selectedUnreadCount`:

```tsx
  const openMessage =
    openMessageId === null
      ? null
      : inbox.messages.find((message) => message.id === openMessageId) ?? null;
```

- [ ] **Step 7: Add open-message handlers and cleanup effect**

In `InboxApp`, add this function below `handleCategoryUpdate`:

```tsx
  async function handleMessageOpen(id: string) {
    const message = inbox.messages.find((item) => item.id === id);

    if (!message) {
      return;
    }

    setOpenMessageId(id);

    if (message.isRead || pendingReadMessageIds.current.has(id)) {
      return;
    }

    pendingReadMessageIds.current.add(id);
    setInbox((current) => markMessageReadInInbox(current, message));
    setInboxError(null);

    try {
      await updateMessage(id, { isRead: true });
    } catch {
      const refreshResults = await Promise.allSettled([
        loadMessages(),
        loadNotificationMessages()
      ]);

      if (refreshResults.some((result) => result.status === "rejected")) {
        setInboxError("短信更新失败，短信刷新失败");
      } else {
        setInboxError("短信更新失败");
      }
    } finally {
      pendingReadMessageIds.current.delete(id);
    }
  }
```

Add this effect below the existing filter-ref effect:

```tsx
  useEffect(() => {
    if (
      openMessageId !== null &&
      !inbox.messages.some((message) => message.id === openMessageId)
    ) {
      setOpenMessageId(null);
    }
  }, [inbox.messages, openMessageId]);
```

- [ ] **Step 8: Render dialog and pass open callback**

In the `MessageList` JSX, add `onMessageOpen={handleMessageOpen}`:

```tsx
      <MessageList
        emptyMessage={getEmptyMessage(activeCategory, readState)}
        messages={inbox.messages}
        selectedIds={selectedMessageIds}
        selectMode={selectMode}
        onCategoryChange={handleCategoryUpdate}
        onMessageOpen={handleMessageOpen}
        onSelectionToggle={handleSelectionToggle}
      />
```

Render the dialog after `MessageList` and before the bulk action bar:

```tsx
      {openMessage ? (
        <MessageDetailDialog
          message={openMessage}
          onCategoryChange={handleCategoryUpdate}
          onClose={() => setOpenMessageId(null)}
        />
      ) : null}
```

- [ ] **Step 9: Run InboxApp tests to verify they pass**

Run:

```bash
npm test -- src/components/inbox/InboxApp.test.tsx
```

Expected: PASS with the expanded InboxApp test suite.

- [ ] **Step 10: Commit InboxApp wiring**

```bash
git add src/components/inbox/InboxApp.tsx src/components/inbox/InboxApp.test.tsx
git commit -m "feat: mark messages read from detail view"
```

---

### Task 5: Add Dialog And Clickable Row Styling

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add CSS for normal row focus and dialog**

In `app/globals.css`, update the focus-visible selector near the top from:

```css
.toolbar-button:focus-visible,
.notification-toggle:focus-visible,
.category-tab:focus-visible,
.bulk-action-bar button:focus-visible,
.message-item__category-control:focus-visible {
```

to:

```css
.toolbar-button:focus-visible,
.notification-toggle:focus-visible,
.category-tab:focus-visible,
.bulk-action-bar button:focus-visible,
.message-detail-dialog:focus-visible,
.message-detail-dialog button:focus-visible,
.message-detail-dialog select:focus-visible,
.message-item:focus-visible,
.message-item__category-control:focus-visible {
```

Add these rules after the base `.message-item` rule:

```css
.message-item[role="button"] {
  cursor: pointer;
}

.message-item[role="button"]:hover {
  border-color: #c8ccd3;
  background: #fbfbfc;
}
```

Add these dialog styles after `.message-item__category-control:disabled`:

```css
.message-detail-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(17 17 17 / 32%);
}

.message-detail-dialog {
  width: min(560px, 100%);
  max-height: min(680px, calc(100vh - 40px));
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
  background: #ffffff;
  box-shadow: 0 22px 60px rgb(17 17 17 / 22%);
  color: var(--text);
}

.message-detail-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 12px;
}

.message-detail-dialog__eyebrow {
  margin: 0 0 3px;
  color: var(--muted);
  font-size: 12px;
}

.message-detail-dialog h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.message-detail-dialog__close {
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  background: #ffffff;
  color: var(--muted);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}

.message-detail-dialog__close:hover {
  background: #f1f2f4;
  color: var(--text);
}

.message-detail-dialog__meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0 0;
}

.message-detail-dialog__meta div {
  min-width: 0;
}

.message-detail-dialog__meta dt {
  color: var(--muted);
  font-size: 12px;
}

.message-detail-dialog__meta dd {
  margin: 3px 0 0;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.message-detail-dialog__body {
  margin: 16px 0 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 13px;
  background: #fafafa;
  color: #20242a;
  font-size: 15px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.message-detail-dialog__category {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  color: var(--muted);
  font-size: 13px;
}

.message-detail-dialog__category select {
  min-height: 36px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 0 28px 0 10px;
  background: #ffffff;
  color: var(--text);
  font-size: 13px;
}
```

Inside the existing `@media (max-width: 760px)` block, add:

```css
  .message-detail-dialog {
    max-height: min(720px, calc(100vh - 20px));
    padding: 14px;
  }

  .message-detail-dialog__meta {
    grid-template-columns: 1fr;
  }
```

- [ ] **Step 2: Run CSS diff check**

Run:

```bash
git diff --check -- app/globals.css
```

Expected: no output and exit code `0`.

- [ ] **Step 3: Run focused frontend tests after styling**

Run:

```bash
npm test -- src/components/inbox/MessageDetailDialog.test.tsx src/components/inbox/MessageItem.test.tsx src/components/inbox/InboxApp.test.tsx
```

Expected: PASS for all focused frontend tests.

- [ ] **Step 4: Commit styling**

```bash
git add app/globals.css
git commit -m "style: add message detail dialog"
```

---

### Task 6: Final Verification And Browser Check

**Files:**
- No source edits expected.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
DATABASE_URL="file:./test.db" npm run db:push
DATABASE_URL="file:./test.db" npm test
npm run build
git diff --check
```

Expected:

- `db:push` completes successfully.
- Vitest reports all test files passed.
- Next.js build exits with code `0`.
- `git diff --check` prints no whitespace errors.

- [ ] **Step 2: Start the local app for browser verification**

Run:

```bash
npm run dev
```

Expected: Next.js starts on a local URL, normally `http://localhost:3000`.

- [ ] **Step 3: Verify desktop behavior in the browser**

Use the in-app Browser plugin against the local URL. Verify:

- A normal unread message row is clickable.
- Clicking the row opens a centered dialog.
- The unread blue dot disappears immediately.
- The dialog shows sender, source, time, full body, and category select.
- The close button closes the dialog.
- Select mode still opens the bulk action bar and row clicks select instead of opening the dialog.

- [ ] **Step 4: Verify mobile behavior in the browser**

Use the in-app Browser plugin with a mobile viewport around `390x844`. Verify:

- The dialog fits inside the viewport.
- Long body text wraps without horizontal overflow.
- The close button remains visible.
- The detail dialog and bulk action bar are never visible at the same time.

- [ ] **Step 5: Stop the dev server**

Stop the `npm run dev` process with `Ctrl+C`.

- [ ] **Step 6: Commit any verification-only fixture cleanup**

If browser verification required adding local test records through the database or API, remove those records and run:

```bash
git status --short
```

Expected: no generated fixture files are staged or left behind.

- [ ] **Step 7: Final implementation commit status check**

Run:

```bash
git status --short --branch
git log --oneline --decorate -5
```

Expected:

- Only intentional commits for this feature are present.
- No unrelated local files are staged.
- Any unrelated pre-existing dirty files remain unstaged.

---

## Self-Review

Spec coverage:

- Centered detail dialog: Task 1 and Task 5.
- Click one visible message to open: Task 2 and Task 4.
- Mark unread message read on open: Task 4.
- Keep message visible under `未读` after optimistic read: Task 4 tests and implementation.
- Dialog details: Task 1.
- Category correction in dialog: Task 1 and Task 4.
- Select mode unchanged: Task 2 and Task 4.
- Error handling for read update failure: Task 4.
- Accessibility and focus: Task 1, Task 2, Task 5.
- Responsive browser check: Task 6.

Placeholder scan:

- This plan contains no incomplete markers or incomplete file paths.
- Every code-changing task includes exact code blocks and exact commands.

Type consistency:

- `onMessageOpen` is introduced in `MessageList` and passed by `InboxApp`.
- `onOpen` is introduced in `MessageItem` and receives the message ID.
- `MessageDetailDialog` uses the existing `ClientMessage` and `ClientCategory` types.
- Read updates use the existing `updateMessage(id, { isRead: true })` helper.
