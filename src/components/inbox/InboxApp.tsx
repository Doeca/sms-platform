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
import { POLL_INTERVAL_MS } from "@/lib/app-info";
import { FilterBar } from "./FilterBar";
import { MessageList } from "./MessageList";
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

export function InboxApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [pendingAccess, setPendingAccess] = useState(false);
  const [filters, setFilters] = useState<MessageFilters>({ readState: "all" });
  const [inbox, setInbox] = useState<InboxResponse>(emptyInbox);

  const loadMessages = useCallback(async () => {
    const nextInbox = await fetchMessages(filters);
    setInbox(nextInbox);
  }, [filters]);

  async function handleAccessSubmit(accessKey: string) {
    setPendingAccess(true);
    setAccessError(null);

    try {
      await enterAccessKey(accessKey);
      setAuthenticated(true);
      await loadMessages();
    } catch {
      setAccessError("访问密钥不正确");
    } finally {
      setPendingAccess(false);
    }
  }

  async function handleReadToggle(id: string, isRead: boolean) {
    await updateMessage(id, { isRead });
    await loadMessages();
  }

  async function handleCategoryChange(id: string, category: ClientCategory) {
    await updateMessage(id, { category });
    await loadMessages();
  }

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    void loadMessages();
    const interval = window.setInterval(() => {
      void loadMessages();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [authenticated, loadMessages]);

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
      </header>

      <StatsBar stats={inbox.stats} />
      <FilterBar filters={filters} sources={inbox.sources} onChange={setFilters} />
      <MessageList
        messages={inbox.messages}
        onReadToggle={handleReadToggle}
        onCategoryChange={handleCategoryChange}
      />
    </main>
  );
}
