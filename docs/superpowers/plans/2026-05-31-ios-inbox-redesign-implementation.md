# iOS Inbox Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the SMS inbox into an iOS-style category inbox with compact tabs, read-state filtering, blue unread dots, multi-select mark-read, and three-category Kimi classification.

**Architecture:** Keep the current Next.js App Router, Prisma repository, and component-driven React structure. Expand the backend response with unread counts per category, then replace the old stats/filter UI with focused client components that compose inside `InboxApp`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 6, SQLite, Vitest, Testing Library, lucide-react.

---

## Scope Check

The spec has two implementation areas: backend classification/statistics and frontend inbox interaction. They are small and share the same release surface because category tabs need accurate backend unread counts, and the UI copy depends on the corrected three-category classifier. Keep them in one plan with separate commits per task.

## File Structure

- Modify `src/server/classification/types.ts`: widen `KimiCategory` to all message categories.
- Modify `src/server/classification/kimi.ts`: update prompt, request instruction, and response parsing for three categories.
- Modify `src/server/classification/kimi.test.ts`: prove Kimi accepts all three categories and rejects unsupported values.
- Modify `src/server/classification/classify.test.ts`: prove Kimi can classify a non-keyword SMS as `verification`.
- Modify `src/server/messages/repository.ts`: return `stats.unreadByCategory`.
- Modify `src/server/messages/repository.test.ts`: test unread counts by category.
- Modify `app/api/messages/route.test.ts`: test API serialization of `unreadByCategory`.
- Modify `src/client/api.ts`: add `unreadByCategory` to `InboxResponse.stats`.
- Create `src/components/inbox/category-config.ts`: central labels and empty-state helpers for category tabs.
- Create `src/components/inbox/CategoryTabs.tsx`: segmented category navigation with unread badges.
- Create `src/components/inbox/CategoryTabs.test.tsx`: test tab labels, unread badges, and `金融` mapping.
- Create `src/components/inbox/ReadFilterMenu.tsx`: compact read-state filter popover.
- Create `src/components/inbox/ReadFilterMenu.test.tsx`: test filter state changes and no source filter UI.
- Modify `src/components/inbox/MessageItem.tsx`: blue unread dot, select mode, compact category correction.
- Modify `src/components/inbox/MessageItem.test.tsx`: update tests for dot/select/category behavior.
- Modify `src/components/inbox/MessageList.tsx`: pass select-mode props and category-aware empty states.
- Modify `src/components/inbox/InboxApp.tsx`: orchestrate tabs, read filter, select mode, batch mark-read, notification feed.
- Modify `src/components/inbox/InboxApp.test.tsx`: update fetch expectations and add tab/filter/batch tests.
- Modify `app/globals.css`: replace stats/filter/card-heavy styling with compact responsive inbox styling.
- Delete `src/components/inbox/StatsBar.tsx`, `src/components/inbox/StatsBar.test.tsx`, `src/components/inbox/FilterBar.tsx`, and `src/components/inbox/FilterBar.test.tsx` after replacements are used.

## Implementation Notes

- Use npm scripts instead of direct `next`, `vitest`, or `prisma` binaries because this project intentionally wraps those commands in `package.json`.
- Preserve the existing dirty `next-env.d.ts` file. Do not stage, edit, or revert it.
- Run targeted tests after each task, then commit only the files changed by that task.
- The expected query order from `fetchMessages` is `readState` first, then `category`, because `src/client/api.ts` currently appends params in that order.

### Task 1: Expand Kimi Classification To Three Categories

**Files:**
- Modify: `src/server/classification/types.ts`
- Modify: `src/server/classification/kimi.ts`
- Test: `src/server/classification/kimi.test.ts`
- Test: `src/server/classification/classify.test.ts`

- [ ] **Step 1: Update Kimi tests first**

Replace the first two tests in `src/server/classification/kimi.test.ts` with these tests. Leave the malformed JSON, missing content, blank key, timeout, and non-2xx tests in place.

```ts
  it.each([
    ["verification", "您的登录动态码为 123456"],
    ["loan_collection", "请尽快处理逾期还款"],
    ["other", "您的快递已到达驿站"]
  ] as const)("maps a valid %s Kimi JSON response", async (category, body) => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({ category })
            }
          }
        ]
      })
    );

    await expect(
      classifyWithKimi(body, {
        apiKey: " key ",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 8000,
        fetchImpl
      })
    ).resolves.toBe(category);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.moonshot.cn/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer key",
          "Content-Type": "application/json"
        })
      })
    );

    const fetchCalls = fetchImpl.mock.calls as unknown as Array<
      [RequestInfo | URL, RequestInit?]
    >;
    const requestInit = fetchCalls[0]?.[1];
    const requestBody = JSON.parse(String(requestInit?.body)) as {
      model?: unknown;
      messages?: Array<{ role?: string; content?: string }>;
      response_format?: unknown;
      max_completion_tokens?: unknown;
      stream?: unknown;
    };

    expect(requestBody).toEqual(
      expect.objectContaining({
        model: "kimi-k2.6",
        response_format: { type: "json_object" },
        max_completion_tokens: 50,
        stream: false
      })
    );
    expect(requestBody.messages).toHaveLength(2);
    expect(requestBody.messages?.[1]?.content).toContain(
      '{"category":"verification"}'
    );
    expect(requestBody.messages?.[1]?.content).toContain(
      '{"category":"loan_collection"}'
    );
    expect(requestBody.messages?.[1]?.content).toContain('{"category":"other"}');
  });

  it("throws for invalid response categories", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: "{\"category\":\"spam\"}"
            }
          }
        ]
      })
    );

    await expect(
      classifyWithKimi("ambiguous text", {
        apiKey: "key",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 8000,
        fetchImpl
      })
    ).rejects.toThrow("Invalid Kimi category");
  });
```

