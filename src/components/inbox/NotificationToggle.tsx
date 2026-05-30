"use client";

import { Bell, BellOff } from "lucide-react";

type NotificationToggleProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
};

export function NotificationToggle({
  enabled,
  onEnabledChange
}: NotificationToggleProps) {
  async function handleClick() {
    if (enabled) {
      onEnabledChange(false);
      return;
    }

    if (typeof Notification === "undefined") {
      onEnabledChange(false);
      return;
    }

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    onEnabledChange(permission === "granted");
  }

  return (
    <button className="notification-toggle" type="button" onClick={handleClick}>
      {enabled ? <BellOff size={16} /> : <Bell size={16} />}
      {enabled ? "关闭验证码通知" : "开启验证码通知"}
    </button>
  );
}
