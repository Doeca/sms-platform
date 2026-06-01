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
    other: 0,
    unreadByCategory: {
      verification: 1,
      loan_collection: 0,
      other: 0
    }
  }
};

const emptyInboxPayload = {
  messages: [],
  sources: inboxPayload.sources,
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

const secondVerificationPayload = {
  ...inboxPayload,
  messages: [
    {
      ...inboxPayload.messages[0],
      id: "msg-2",
      body: "您的验证码是 654321，请勿告诉他人。"
    },
    ...inboxPayload.messages
  ],
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
};

const twoUnreadMessagesPayload = {
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

const financialPayload = {
  ...inboxPayload,
  messages: [
    {
      ...inboxPayload.messages[0],
      id: "msg-financial",
      sender: "1069",
      body: "还款提醒",
      category: "loan_collection" as const
    }
  ],
  stats: {
    ...inboxPayload.stats,
    all: 1,
    unread: 1,
    verification: 0,
    loan_collection: 1,
    unreadByCategory: {
      verification: 0,
      loan_collection: 1,
      other: 0
    }
  }
};

function createDeferredResponse() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function createDeferredJsonResponse() {
  let resolve: (payload: unknown) => void = () => undefined;
  const jsonPromise = new Promise<unknown>((nextResolve) => {
    resolve = nextResolve;
  });
  const response = {
    ok: true,
    json: () => jsonPromise
  } as Response;

  return { response, resolve };
}

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

    expect(fetch).toHaveBeenCalledWith("/api/messages?category=verification");
    expect(fetch).not.toHaveBeenCalledWith("/api/messages");
  });

  it("loads the inbox immediately when a valid access cookie is already present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(inboxPayload))
    );

    render(<InboxApp initialAuthenticated />);

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("访问密钥")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/messages?category=verification");
    expect(fetch).not.toHaveBeenCalledWith("/api/messages");
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

    await user.click(screen.getByRole("button", { name: "金融" }));

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

  it("refreshes category updates with the current visible filters", async () => {
    const pendingPatch = createDeferredResponse();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      if (url === "/api/messages/msg-1" && init?.method === "PATCH") {
        return pendingPatch.promise;
      }

      if (url === "/api/messages?category=loan_collection") {
        return Response.json(financialPayload);
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
    await user.click(screen.getByRole("button", { name: "金融" }));

    await waitFor(() => {
      expect(screen.getByText("还款提醒")).toBeInTheDocument();
    });

    pendingPatch.resolve(Response.json({ message: inboxPayload.messages[0] }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages?category=loan_collection"
      );
    });

    const verificationFetchCount = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/messages?category=verification"
    ).length;
    expect(verificationFetchCount).toBe(3);
    expect(screen.getByText("还款提醒")).toBeInTheDocument();
    expect(screen.queryByText("您的验证码是 123456")).not.toBeInTheDocument();
  });

  it("keeps the initial visible fetch alive for active tab and current read no-ops", async () => {
    const delayedVisible = createDeferredResponse();
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/messages?category=verification") {
        return delayedVisible.promise;
      }

      return Response.json(inboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(<InboxApp initialAuthenticated />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages?category=verification"
      );
    });

    await user.click(screen.getByRole("button", { name: "验证码" }));
    await user.click(screen.getByRole("button", { name: "筛选" }));
    await user.click(screen.getByRole("menuitemradio", { name: "全部" }));

    delayedVisible.resolve(Response.json(inboxPayload));

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    const visibleFetchCount = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/messages?category=verification"
    ).length;
    expect(visibleFetchCount).toBe(2);
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

  it("selects multiple messages and marks unread selections as read", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      if (
        (url === "/api/messages/msg-1" || url === "/api/messages/msg-2") &&
        init?.method === "PATCH"
      ) {
        return Response.json({ message: twoUnreadMessagesPayload.messages[0] });
      }

      return Response.json(twoUnreadMessagesPayload);
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
    await user.click(screen.getByRole("button", { name: "短信 955xx" }));
    await user.click(screen.getByRole("button", { name: "短信 10086" }));
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

  it("reports partial batch failures and exits select mode", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      if (url === "/api/messages/msg-1" && init?.method === "PATCH") {
        return Response.json({ message: twoUnreadMessagesPayload.messages[0] });
      }

      if (url === "/api/messages/msg-2" && init?.method === "PATCH") {
        throw new Error("database down");
      }

      return Response.json(twoUnreadMessagesPayload);
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
    await user.click(screen.getByRole("button", { name: "短信 955xx" }));
    await user.click(screen.getByRole("button", { name: "短信 10086" }));
    await user.click(screen.getByRole("button", { name: "标记已读" }));

    await waitFor(() => {
      expect(screen.getByText("部分短信更新失败")).toBeInTheDocument();
    });
    expect(screen.queryByText("已选择 2 条")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择" })).toBeInTheDocument();
  });

  it("reports refresh failures after batch updates and exits select mode", async () => {
    let patchAttempted = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      if (
        (url === "/api/messages/msg-1" || url === "/api/messages/msg-2") &&
        init?.method === "PATCH"
      ) {
        patchAttempted = true;
        return Response.json({ message: twoUnreadMessagesPayload.messages[0] });
      }

      if (url === "/api/messages?category=verification" && patchAttempted) {
        throw new Error("refresh down");
      }

      return Response.json(twoUnreadMessagesPayload);
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
    await user.click(screen.getByRole("button", { name: "短信 955xx" }));
    await user.click(screen.getByRole("button", { name: "短信 10086" }));
    await user.click(screen.getByRole("button", { name: "标记已读" }));

    await waitFor(() => {
      expect(screen.getByText("短信刷新失败")).toBeInTheDocument();
    });
    expect(screen.queryByText("已选择 2 条")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择" })).toBeInTheDocument();
  });

  it("clears selected rows when category or read filters change", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      return Response.json(twoUnreadMessagesPayload);
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
    await user.click(screen.getByRole("button", { name: "短信 955xx" }));
    expect(screen.getByText("已选择 1 条")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "金融" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages?category=loan_collection"
      );
    });
    expect(screen.queryByText("已选择 1 条")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "选择" }));
    await user.click(screen.getByRole("button", { name: "短信 955xx" }));
    expect(screen.getByText("已选择 1 条")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "筛选" }));
    await user.click(screen.getByRole("menuitemradio", { name: "未读" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages?readState=unread&category=loan_collection"
      );
    });
    expect(screen.queryByText("已选择 1 条")).not.toBeInTheDocument();
  });

  it("ignores stale visible responses from previous filters", async () => {
    const delayedVerification = createDeferredJsonResponse();
    const delayedFinancial = createDeferredResponse();
    let delayedVerificationUsed = false;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      if (url === "/api/messages?category=verification") {
        if (!delayedVerificationUsed) {
          delayedVerificationUsed = true;
          return delayedVerification.response;
        }

        return Response.json(inboxPayload);
      }

      if (url === "/api/messages?category=loan_collection") {
        return delayedFinancial.promise;
      }

      return Response.json(inboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(<InboxApp initialAuthenticated />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages?category=verification"
      );
    });

    const resolveOldVerificationDuringClick = () => {
      delayedVerification.resolve(inboxPayload);
      document.removeEventListener("click", resolveOldVerificationDuringClick);
    };
    document.addEventListener("click", resolveOldVerificationDuringClick);

    await user.click(screen.getByRole("button", { name: "金融" }));

    expect(screen.getByRole("button", { name: "金融" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.queryByText("您的验证码是 123456")).not.toBeInTheDocument();

    delayedFinancial.resolve(Response.json(financialPayload));

    await waitFor(() => {
      expect(screen.getByText("还款提醒")).toBeInTheDocument();
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
    const resolveMessages: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      return new Promise<Response>((resolve) => {
        resolveMessages.push(resolve);
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
    resolveMessages.forEach((resolve) => resolve(Response.json(inboxPayload)));

    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });

    expect(notification).not.toHaveBeenCalled();
  });

  it("notifies for new verification messages even when the visible filter excludes them", async () => {
    const notification = vi.fn();
    vi.stubGlobal("Notification", notification);
    Object.assign(Notification, {
      permission: "granted",
      requestPermission: vi.fn(async () => "granted")
    });

    let verificationFeedFetches = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/access") {
        return Response.json({ ok: true });
      }

      if (url === "/api/messages?readState=read&category=verification") {
        return Response.json(emptyInboxPayload);
      }

      if (url === "/api/messages?category=verification") {
        verificationFeedFetches += 1;
        return Response.json(
          verificationFeedFetches <= 2 ? inboxPayload : secondVerificationPayload
        );
      }

      return Response.json(secondVerificationPayload);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<InboxApp />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));
    await waitFor(() => {
      expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "开启验证码通知" }));
    await user.click(screen.getByRole("button", { name: "筛选" }));
    await user.click(screen.getByRole("menuitemradio", { name: "已读" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/messages?readState=read&category=verification"
      );
      expect(fetchMock).not.toHaveBeenCalledWith("/api/messages");
      expect(notification).toHaveBeenCalledWith(
        "收到验证码短信",
        expect.objectContaining({
          body: "955xx · Redmi 1 · SIM 1"
        })
      );
    });
  });
});