Add this test to `src/server/classification/classify.test.ts` after `uses Kimi for non-verification messages`.

```ts
  it("uses Kimi verification when keywords do not match", async () => {
    const classifyWithKimi = vi.fn(async () => "verification" as const);

    const result = await classifyMessage("登录动态数字为 246810", {
      classifyWithKimi
    });

    expect(result).toEqual({ category: "verification", source: "kimi" });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/server/classification/kimi.test.ts src/server/classification/classify.test.ts
```

Expected: FAIL because `verification` is currently rejected by `parseKimiCategory`, and TypeScript-aware test transforms may also complain that the injected Kimi classifier cannot return `verification`.

- [ ] **Step 3: Update classification types**

Replace the `KimiCategory` definition in `src/server/classification/types.ts` with:

```ts
export type KimiCategory = MessageCategory;
```

- [ ] **Step 4: Update Kimi prompt, request text, and parser**

In `src/server/classification/kimi.ts`, replace the `SYSTEM_PROMPT` and `parseKimiCategory` implementation with:

```ts
const SYSTEM_PROMPT =
  "你是短信分类器。判断短信属于验证码、金融贷款/还款/逾期/催收相关内容，还是其他内容。只输出 JSON。";

function parseKimiCategory(content: string): KimiCategory {
  const parsed = JSON.parse(content) as { category?: unknown };

  if (
    parsed.category === "verification" ||
    parsed.category === "loan_collection" ||
    parsed.category === "other"
  ) {
    return parsed.category;
  }

  throw new Error("Invalid Kimi category");
}
```

In the same file, replace the user message `content` passed to Kimi with:

```ts
content:
  "请分类这条短信。只能返回 " +
  '{"category":"verification"}、{"category":"loan_collection"} 或 {"category":"other"}。' +
  `\n\n短信内容：${body}`
```

- [ ] **Step 5: Run classification tests**

Run:

```bash
npm test -- src/server/classification/kimi.test.ts src/server/classification/classify.test.ts
```

Expected: PASS for both test files.

- [ ] **Step 6: Commit classification changes**

Run:

```bash
git add src/server/classification/types.ts src/server/classification/kimi.ts src/server/classification/kimi.test.ts src/server/classification/classify.test.ts
git commit -m "fix: allow kimi verification classification"
```

### Task 2: Add Accurate Unread Counts Per Category

**Files:**
- Modify: `src/server/messages/repository.ts`
- Modify: `src/server/messages/repository.test.ts`
- Modify: `app/api/messages/route.test.ts`
- Modify: `src/client/api.ts`

- [ ] **Step 1: Write repository test for unread category counts**

Add this test to `src/server/messages/repository.test.ts` after `filters messages by read state and category`.

```ts
  it("returns unread counts grouped by category", async () => {
    const verification = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613900000000",
        sender: "loan",
        body: "请尽快还款",
        receivedAt: new Date("2026-05-30T08:31:00.000Z")
      },
      { category: "loan_collection", source: "kimi" }
    );

    await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613700000000",
        sender: "10086",
        body: "普通通知",
        receivedAt: new Date("2026-05-30T08:32:00.000Z")
      },
      { category: "other", source: "kimi" }
    );

    await updateMessage(verification.message.id, { isRead: true });

    const result = await listMessages({
      readState: "all",
      limit: 100
    });

    expect(result.stats.unreadByCategory).toEqual({
      verification: 0,
      loan_collection: 1,
      other: 1
    });
  });
```

- [ ] **Step 2: Write route serialization assertion**

In `app/api/messages/route.test.ts`, inside `returns messages, sources, and stats`, add this assertion after `expect(json.stats.verification).toBe(1);`.

```ts
    expect(json.stats.unreadByCategory).toEqual({
      verification: 1,
      loan_collection: 0,
      other: 0
    });
```

- [ ] **Step 3: Run backend message tests to verify they fail**

Run:

```bash
DATABASE_URL="file:./test.db" npm test -- src/server/messages/repository.test.ts app/api/messages/route.test.ts
```

Expected: FAIL because `stats.unreadByCategory` is currently missing.

- [ ] **Step 4: Extend client API stats type**

In `src/client/api.ts`, change the `stats` type inside `InboxResponse` to:

```ts
  stats: {
    all: number;
    unread: number;
    verification: number;
    loan_collection: number;
    other: number;
    unreadByCategory: Record<ClientCategory, number>;
  };
```

- [ ] **Step 5: Implement repository unread counts**

In `src/server/messages/repository.ts`, replace the Promise destructuring inside `listMessages` with:

```ts
  const [
    messages,
    sources,
    all,
    unread,
    verification,
    loanCollection,
    other,
    unreadVerification,
    unreadLoanCollection,
    unreadOther
  ] = await Promise.all([
    prisma.message.findMany({
      where,
      include: messageInclude(),
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: query.limit
    }),
    prisma.messageSource.findMany({
      orderBy: [{ deviceName: "asc" }, { receivedPhoneNumber: "asc" }]
    }),
    prisma.message.count(),
    prisma.message.count({ where: { isRead: false } }),
    prisma.message.count({ where: { category: "verification" } }),
    prisma.message.count({ where: { category: "loan_collection" } }),
    prisma.message.count({ where: { category: "other" } }),
    prisma.message.count({
      where: { category: "verification", isRead: false }
    }),
    prisma.message.count({
      where: { category: "loan_collection", isRead: false }
    }),
    prisma.message.count({ where: { category: "other", isRead: false } })
  ]);
```

Then replace the returned `stats` object with:

```ts
    stats: {
      all,
      unread,
      verification,
      loan_collection: loanCollection,
      other,
      unreadByCategory: {
        verification: unreadVerification,
        loan_collection: unreadLoanCollection,
        other: unreadOther
      }
    }
```

- [ ] **Step 6: Run backend message tests**

