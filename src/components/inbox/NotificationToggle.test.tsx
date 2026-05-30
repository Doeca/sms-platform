import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationToggle } from "./NotificationToggle";

function stubNotification(
  permission: NotificationPermission,
  requestPermission = vi.fn<() => Promise<NotificationPermission>>()
) {
  vi.stubGlobal("Notification", {
    permission,
    requestPermission
  });

  return requestPermission;
}

describe("NotificationToggle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests browser notification permission before enabling", async () => {
    const requestPermission = stubNotification(
      "default",
      vi.fn(async () => "granted")
    );
    const onEnabledChange = vi.fn();
    const user = userEvent.setup();

    render(
      <NotificationToggle enabled={false} onEnabledChange={onEnabledChange} />
    );

    await user.click(screen.getByRole("button", { name: "开启验证码通知" }));

    await waitFor(() => {
      expect(requestPermission).toHaveBeenCalled();
      expect(onEnabledChange).toHaveBeenCalledWith(true);
    });
  });

  it("turns off without requesting permission", async () => {
    const requestPermission = stubNotification("granted");
    const onEnabledChange = vi.fn();
    const user = userEvent.setup();

    render(<NotificationToggle enabled onEnabledChange={onEnabledChange} />);

    await user.click(screen.getByRole("button", { name: "关闭验证码通知" }));

    expect(requestPermission).not.toHaveBeenCalled();
    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it("stays disabled when permission is denied or left undecided", async () => {
    const onDeniedChange = vi.fn();
    const deniedRequest = stubNotification(
      "default",
      vi.fn(async () => "denied")
    );
    const user = userEvent.setup();

    const { rerender } = render(
      <NotificationToggle enabled={false} onEnabledChange={onDeniedChange} />
    );

    await user.click(screen.getByRole("button", { name: "开启验证码通知" }));

    await waitFor(() => {
      expect(deniedRequest).toHaveBeenCalled();
      expect(onDeniedChange).toHaveBeenCalledWith(false);
    });

    const onDefaultChange = vi.fn();
    const defaultRequest = stubNotification(
      "default",
      vi.fn(async () => "default")
    );

    rerender(
      <NotificationToggle enabled={false} onEnabledChange={onDefaultChange} />
    );

    await user.click(screen.getByRole("button", { name: "开启验证码通知" }));

    await waitFor(() => {
      expect(defaultRequest).toHaveBeenCalled();
      expect(onDefaultChange).toHaveBeenCalledWith(false);
    });
  });

  it("stays disabled when permission requests fail", async () => {
    const requestPermission = stubNotification(
      "default",
      vi.fn(async () => {
        throw new Error("permission failed");
      })
    );
    const onEnabledChange = vi.fn();
    const user = userEvent.setup();

    render(
      <NotificationToggle enabled={false} onEnabledChange={onEnabledChange} />
    );

    await user.click(screen.getByRole("button", { name: "开启验证码通知" }));

    await waitFor(() => {
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(onEnabledChange).toHaveBeenCalledWith(false);
    });
  });

  it("prevents overlapping permission requests", async () => {
    const requestPermission = stubNotification(
      "default",
      vi.fn(
        () =>
          new Promise<NotificationPermission>((resolve) =>
            setTimeout(() => resolve("granted"), 25)
          )
      )
    );
    const onEnabledChange = vi.fn();
    const user = userEvent.setup();

    render(
      <NotificationToggle enabled={false} onEnabledChange={onEnabledChange} />
    );

    await user.dblClick(screen.getByRole("button", { name: "开启验证码通知" }));

    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("is safe when browser notifications are unavailable", async () => {
    vi.stubGlobal("Notification", undefined);
    const onEnabledChange = vi.fn();
    const user = userEvent.setup();

    render(
      <NotificationToggle enabled={false} onEnabledChange={onEnabledChange} />
    );

    await user.click(screen.getByRole("button", { name: "开启验证码通知" }));

    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });
});
