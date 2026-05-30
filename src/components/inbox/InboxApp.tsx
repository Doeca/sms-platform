"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enterAccessKey,
  fetchMessages,
  updateMessage,
  type ClientCategory,
  type InboxResponse,
  type MessageFilters
} from "@/client/api";
import { AccessForm } from "@/components/access/AccessForm";
import { useVerificationNotifications } from "@/hooks/useVerificationNotifications";
import { POLL_INTERVAL_MS } from "@/lib/app-info";
import { FilterBar } from "./FilterBar";
import { MessageList } from "./MessageList";
import { NotificationToggle } from "./NotificationToggle";
import { StatsBar } from "./StatsBar";

const emptyInbox: InboxResponse = {
  messages: [],
  sources: [],
  stats: {
    all: 0,
    unread: 0,
    verification: 0,
    loan_collection: 0,
    other: 0
  }
};

type InboxAppProps = {
  initialAuthenticated?: boolean;
};

function hasVisibleNotificationFeed(filters: MessageFilters) {
  return (
    (!filters.readState || filters.readState === "all") &&
    !filters.category &&
    !filters.sourceId
  );
}

export function InboxApp({ initialAuthenticated = false }: InboxAppProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [pendingAccess, setPendingAccess] = useState(false);
  const [filters, setFilters] = useState<MessageFilters>({ readState: "all" });
  const [inbox, setInbox] = useState<InboxResponse>(emptyInbox);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [notificationMessages, setNotificationMessages] = useState<
    InboxResponse["messages"]
  >([]);
  const [notificationMessagesLoaded, setNotificationMessagesLoaded] =
    useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useVerificationNotifications(
    notificationMessages,
    notificationsEnabled,
    notificationMessagesLoaded
  );

  const loadMessages = useCallback(async () => {
    const nextInbox = await fetchMessages(filters);
    setInbox(nextInbox);
    setInboxLoaded(true);

    if (hasVisibleNotificationFeed(filters)) {
      setNotificationMessages(nextInbox.messages);
      setNotificationMessagesLoaded(true);
    }

    setInboxError(null);
  }, [filters]);

  const loadNotificationMessages = useCallback(async () => {
    if (hasVisibleNotificationFeed(filters)) {
      return;
    }

    const nextInbox = await fetchMessages({ readState: "all" });
    setNotificationMessages(nextInbox.messages);
    setNotificationMessagesLoaded(true);
  }, [filters]);

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

  async function handleReadToggle(id: string, isRead: boolean) {
    try {
      await updateMessage(id, { isRead });
      await loadMessages();
    } catch {
      setInboxError("短信更新失败");
    }
  }

  async function handleCategoryChange(id: string, category: ClientCategory) {
    try {
      await updateMessage(id, { category });
      await loadMessages();
    } catch {
      setInboxError("短信更新失败");
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

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <h1>SMS Inbox</h1>
          <p>短信聚合收件箱</p>
        </div>
        <NotificationToggle
          enabled={notificationsEnabled}
          onEnabledChange={setNotificationsEnabled}
        />
      </header>

      <StatsBar stats={inbox.stats} />
      {inboxError ? <p className="form-error">{inboxError}</p> : null}
      <FilterBar filters={filters} sources={inbox.sources} onChange={setFilters} />
      <MessageList
        messages={inbox.messages}
        onReadToggle={handleReadToggle}
        onCategoryChange={handleCategoryChange}
      />
    </main>
  );
}