Run:

```bash
DATABASE_URL="file:./test.db" npm test -- src/server/messages/repository.test.ts app/api/messages/route.test.ts
```

Expected: PASS for both test files.

- [ ] **Step 7: Commit stats changes**

Run:

```bash
git add src/server/messages/repository.ts src/server/messages/repository.test.ts app/api/messages/route.test.ts src/client/api.ts
git commit -m "feat: add unread category stats"
```

### Task 3: Add Category Config And Tabs

**Files:**
- Create: `src/components/inbox/category-config.ts`
- Create: `src/components/inbox/CategoryTabs.tsx`
- Create: `src/components/inbox/CategoryTabs.test.tsx`

- [ ] **Step 1: Write failing CategoryTabs tests**

Create `src/components/inbox/CategoryTabs.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategoryTabs } from "./CategoryTabs";

const stats = {
  all: 8,
  unread: 4,
  verification: 4,
  loan_collection: 2,
  other: 2,
  unreadByCategory: {
    verification: 3,
    loan_collection: 1,
    other: 0
  }
};

describe("CategoryTabs", () => {
  it("renders category tabs with unread badges", () => {
    render(
      <CategoryTabs
        activeCategory="verification"
        stats={stats}
        onChange={() => undefined}
      />
    );

    expect(screen.getByRole("tab", { name: "验证码 3" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "金融 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "其他" })).toBeInTheDocument();
  });

  it("maps the financial tab to loan_collection", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CategoryTabs
        activeCategory="verification"
        stats={stats}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("tab", { name: "金融 1" }));

    expect(onChange).toHaveBeenCalledWith("loan_collection");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/components/inbox/CategoryTabs.test.tsx
```

Expected: FAIL because `CategoryTabs` does not exist.

- [ ] **Step 3: Create category config**

Create `src/components/inbox/category-config.ts` with:

```ts
import type { ClientCategory, ClientReadState } from "@/client/api";

export type InboxCategoryTab = {
  category: ClientCategory;
  label: string;
  emptyNoun: string;
};

export const inboxCategoryTabs = [
  {
    category: "verification",
    label: "验证码",
    emptyNoun: "验证码短信"
  },
  {
    category: "loan_collection",
    label: "金融",
    emptyNoun: "金融短信"
  },
  {
    category: "other",
    label: "其他",
    emptyNoun: "其他短信"
  }
] as const satisfies readonly InboxCategoryTab[];

export function getCategoryLabel(category: ClientCategory) {
  return (
    inboxCategoryTabs.find((tab) => tab.category === category)?.label ?? "短信"
  );
}

export function getEmptyMessage(
  category: ClientCategory,
  readState: ClientReadState = "all"
) {
  const tab = inboxCategoryTabs.find((item) => item.category === category);
  const noun = tab?.emptyNoun ?? "短信";

  if (readState === "unread") {
    return `没有未读${noun}`;
  }

  if (readState === "read") {
    return `没有已读${noun}`;
  }

  return `没有${noun}`;
}
```

- [ ] **Step 4: Create CategoryTabs component**

Create `src/components/inbox/CategoryTabs.tsx` with:

```tsx
"use client";

import type { ClientCategory, InboxResponse } from "@/client/api";
import { inboxCategoryTabs } from "./category-config";

type CategoryTabsProps = {
  activeCategory: ClientCategory;
  stats: InboxResponse["stats"];
  onChange: (category: ClientCategory) => void;
};

export function CategoryTabs({
  activeCategory,
  stats,
  onChange
}: CategoryTabsProps) {
  return (
    <nav className="category-tabs" aria-label="短信分类">
      <div className="category-tabs__track" role="tablist">
        {inboxCategoryTabs.map((tab) => {
          const unreadCount = stats.unreadByCategory[tab.category];
          const selected = tab.category === activeCategory;
          const label = unreadCount > 0 ? `${tab.label} ${unreadCount}` : tab.label;

          return (
            <button
              aria-label={label}
              aria-selected={selected}
              className="category-tab"
              key={tab.category}
              onClick={() => onChange(tab.category)}
              role="tab"
              type="button"
            >
              <span>{tab.label}</span>
              {unreadCount > 0 ? (
                <span className="category-tab__badge">{unreadCount}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Run CategoryTabs test**

Run:

```bash
npm test -- src/components/inbox/CategoryTabs.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit category tabs**

Run:

```bash
git add src/components/inbox/category-config.ts src/components/inbox/CategoryTabs.tsx src/components/inbox/CategoryTabs.test.tsx
git commit -m "feat: add inbox category tabs"
```

### Task 4: Add Compact Read-State Filter Menu

**Files:**
- Create: `src/components/inbox/ReadFilterMenu.tsx`
- Create: `src/components/inbox/ReadFilterMenu.test.tsx`

- [ ] **Step 1: Write failing ReadFilterMenu tests**

Create `src/components/inbox/ReadFilterMenu.test.tsx` with:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReadFilterMenu } from "./ReadFilterMenu";

