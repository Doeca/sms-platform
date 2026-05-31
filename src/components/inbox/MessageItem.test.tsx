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
  it("renders message content, source, and unread dot", () => {
    render(
      <MessageItem
        message={message}
        onCategoryChange={async () => undefined}
        onSelectionToggle={() => undefined}
      />
    );

    expect(screen.getByText("955xx")).toBeInTheDocument();
    expect(screen.getByText("Redmi 1 · SIM 1")).toBeInTheDocument();
    expect(screen.getByText("您的验证码是 123456")).toBeInTheDocument();
    expect(screen.getByLabelText("未读")).toBeInTheDocument();
  });

  it("does not render an unread dot for read messages", () => {
    render(
      <MessageItem
        message={{ ...message, isRead: true }}
        onCategoryChange={async () => undefined}
        onSelectionToggle={() => undefined}
      />
    );

    expect(screen.queryByLabelText("未读")).not.toBeInTheDocument();
  });

  it("changes category through the compact category control", async () => {
    const onCategoryChange = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onCategoryChange={onCategoryChange}
        onSelectionToggle={() => undefined}
      />
    );

    await user.selectOptions(screen.getByLabelText("修改分类"), "other");

    expect(onCategoryChange).toHaveBeenCalledWith("msg-1", "other");
  });

  it("prevents overlapping category changes while pending", async () => {
    const onCategoryChange = vi.fn(() => new Promise<void>(() => undefined));
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onCategoryChange={onCategoryChange}
        onSelectionToggle={() => undefined}
      />
    );

    const categoryControl = screen.getByLabelText("修改分类");

    await user.selectOptions(categoryControl, "other");
    await user.selectOptions(categoryControl, "loan_collection");

    expect(onCategoryChange).toHaveBeenCalledTimes(1);
    expect(onCategoryChange).toHaveBeenCalledWith("msg-1", "other");
  });

  it("uses selection controls instead of the unread dot in select mode", async () => {
    const onSelectionToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        selected={false}
        selectMode
        onCategoryChange={async () => undefined}
        onSelectionToggle={onSelectionToggle}
      />
    );

    expect(screen.queryByLabelText("未读")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "选择 955xx" }));

    expect(onSelectionToggle).toHaveBeenCalledWith("msg-1");
  });

  it("toggles selection when the row is clicked in select mode", async () => {
    const onSelectionToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        selected
        selectMode
        onCategoryChange={async () => undefined}
        onSelectionToggle={onSelectionToggle}
      />
    );

    await user.click(screen.getByLabelText("短信 955xx"));

    expect(onSelectionToggle).toHaveBeenCalledWith("msg-1");
  });

  it("toggles selection from the keyboard when the row is focused in select mode", async () => {
    const onSelectionToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        selected={false}
        selectMode
        onCategoryChange={async () => undefined}
        onSelectionToggle={onSelectionToggle}
      />
    );

    const row = screen.getByLabelText("短信 955xx");

    expect(row).toHaveAttribute("tabIndex", "0");

    row.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onSelectionToggle).toHaveBeenCalledTimes(2);
    expect(onSelectionToggle).toHaveBeenNthCalledWith(1, "msg-1");
    expect(onSelectionToggle).toHaveBeenNthCalledWith(2, "msg-1");
  });
});
