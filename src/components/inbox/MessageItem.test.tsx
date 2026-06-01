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
        onOpen={() => undefined}
        onSelectionToggle={() => undefined}
      />
    );

    await user.selectOptions(screen.getByLabelText("修改分类"), "other");

    expect(onCategoryChange).toHaveBeenCalledWith("msg-1", "other");
  });

  it("omits the scan row category badge while keeping category correction", () => {
    const { container } = render(
      <MessageItem
        message={message}
        onCategoryChange={async () => undefined}
        onSelectionToggle={() => undefined}
      />
    );

    expect(
      container.querySelector(".message-item__header .category")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("修改分类")).toBeInTheDocument();
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

  it("uses the row target instead of the unread dot in select mode", async () => {
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

    const row = screen.getByRole("button", { name: "短信 955xx" });

    expect(row).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "选择 955xx" })).not.toBeInTheDocument();

    await user.click(row);

    expect(onSelectionToggle).toHaveBeenCalledWith("msg-1");
  });

  it("opens the message when the row is clicked in normal mode", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onCategoryChange={async () => undefined}
        onOpen={onOpen}
        onSelectionToggle={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: "短信 955xx" }));

    expect(onOpen).toHaveBeenCalledWith("msg-1");
  });

  it("opens the message when the unread indicator is clicked in normal mode", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onCategoryChange={async () => undefined}
        onOpen={onOpen}
        onSelectionToggle={() => undefined}
      />
    );

    await user.click(screen.getByLabelText("未读"));

    expect(onOpen).toHaveBeenCalledWith("msg-1");
  });

  it("opens the message from the keyboard in normal mode", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onCategoryChange={async () => undefined}
        onOpen={onOpen}
        onSelectionToggle={() => undefined}
      />
    );

    const row = screen.getByRole("button", { name: "短信 955xx" });

    row.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenNthCalledWith(1, "msg-1");
    expect(onOpen).toHaveBeenNthCalledWith(2, "msg-1");
  });

  it("does not open the message when the category control is used", async () => {
    const onCategoryChange = vi.fn(async () => undefined);
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        onCategoryChange={onCategoryChange}
        onOpen={onOpen}
        onSelectionToggle={() => undefined}
      />
    );

    await user.selectOptions(screen.getByLabelText("修改分类"), "other");

    expect(onCategoryChange).toHaveBeenCalledWith("msg-1", "other");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps the category control outside the row button target", () => {
    render(
      <MessageItem
        message={message}
        onCategoryChange={async () => undefined}
        onOpen={() => undefined}
        onSelectionToggle={() => undefined}
      />
    );

    const row = screen.getByRole("button", { name: "短信 955xx" });
    const categoryControl = screen.getByLabelText("修改分类");

    expect(row).not.toContainElement(categoryControl);
    expect(categoryControl.closest('[role="button"]')).toBeNull();
  });

  it("does not open the message when clicked in select mode", async () => {
    const onOpen = vi.fn();
    const onSelectionToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageItem
        message={message}
        selectMode
        onCategoryChange={async () => undefined}
        onOpen={onOpen}
        onSelectionToggle={onSelectionToggle}
      />
    );

    await user.click(screen.getByRole("button", { name: "短信 955xx" }));

    expect(onSelectionToggle).toHaveBeenCalledWith("msg-1");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("toggles selection when the visible select control is clicked", async () => {
    const onSelectionToggle = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <MessageItem
        message={message}
        selectMode
        onCategoryChange={async () => undefined}
        onSelectionToggle={onSelectionToggle}
      />
    );

    const selectControl = container.querySelector(".message-item__select-control");

    expect(selectControl).toBeInTheDocument();

    await user.click(selectControl as HTMLElement);

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