describe("ReadFilterMenu", () => {
  it("opens a compact read-state menu and changes state", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<ReadFilterMenu readState="all" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "筛选" }));

    const menu = screen.getByRole("menu", { name: "已读状态筛选" });
    expect(within(menu).getByRole("menuitemradio", { name: "全部" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await user.click(within(menu).getByRole("menuitemradio", { name: "未读" }));

    expect(onChange).toHaveBeenCalledWith("unread");
  });

  it("does not render source or category filters", async () => {
    const user = userEvent.setup();

    render(<ReadFilterMenu readState="read" onChange={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "筛选 已读" }));

    expect(screen.queryByText("来源")).not.toBeInTheDocument();
    expect(screen.queryByText("分类")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/components/inbox/ReadFilterMenu.test.tsx
```

Expected: FAIL because `ReadFilterMenu` does not exist.

- [ ] **Step 3: Create ReadFilterMenu component**

Create `src/components/inbox/ReadFilterMenu.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { ClientReadState } from "@/client/api";

const readStateOptions = [
  ["all", "全部"],
  ["unread", "未读"],
  ["read", "已读"]
] as const satisfies ReadonlyArray<readonly [ClientReadState, string]>;

type ReadFilterMenuProps = {
  readState: ClientReadState;
  onChange: (readState: ClientReadState) => void;
};

function getReadStateLabel(readState: ClientReadState) {
  return readStateOptions.find(([value]) => value === readState)?.[1] ?? "全部";
}

export function ReadFilterMenu({ readState, onChange }: ReadFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const activeLabel = getReadStateLabel(readState);
  const buttonLabel = readState === "all" ? "筛选" : `筛选 ${activeLabel}`;

  function handleChange(nextReadState: ClientReadState) {
    onChange(nextReadState);
    setOpen(false);
  }

  return (
    <div className="read-filter">
      <button
        aria-expanded={open}
        className="toolbar-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <SlidersHorizontal size={16} />
        {buttonLabel}
      </button>

      {open ? (
        <div
          aria-label="已读状态筛选"
          className="read-filter__menu"
          role="menu"
        >
          {readStateOptions.map(([value, label]) => (
            <button
              aria-checked={readState === value}
              className="read-filter__option"
              key={value}
              onClick={() => handleChange(value)}
              role="menuitemradio"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run ReadFilterMenu tests**

Run:

```bash
npm test -- src/components/inbox/ReadFilterMenu.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit read filter menu**

Run:

```bash
git add src/components/inbox/ReadFilterMenu.tsx src/components/inbox/ReadFilterMenu.test.tsx
git commit -m "feat: add compact read filter menu"
```

### Task 5: Redesign Message Items For Blue Dots And Select Mode

**Files:**
- Modify: `src/components/inbox/MessageItem.tsx`
- Modify: `src/components/inbox/MessageItem.test.tsx`
- Modify: `src/components/inbox/MessageList.tsx`

- [ ] **Step 1: Replace MessageItem tests**

Replace `src/components/inbox/MessageItem.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageItem } from "./MessageItem";
import type { ClientMessage } from "@/client/api";

const message: ClientMessage = {
  id: "msg-1",
  sender: "955xx",
  body: "您的验证码是 123456",
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

describe("MessageItem", () => {
  it("renders message content, source, and unread dot", () => {
    render(
      <MessageItem
        message={message}
        onCategoryChange={async () => undefined}
        onSelectionToggle={() => undefined}
      />
    );

    expect(screen.getByText("955xx")).toBeInTheDocument();
    expect(screen.getByText("Redmi 1 · SIM 1")).toBeInTheDocument();
    expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    expect(screen.getByLabelText("未读")).toBeInTheDocument();
  });

  it("does not render an unread dot for read messages", () => {
    render(
      <MessageItem
        message={{ ...message, isRead: true }}
        onCategoryChange={async () => undefined}
        onSelectionToggle={() => undefined}
      />
    );

    expect(screen.queryByLabelText("未读")).not.toBeInTheDocument();
  });

  it("changes category through the compact category control", async () => {
    const onCategoryChange = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onCategoryChange={onCategoryChange}
        onSelectionToggle={() => undefined}
      />
    );

    await user.selectOptions(screen.getByLabelText("修改分类"), "other");

    expect(onCategoryChange).toHaveBeenCalledWith("msg-1", "other");
  });

  it("uses selection controls instead of the unread dot in select mode", async () => {
    const onSelectionToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        selected={false}
        selectMode
        onCategoryChange={async () => undefined}
        onSelectionToggle={onSelectionToggle}
      />
    );

    expect(screen.queryByLabelText("未读")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "选择 955xx" }));

    expect(onSelectionToggle).toHaveBeenCalledWith("msg-1");
  });

  it("toggles selection when the row is clicked in select mode", async () => {
    const onSelectionToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        selected
        selectMode
        onCategoryChange={async () => undefined}
        onSelectionToggle={onSelectionToggle}
      />
    );

    await user.click(screen.getByLabelText("短信 955xx"));

    expect(onSelectionToggle).toHaveBeenCalledWith("msg-1");
  });
});
```

- [ ] **Step 2: Run MessageItem tests to verify they fail**

Run:

```bash
npm test -- src/components/inbox/MessageItem.test.tsx
```

Expected: FAIL because `MessageItem` still requires `onReadToggle` and has no select-mode UI.

- [ ] **Step 3: Replace MessageItem implementation**

Replace `src/components/inbox/MessageItem.tsx` with:

```tsx
"use client";

import { Check } from "lucide-react";
import { useState } from "react";
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

export function MessageItem({
  message,
  selected = false,
  selectMode = false,
  onCategoryChange,
  onSelectionToggle
}: MessageItemProps) {
  const [pending, setPending] = useState(false);

  async function handleCategoryChange(category: ClientCategory) {
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

  function handleRowClick() {
    if (selectMode) {
      onSelectionToggle(message.id);
    }
  }

  return (
    <article
      aria-label={`短信 ${message.sender}`}
      className={`message-item ${message.isRead ? "is-read" : "is-unread"} ${
        selectMode ? "is-selecting" : ""
      }`}
      onClick={handleRowClick}
    >
      <div className="message-item__layout">
        <div className="message-item__leading">
          {selectMode ? (
            <button
              aria-pressed={selected}
              className="message-item__select-control"
              onClick={(event) => {
                event.stopPropagation();
                onSelectionToggle(message.id);
              }}
              type="button"
            >
              {selected ? <Check size={14} /> : null}
              <span className="sr-only">
                {selected ? `取消选择 ${message.sender}` : `选择 ${message.sender}`}
              </span>
            </button>
          ) : !message.isRead ? (
            <span aria-label="未读" className="message-item__unread-dot" />
          ) : (
            <span className="message-item__read-spacer" />
          )}
        </div>

        <div className="message-item__content">
          <header className="message-item__header">
            <strong>{message.sender}</strong>
            <time dateTime={message.receivedAt}>
              {new Date(message.receivedAt).toLocaleString("zh-CN")}
            </time>
          </header>

          <p className="message-item__body">{message.body}</p>

          <footer className="message-item__meta">
            <span>{message.source.label}</span>
            {!selectMode ? (
              <label className="message-item__category-edit">
                <span>修改分类</span>
                <select
                  aria-label="修改分类"
                  disabled={pending}
                  value={message.category}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    void handleCategoryChange(
                      event.target.value as ClientCategory
                    )
                  }
                >
                  <option value="verification">{categoryLabels.verification}</option>
                  <option value="loan_collection">
                    {categoryLabels.loan_collection}
                  </option>
                  <option value="other">{categoryLabels.other}</option>
                </select>
              </label>
            ) : null}
          </footer>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Update MessageList props and empty state**

Replace `src/components/inbox/MessageList.tsx` with:

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
  onSelectionToggle: (id: string) => void;
};

export function MessageList({
  emptyMessage,
  messages,
  selectedIds,
  selectMode,
  onCategoryChange,
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
          onSelectionToggle={onSelectionToggle}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Run MessageItem tests**

Run:

```bash
npm test -- src/components/inbox/MessageItem.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit message item redesign**

Run:

```bash
git add src/components/inbox/MessageItem.tsx src/components/inbox/MessageItem.test.tsx src/components/inbox/MessageList.tsx
git commit -m "feat: add message select mode"
```

### Task 6: Wire Tabs, Read Filter, And Batch Mark-Read Into InboxApp

**Files:**
- Modify: `src/components/inbox/InboxApp.tsx`
- Modify: `src/components/inbox/InboxApp.test.tsx`
- Delete: `src/components/inbox/StatsBar.tsx`
- Delete: `src/components/inbox/StatsBar.test.tsx`
- Delete: `src/components/inbox/FilterBar.tsx`
- Delete: `src/components/inbox/FilterBar.test.tsx`

- [ ] **Step 1: Update test payload stats helper**

In `src/components/inbox/InboxApp.test.tsx`, add `unreadByCategory` to every payload `stats` object. For `inboxPayload.stats`, use:

```ts
  stats: {
    all: 1,
    unread: 1,
    verification: 1,
    loan_collection: 0,
    other: 0,
    unreadByCategory: {
      verification: 1,
      loan_collection: 0,
      other: 0
    }
  }
```

For `emptyInboxPayload.stats`, use:

```ts
  stats: {
    all: 0,
    unread: 0,
    verification: 0,
    loan_collection: 0,
    other: 0,
    unreadByCategory: {
      verification: 0,
      loan_collection: 0,
      other: 0
    }
  }
```

For `secondVerificationPayload.stats`, use:

```ts
  stats: {
    ...inboxPayload.stats,
    all: 2,
    unread: 2,
    verification: 2,
    unreadByCategory: {
      ...inboxPayload.stats.unreadByCategory,
      verification: 2
    }
  }
```

- [ ] **Step 2: Replace filter-related InboxApp tests**

In `src/components/inbox/InboxApp.test.tsx`, replace `refreshes messages when filters change` with:

```tsx
  it("combines the active category tab with the read-state filter", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      return Response.json(inboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));
    await vi.waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "金融" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages?category=loan_collection"
      );
    });

    await user.click(screen.getByRole("button", { name: "筛选" }));
    await user.click(screen.getByRole("menuitemradio", { name: "未读" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages?readState=unread&category=loan_collection"
      );
    });

    expect(screen.queryByText("来源")).not.toBeInTheDocument();
  });
```

Replace `refreshes messages after read and category actions` with:

```tsx
  it("refreshes messages after compact category actions", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      if (url === "/api/messages/msg-1" && init?.method === "PATCH") {
        return Response.json({ message: inboxPayload.messages[0] });
      }

      return Response.json(inboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));
    await vi.waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText("修改分类"), "other");

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
```

Replace `shows a stable error when message updates fail` with:

```tsx
  it("shows a stable error when category updates fail", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      if (url === "/api/messages/msg-1" && init?.method === "PATCH") {
        throw new Error("database down");
      }

      return Response.json(inboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));
    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText("修改分类"), "other");

    await waitFor(() => {
      expect(screen.getByText("短信更新失败")).toBeInTheDocument();
    });
  });
