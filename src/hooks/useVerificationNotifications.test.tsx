import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@/client/api";
import { useVerificationNotifications } from "./useVerificationNotifications";

function message(id: string, category: ClientMessage["category"]): ClientMessage {
  return {
    id,
    sender: "955xx",
    body: "您的验证码是 123456",
    receivedAt: "2026-05-30T08:30:00.000Z",
    createdAt: "2026-05-30T08:30:01.000Z",
    category,
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
}

function stubNotification(permission: NotificationPermission) {
  const notification = vi.fn();
  vi.stubGlobal("Notification", notification);
  Object.assign(Notification, { permission });

  return notification;
}

describe("useVerificationNotifications", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not notify for initial messages", () => {
    const notification = stubNotification("granted");

    renderHook(({ messages }) => useVerificationNotifications(messages, true), {
      initialProps: { messages: [message("1", "verification")] }
    });

    expect(notification).not.toHaveBeenCalled();
  });

  it("uses the first ready message list as the initial notification baseline", () => {
    const notification = stubNotification("granted");

    const { rerender } = renderHook(
      ({ messages, ready }) => useVerificationNotifications(messages, true, ready),
      {
        initialProps: { messages: [] as ClientMessage[], ready: false }
      }
    );

    rerender({ messages: [message("1", "verification")], ready: true });

    expect(notification).not.toHaveBeenCalled();
  });

  it("notifies for the first new verification after an empty ready baseline", () => {
    const notification = stubNotification("granted");

    const { rerender } = renderHook(
      ({ messages }) => useVerificationNotifications(messages, true, true),
      {
        initialProps: { messages: [] as ClientMessage[] }
      }
    );

    rerender({ messages: [message("1", "verification")] });

    expect(notification).toHaveBeenCalledTimes(1);
  });

  it("notifies only for newly observed verification messages", () => {
    const notification = stubNotification("granted");

    const { rerender } = renderHook(
      ({ messages }) => useVerificationNotifications(messages, true),
      {
        initialProps: { messages: [message("1", "other")] }
      }
    );

    rerender({
      messages: [message("2", "verification"), message("1", "other")]
    });

    expect(notification).toHaveBeenCalledTimes(1);
    expect(notification).toHaveBeenCalledWith(
      "收到验证码短信",
      expect.objectContaining({
        body: "955xx · Redmi 1 · SIM 1"
      })
    );
  });

  it("does not notify for new non-verification messages", () => {
    const notification = stubNotification("granted");

    const { rerender } = renderHook(
      ({ messages }) => useVerificationNotifications(messages, true),
      {
        initialProps: { messages: [message("1", "verification")] }
      }
    );

    rerender({
      messages: [message("2", "loan_collection"), message("1", "verification")]
    });

    expect(notification).not.toHaveBeenCalled();
  });

  it("does not notify while disabled or without granted permission", () => {
    const notification = stubNotification("default");

    const { rerender } = renderHook(
      ({ messages, enabled }) => useVerificationNotifications(messages, enabled),
      {
        initialProps: {
          enabled: false,
          messages: [message("1", "other")]
        }
      }
    );

    rerender({
      enabled: false,
      messages: [message("2", "verification"), message("1", "other")]
    });
    rerender({
      enabled: true,
      messages: [message("3", "verification"), message("2", "verification")]
    });

    expect(notification).not.toHaveBeenCalled();
  });

  it("does not repeat notifications for the same message id", () => {
    const notification = stubNotification("granted");

    const { rerender } = renderHook(
      ({ messages }) => useVerificationNotifications(messages, true),
      {
        initialProps: { messages: [message("1", "other")] }
      }
    );

    rerender({
      messages: [message("2", "verification"), message("1", "other")]
    });
    rerender({
      messages: [message("2", "verification"), message("1", "other")]
    });

    expect(notification).toHaveBeenCalledTimes(1);
  });

  it("does not repeat notifications after a message disappears from filtered results", () => {
    const notification = stubNotification("granted");

    const { rerender } = renderHook(
      ({ messages }) => useVerificationNotifications(messages, true),
      {
        initialProps: { messages: [message("1", "other")] }
      }
    );

    rerender({
      messages: [message("2", "verification"), message("1", "other")]
    });
    rerender({ messages: [] });
    rerender({ messages: [message("2", "verification")] });

    expect(notification).toHaveBeenCalledTimes(1);
  });
});
