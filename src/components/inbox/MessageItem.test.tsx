import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageItem } from "./MessageItem";
import type { ClientMessage } from "@/client/api";

const message: ClientMessage = {
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
};

describe("MessageItem", () => {
  it("renders message content and source", () => {
    render(
      <MessageItem
        message={message}
        onReadToggle={async () => undefined}
        onCategoryChange={async () => undefined}
      />
    );

    expect(screen.getByText("955xx")).toBeInTheDocument();
    expect(screen.getByText("Redmi 1 · SIM 1")).toBeInTheDocument();
    expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
  });

  it("toggles read state and category", async () => {
    const onReadToggle = vi.fn(async () => undefined);
    const onCategoryChange = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onReadToggle={onReadToggle}
        onCategoryChange={onCategoryChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "标记已读" }));
    await user.selectOptions(screen.getByLabelText("修改分类"), "other");

    expect(onReadToggle).toHaveBeenCalledWith("msg-1", true);
    expect(onCategoryChange).toHaveBeenCalledWith("msg-1", "other");
  });

  it("prevents overlapping actions", async () => {
    const onReadToggle = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 25))
    );
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onReadToggle={onReadToggle}
        onCategoryChange={async () => undefined}
      />
    );

    await user.dblClick(screen.getByRole("button", { name: "标记已读" }));

    expect(onReadToggle).toHaveBeenCalledTimes(1);
  });
});