```

- [ ] **Step 3: Tighten initial load expectations**

In `src/components/inbox/InboxApp.test.tsx`, update `loads and displays messages after access succeeds` so its final fetch assertions are:

```ts
    expect(fetch).toHaveBeenCalledWith("/api/messages?category=verification");
    expect(fetch).toHaveBeenCalledWith("/api/messages");
```

In `loads the inbox immediately when a valid access cookie is already present`, replace:

```ts
    expect(fetch).toHaveBeenCalledWith("/api/messages");
```

with:

```ts
    expect(fetch).toHaveBeenCalledWith("/api/messages?category=verification");
    expect(fetch).toHaveBeenCalledWith("/api/messages");
```

- [ ] **Step 4: Add batch mark-read test**

Add this test to `src/components/inbox/InboxApp.test.tsx` after the category update test:

```tsx
  it("selects multiple messages and marks unread selections as read", async () => {
    const twoMessagePayload = {
      ...inboxPayload,
      messages: [
        inboxPayload.messages[0],
        {
          ...inboxPayload.messages[0],
          id: "msg-2",
          sender: "10086",
          body: "第二条未读验证码",
          receivedAt: "2026-05-30T08:31:00.000Z"
        }
      ],
      stats: {
        ...inboxPayload.stats,
        all: 2,
        unread: 2,
        verification: 2,
        unreadByCategory: {
          verification: 2,
          loan_collection: 0,
          other: 0
        }
      }
    };

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      if (
        (url === "/api/messages/msg-1" || url === "/api/messages/msg-2") &&
        init?.method === "PATCH"
      ) {
        return Response.json({ message: twoMessagePayload.messages[0] });
      }

      return Response.json(twoMessagePayload);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));
    await waitFor(() => {
      expect(screen.getByText("第二条未读验证码")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "选择" }));
    await user.click(screen.getByRole("button", { name: "选择 955xx" }));
    await user.click(screen.getByRole("button", { name: "选择 10086" }));
    await user.click(screen.getByRole("button", { name: "标记已读" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/msg-1",
        expect.objectContaining({
          body: JSON.stringify({ isRead: true }),
          method: "PATCH"
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/msg-2",
        expect.objectContaining({
          body: JSON.stringify({ isRead: true }),
          method: "PATCH"
        })
      );
    });

    expect(screen.queryByText("已选择 2 条")).not.toBeInTheDocument();
  });
