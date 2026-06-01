"use client";

import { useEffect, useRef } from "react";
import type { ClientMessage } from "@/client/api";

export function useVerificationNotifications(
  messages: ClientMessage[],
  enabled: boolean,
  ready = true
) {
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (seenIds.current === null) {
      seenIds.current = new Set(messages.map((message) => message.id));
      return;
    }

    const canNotify =
      enabled &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted";

    for (const message of messages) {
      if (seenIds.current.has(message.id)) {
        continue;
      }

      seenIds.current.add(message.id);

      if (canNotify && message.category === "verification") {
        new Notification("收到验证码短信", {
          body: `${message.sender} · ${message.source.label}`
        });
      }
    }
  }, [enabled, messages, ready]);
}
