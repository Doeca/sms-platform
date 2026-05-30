"use client";

import { useState } from "react";
import { Bell, BellOff } from "lucide-react";

type NotificationToggleProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
};

export function NotificationToggle({
  enabled,
  onEnabledChange
}: NotificationToggleProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) {
      return;
    }

    if (enabled) {
      onEnabledChange(false);
      return;
    }

    if (typeof Notification === "undefined") {
      onEnabledChange(false);
      return;
    }

    setPending(true);

    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      onEnabledChange(permission === "granted");
    } catch {
      onEnabledChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="notification-toggle"
      type="button"
      disabled={pending}
      onClick={handleClick}
    >
      {enabled ? <BellOff size={16} /> : <Bell size={16} />}
      {enabled ? "关闭验证码通知" : "开启验证码通知"}
    </button>
  );
}