```

- [ ] **Step 5: Update notification-filter test**

In the test `notifies for new verification messages even when the visible filter excludes them`, replace the read filter action:

```tsx
    await user.selectOptions(screen.getByLabelText("已读状态"), "read");
```

with:

```tsx
    await user.click(screen.getByRole("button", { name: "筛选" }));
    await user.click(screen.getByRole("menuitemradio", { name: "已读" }));
```

Replace the read-filter fetch branch:

```ts
      if (url === "/api/messages?readState=read") {
        return Response.json(emptyInboxPayload);
      }
```

with:

```ts
      if (url === "/api/messages?readState=read&category=verification") {
        return Response.json(emptyInboxPayload);
      }
```

Replace the expected visible fetch:

```ts
      expect(fetchMock).toHaveBeenCalledWith("/api/messages?readState=read");
```

with:

```ts
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages?readState=read&category=verification"
      );
```

- [ ] **Step 6: Run InboxApp tests to verify they fail**

Run:

```bash
npm test -- src/components/inbox/InboxApp.test.tsx
```

Expected: FAIL because `InboxApp` still imports `StatsBar` and `FilterBar`, has no category tabs, and has no select mode.

- [ ] **Step 7: Replace InboxApp implementation**

Replace `src/components/inbox/InboxApp.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enterAccessKey,
  fetchMessages,
  updateMessage,
  type ClientCategory,
  type ClientReadState,
  type InboxResponse
} from "@/client/api";
import { AccessForm } from "@/components/access/AccessForm";
import { useVerificationNotifications } from "@/hooks/useVerificationNotifications";
import { POLL_INTERVAL_MS } from "@/lib/app-info";
import { CategoryTabs } from "./CategoryTabs";
import { getEmptyMessage } from "./category-config";
import { MessageList } from "./MessageList";
import { NotificationToggle } from "./NotificationToggle";
import { ReadFilterMenu } from "./ReadFilterMenu";

const emptyInbox: InboxResponse = {
  messages: [],
  sources: [],
  stats: {
    all: 0,
    unread: 0,
    verification: 0,
    loan_collection: 0,
    other: 0,
    unreadByCategory: {
      verification: 0,
      loan_collection: 0,
      other: 0
    }
  }
};

type InboxAppProps = {
  initialAuthenticated?: boolean;
};

