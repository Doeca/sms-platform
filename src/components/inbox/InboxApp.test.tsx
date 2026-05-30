import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InboxApp } from "./InboxApp";
import { POLL_INTERVAL_MS } from "@/lib/app-info";

const inboxPayload = {
  messages: [
    {
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
    }
  ],
  sources: [
    {
      id: "source-1",
      receivedPhoneNumber: "+8613800000000",
      deviceName: "Redmi 1",
      simSlot: 1,
      label: "Redmi 1 · SIM 1"
    }
  ],
  stats: {
    all: 1,
    unread: 1,
    verification: 1,
    loan_collection: 0,
    other: 0
  }
};

describe("InboxApp", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loads and displays messages after access succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/auth/access") {
          return Response.json({ ok: true });
        }

        return Response.json(inboxPayload);
      })
    );

    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    const inboxFetchCount = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => url === "/api/messages"
    ).length;
    expect(inboxFetchCount).toBe(1);
  });

  it("shows an access error when the access key is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: false }, { status: 401 }))
    );

    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "bad-secret");
    await user.click(screen.getByRole("button", { name: "进入" }));

    await waitFor(() => {
      expect(screen.getByText("访问密钥不正确")).toBeInTheDocument();
    });
  });

  it("refreshes messages when filters change", async () => {
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

    await user.selectOptions(screen.getByLabelText("已读状态"), "unread");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/messages?readState=unread");
    });
  });

  it("refreshes messages after read and category actions", async () => {
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

    await user.click(screen.getByRole("button", { name: "标记已读" }));
    await user.selectOptions(screen.getByLabelText("修改分类"), "other");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/msg-1",
        expect.objectContaining({
          body: JSON.stringify({ isRead: true }),
          method: "PATCH"
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages/msg-1",
        expect.objectContaining({
          body: JSON.stringify({ category: "other" }),
          method: "PATCH"
        })
      );
    });

    const inboxFetchCount = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/messages"
    ).length;
    expect(inboxFetchCount).toBeGreaterThanOrEqual(3);
  });

  it("polls for new messages after access succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      return Response.json(inboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxApp />);

    fireEvent.change(screen.getByLabelText("访问密钥"), {
      target: { value: "secret" }
    });
    fireEvent.click(screen.getByRole("button", { name: "进入" }));
    await vi.waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    const beforePollCount = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(beforePollCount);
  });

  it("shows a stable error when message refresh fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));

    await waitFor(() => {
      expect(screen.getByText("短信刷新失败")).toBeInTheDocument();
    });
  });

  it("shows a stable error when message updates fail", async () => {
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

    await user.click(screen.getByRole("button", { name: "标记已读" }));

    await waitFor(() => {
      expect(screen.getByText("短信更新失败")).toBeInTheDocument();
    });
  });

  it("does not notify for messages already loaded before enabling notifications", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/auth/access") {
          return Response.json({ ok: true });
        }

        return Response.json(inboxPayload);
      })
    );
    const notification = vi.fn();
    vi.stubGlobal("Notification", notification);
    Object.assign(Notification, {
      permission: "granted",
      requestPermission: vi.fn(async () => "granted")
    });
    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));
    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "开启验证码通知" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "关闭验证码通知" })
      ).toBeInTheDocument();
    });
    expect(notification).not.toHaveBeenCalled();
  });

  it("does not notify for the first loaded messages when notifications are enabled early", async () => {
    let resolveMessages: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      return new Promise<Response>((resolve) => {
        resolveMessages = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const notification = vi.fn();
    vi.stubGlobal("Notification", notification);
    Object.assign(Notification, {
      permission: "granted",
      requestPermission: vi.fn(async () => "granted")
    });
    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));
    await user.click(screen.getByRole("button", { name: "开启验证码通知" }));
    resolveMessages(Response.json(inboxPayload));

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    expect(notification).not.toHaveBeenCalled();
  });
});
