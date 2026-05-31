"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type VisibleFilters = {
  category: ClientCategory;
  readState: ClientReadState;
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
  const visibleRequestSequence = useRef(0);
  const currentVisibleFiltersRef = useRef<VisibleFilters>({
    category: "verification",
    readState: "all"
  });

  function invalidateVisibleRequests() {
    visibleRequestSequence.current += 1;
    return visibleRequestSequence.current;
  }

  useVerificationNotifications(
    notificationMessages,
    notificationsEnabled,
    notificationMessagesLoaded
  );

  const loadMessages = useCallback(async () => {
    const requestSequence = invalidateVisibleRequests();
    const { category, readState } = currentVisibleFiltersRef.current;

    try {
      const nextInbox = await fetchMessages({
        readState,
        category
      });

      if (requestSequence !== visibleRequestSequence.current) {
        return;
      }

      setInbox(nextInbox);
      setInboxError(null);
    } catch (error) {
      if (requestSequence === visibleRequestSequence.current) {
        throw error;
      }
    }
  }, []);

  const loadNotificationMessages = useCallback(async () => {
    const nextInbox = await fetchMessages({ readState: "all" });
    setNotificationMessages(nextInbox.messages);
    setNotificationMessagesLoaded(true);
  }, []);

  const refreshMessages = useCallback(async () => {
    const results = await Promise.allSettled([
      loadMessages(),
      loadNotificationMessages()
    ]);

    if (results.some((result) => result.status === "rejected")) {
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
    const currentFilters = currentVisibleFiltersRef.current;

    if (category !== currentFilters.category) {
      currentVisibleFiltersRef.current = {
        ...currentFilters,
        category
      };
      invalidateVisibleRequests();
    }

    setActiveCategory(category);
    clearSelection();
  }

  function handleReadStateChange(nextReadState: ClientReadState) {
    const currentFilters = currentVisibleFiltersRef.current;

    if (nextReadState !== currentFilters.readState) {
      currentVisibleFiltersRef.current = {
        ...currentFilters,
        readState: nextReadState
      };
      invalidateVisibleRequests();
    }

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
      const patchResults = await Promise.allSettled(
        selectedUnreadIds.map((id) => updateMessage(id, { isRead: true }))
      );
      const refreshResults = await Promise.allSettled([
        loadMessages(),
        loadNotificationMessages()
      ]);
      clearSelection();

      const patchFailed = patchResults.some(
        (result) => result.status === "rejected"
      );
      const refreshFailed = refreshResults.some(
        (result) => result.status === "rejected"
      );

      if (patchFailed && refreshFailed) {
        setInboxError("部分短信更新失败，短信刷新失败");
      } else if (patchFailed) {
        setInboxError("部分短信更新失败");
      } else if (refreshFailed) {
        setInboxError("短信刷新失败");
      }
    } finally {
      setPendingBulkRead(false);
    }
  }

  useEffect(() => {
    currentVisibleFiltersRef.current = {
      category: activeCategory,
      readState
    };
  }, [activeCategory, readState]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    void refreshMessages();
    const interval = window.setInterval(() => {
      void refreshMessages();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [activeCategory, authenticated, readState, refreshMessages]);

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
          <ReadFilterMenu
            readState={readState}
            onChange={handleReadStateChange}
          />
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