export function InboxApp({ initialAuthenticated = false }: InboxAppProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [pendingAccess, setPendingAccess] = useState(false);
  const [activeCategory, setActiveCategory] =
    useState<ClientCategory>("verification");
  const [readState, setReadState] = useState<ClientReadState>("all");
  const [inbox, setInbox] = useState<InboxResponse>(emptyInbox);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [notificationMessages, setNotificationMessages] = useState<
    InboxResponse["messages"]
  >([]);
  const [notificationMessagesLoaded, setNotificationMessagesLoaded] =
    useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    () => new Set()
  );
  const [pendingBulkRead, setPendingBulkRead] = useState(false);

  useVerificationNotifications(
    notificationMessages,
    notificationsEnabled,
    notificationMessagesLoaded
  );

  const loadMessages = useCallback(async () => {
    const nextInbox = await fetchMessages({
      readState,
      category: activeCategory
    });
    setInbox(nextInbox);
    setInboxError(null);
  }, [activeCategory, readState]);

  const loadNotificationMessages = useCallback(async () => {
    const nextInbox = await fetchMessages({ readState: "all" });
    setNotificationMessages(nextInbox.messages);
    setNotificationMessagesLoaded(true);
  }, []);

  const refreshMessages = useCallback(async () => {
    try {
      await loadMessages();
      await loadNotificationMessages();
    } catch {
      setInboxError("短信刷新失败");
    }
  }, [loadMessages, loadNotificationMessages]);

  async function handleAccessSubmit(accessKey: string) {
    setPendingAccess(true);
    setAccessError(null);

    try {
      await enterAccessKey(accessKey);
      setAuthenticated(true);
    } catch {
      setAccessError("访问密钥不正确");
    } finally {
      setPendingAccess(false);
    }
  }

  function clearSelection() {
    setSelectedMessageIds(new Set());
    setSelectMode(false);
  }

  function handleCategoryChange(category: ClientCategory) {
    setActiveCategory(category);
    clearSelection();
  }

  function handleReadStateChange(nextReadState: ClientReadState) {
    setReadState(nextReadState);
    clearSelection();
  }

  function handleSelectionToggle(id: string) {
    setSelectedMessageIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  async function handleCategoryUpdate(id: string, category: ClientCategory) {
    try {
      await updateMessage(id, { category });
      await loadMessages();
    } catch {
      setInboxError("短信更新失败");
    }
  }

  async function handleBulkMarkRead() {
    const selectedUnreadIds = inbox.messages
      .filter((message) => selectedMessageIds.has(message.id) && !message.isRead)
      .map((message) => message.id);

    if (selectedUnreadIds.length === 0 || pendingBulkRead) {
      return;
    }

    setPendingBulkRead(true);
    setInboxError(null);

    try {
      const results = await Promise.allSettled(
        selectedUnreadIds.map((id) => updateMessage(id, { isRead: true }))
      );
      await loadMessages();
      clearSelection();

      if (results.some((result) => result.status === "rejected")) {
        setInboxError("部分短信更新失败");
      }
    } finally {
      setPendingBulkRead(false);
    }
  }

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    void refreshMessages();
    const interval = window.setInterval(() => {
      void refreshMessages();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [authenticated, refreshMessages]);

  if (!authenticated) {
    return (
      <AccessForm
        onSubmit={handleAccessSubmit}
        error={accessError}
        pending={pendingAccess}
      />
    );
  }

  const selectedUnreadCount = inbox.messages.filter(
    (message) => selectedMessageIds.has(message.id) && !message.isRead
  ).length;

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <h1>SMS Inbox</h1>
          <p>短信聚合收件箱</p>
        </div>
        <div className="page-actions">
          <NotificationToggle
            enabled={notificationsEnabled}
            onEnabledChange={setNotificationsEnabled}
          />
          <ReadFilterMenu readState={readState} onChange={handleReadStateChange} />
          <button
            className="toolbar-button"
            onClick={() => {
              if (selectMode) {
                clearSelection();
              } else {
                setSelectMode(true);
              }
            }}
            type="button"
          >
            {selectMode ? "完成" : "选择"}
          </button>
        </div>
      </header>

      <CategoryTabs
        activeCategory={activeCategory}
        stats={inbox.stats}
        onChange={handleCategoryChange}
      />
      {inboxError ? <p className="form-error">{inboxError}</p> : null}
      <MessageList
        emptyMessage={getEmptyMessage(activeCategory, readState)}
        messages={inbox.messages}
        selectedIds={selectedMessageIds}
        selectMode={selectMode}
        onCategoryChange={handleCategoryUpdate}
        onSelectionToggle={handleSelectionToggle}
      />

      {selectMode ? (
        <div className="bulk-action-bar" role="region" aria-label="批量操作">
          <span>已选择 {selectedMessageIds.size} 条</span>
          <div className="bulk-action-bar__actions">
            <button
              disabled={pendingBulkRead || selectedUnreadCount === 0}
              onClick={() => void handleBulkMarkRead()}
              type="button"
            >
              标记已读
            </button>
            <button onClick={clearSelection} type="button">
              取消
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 8: Delete obsolete stats and filter components**

Run:

```bash
git rm src/components/inbox/StatsBar.tsx src/components/inbox/StatsBar.test.tsx src/components/inbox/FilterBar.tsx src/components/inbox/FilterBar.test.tsx
```

- [ ] **Step 9: Run InboxApp tests**

Run:

```bash
npm test -- src/components/inbox/InboxApp.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit InboxApp integration**

Run:

```bash
git add src/components/inbox/InboxApp.tsx src/components/inbox/InboxApp.test.tsx src/components/inbox/MessageList.tsx
git commit -m "feat: wire ios inbox interactions"
```

### Task 7: Apply Responsive iOS-Style Styling

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add a CSS-focused smoke test through existing component tests**

No new unit test is needed for CSS declarations. The smoke coverage comes from Task 6 component tests asserting that the large stats component no longer renders and the new controls do render. Before editing CSS, run:

```bash
npm test -- src/components/inbox/CategoryTabs.test.tsx src/components/inbox/ReadFilterMenu.test.tsx src/components/inbox/MessageItem.test.tsx src/components/inbox/InboxApp.test.tsx
```

Expected: PASS before styling changes.

- [ ] **Step 2: Replace obsolete stats/filter CSS and add new layout classes**

In `app/globals.css`, remove the `.stats-bar`, `.stat`, `.stat__label`, `.stat__value`, `.filter-bar`, `.category`, `.category--verification`, `.category--loan_collection`, and `.category--other` blocks. Keep `.access-form` and `.form-error` styles.

Replace the old form/action selector blocks so notification buttons and deleted message action classes no longer inherit the large blue button treatment. Replace:

```css
.access-form label,
.filter-bar label,
.message-item__actions label {
```

with:

```css
.access-form label {
```

Replace:

```css
.access-form input,
.filter-bar select,
.message-item__actions select {
```

with:

```css
.access-form input {
```

Replace:

```css
.access-form button,
.message-item__actions button,
.notification-toggle {
```

with:

```css
.access-form button {
```

Replace:

```css
.access-form button:hover,
.message-item__actions button:hover,
.notification-toggle:hover {
```

with:

```css
.access-form button:hover {
```

Remove this deleted-action disabled block:

```css
.message-item__actions button:disabled,
.message-item__actions select:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
```

Add these styles after `.page-header p`:

```css
.page-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-button,
.notification-toggle {
  min-height: 36px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
}

.toolbar-button:hover,
.notification-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

Add these category tab styles:

```css
.category-tabs {
  margin-bottom: 14px;
}

.category-tabs__track {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #eceef2;
  padding: 4px;
}

.category-tab {
  min-height: 38px;
  border: 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-weight: 700;
}

.category-tab[aria-selected="true"] {
  background: var(--panel);
  color: var(--text);
  box-shadow: 0 1px 3px rgb(17 17 17 / 12%);
}

.category-tab__badge {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  background: var(--accent);
  color: #ffffff;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
```

Add these read filter styles:

```css
.read-filter {
  position: relative;
}

.read-filter__menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 20;
  min-width: 148px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 12px 32px rgb(17 17 17 / 14%);
  padding: 6px;
}

.read-filter__option {
  width: 100%;
  min-height: 36px;
  border: 0;
  border-radius: 6px;
  padding: 0 10px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

.read-filter__option[aria-checked="true"] {
  background: #eef3ff;
  color: var(--accent);
  font-weight: 700;
}
```

Replace the existing message styles from `.message-list` through `.message-item__actions` with:

```css
.message-list {
  display: grid;
  gap: 8px;
}

.message-item {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px;
}

.message-item.is-unread {
  border-color: #c9d7ff;
}

.message-item.is-selecting {
  cursor: pointer;
}

.message-item__layout {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
}

.message-item__leading {
  padding-top: 7px;
}

.message-item__unread-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  display: block;
  background: #007aff;
}

.message-item__read-spacer {
  width: 9px;
  height: 9px;
  display: block;
}

.message-item__select-control {
  width: 22px;
  height: 22px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0;
  display: grid;
  place-items: center;
  background: var(--panel);
  color: #ffffff;
  cursor: pointer;
}

.message-item__select-control[aria-pressed="true"] {
  border-color: #007aff;
  background: #007aff;
}

.message-item__content {
  min-width: 0;
}

.message-item__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
  font-size: 13px;
}

.message-item__header strong {
  min-width: 0;
  color: var(--text);
  font-size: 15px;
  overflow-wrap: anywhere;
}

.message-item__header time {
  flex: 0 0 auto;
  color: var(--muted);
}

.message-item__body {
  margin: 6px 0 8px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.message-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
}

.message-item__category-edit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.message-item__category-edit select {
  min-height: 30px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0 8px;
  background: #ffffff;
  color: var(--text);
}
```

Add bottom action bar styles:

```css
.bulk-action-bar {
  position: sticky;
  bottom: 12px;
  z-index: 10;
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgb(255 255 255 / 94%);
  padding: 10px 12px;
  box-shadow: 0 10px 28px rgb(17 17 17 / 14%);
  backdrop-filter: blur(12px);
}

.bulk-action-bar__actions {
  display: inline-flex;
  gap: 8px;
}

.bulk-action-bar button {
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0 12px;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
}

.bulk-action-bar button:first-child {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.bulk-action-bar button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
```

Replace the existing mobile media query with:

```css
@media (max-width: 760px) {
  .app-shell {
    width: min(100% - 20px, 1180px);
    padding: 20px 0;
  }

  .page-header {
    align-items: flex-start;
  }

  .page-actions {
    justify-content: flex-end;
  }

  .notification-toggle {
    width: 36px;
    padding: 0;
    overflow: hidden;
    color: var(--accent);
  }

  .notification-toggle svg {
    flex: 0 0 auto;
  }

  .message-item {
    padding: 12px;
  }

  .message-item__header {
    gap: 8px;
  }

  .message-item__header time {
    font-size: 12px;
  }
}
```

- [ ] **Step 3: Run frontend component tests**

Run:

```bash
npm test -- src/components/inbox/CategoryTabs.test.tsx src/components/inbox/ReadFilterMenu.test.tsx src/components/inbox/MessageItem.test.tsx src/components/inbox/InboxApp.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit styles**

Run:

```bash
git add app/globals.css
git commit -m "style: apply compact inbox layout"
```

### Task 8: Full Verification And Browser Check

**Files:**
- No code files should be edited in this task.

- [ ] **Step 1: Run database setup for test DB**

Run:

```bash
DATABASE_URL="file:./test.db" npm run db:push
```

Expected: command exits 0 and Prisma reports the SQLite database is in sync.

- [ ] **Step 2: Run full test suite**

Run:

```bash
DATABASE_URL="file:./test.db" npm test
```

Expected: all Vitest test files pass.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: Next.js build exits 0.

- [ ] **Step 4: Start dev server for manual browser verification**

Run:

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000`. Keep the session running for browser checks.

- [ ] **Step 5: Verify mobile layout in the in-app browser**

Open `http://localhost:3000` in the in-app browser. At a mobile viewport near 390px wide, verify:

- The large five-row/five-cell stats panel is gone.
- The first screen shows header actions, category tabs, and the message list or category-specific empty state.
- Category tabs read `验证码`, `金融`, `其他`.
- `筛选` opens only `全部`, `未读`, `已读`.
- Message rows show source labels and unread blue dots.
- `选择` enters select mode and displays the bottom action bar.
- The page has no horizontal overflow.

- [ ] **Step 6: Verify desktop layout in the in-app browser**

At a desktop viewport near 1280px wide, verify:

- Header actions fit on one line or wrap cleanly without overlapping.
- Category tabs remain compact.
- Message rows stay readable with sender, time, body, source, and category correction control.
- The bottom action bar appears only in select mode.

- [ ] **Step 7: Stop dev server**

Stop the `npm run dev` session with `Ctrl-C`. Confirm the server process exits.

- [ ] **Step 8: Check final git state**

Run:

```bash
git status --short
```

Expected: only the pre-existing `next-env.d.ts` modification remains unstaged, or the working tree is clean if that external change was resolved by the user. No implementation files should be unstaged.

## Self-Review Checklist

- Spec coverage: Task 1 covers three-category Kimi classification. Task 2 covers accurate unread counts. Tasks 3, 4, 5, 6, and 7 cover tabs, read filter, source-filter removal, blue unread dots, select mode, batch mark-read, category correction, and mobile stats removal. Task 8 covers full verification and responsive checks.
- Placeholder scan: The plan uses concrete test commands, expected outcomes, and code snippets for each code-changing task.
- Type consistency: `ClientCategory`, `ClientReadState`, `InboxResponse["stats"].unreadByCategory`, `CategoryTabs`, `ReadFilterMenu`, `selectedIds`, and `selectMode` use the same names across tasks.
