import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@/client/api";
import { MessageDetailDialog } from "./MessageDetailDialog";

const message: ClientMessage = {
  id: "msg-1",
  sender: "955xx",
  body: "第一行验证码\n第二行请勿泄露",
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

describe("MessageDetailDialog", () => {
  it("renders full message details and the category control", () => {
    render(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={() => undefined}
      />
    );

    expect(
      screen.getByRole("dialog", { name: "短信详情 955xx" })
    ).toBeInTheDocument();
    expect(screen.getByText("955xx")).toBeInTheDocument();
    expect(screen.getByText("Redmi 1 · SIM 1")).toBeInTheDocument();
    expect(
      screen.getByText(new Date(message.receivedAt).toLocaleString("zh-CN"))
    ).toBeInTheDocument();
    expect(
      screen.getByText("第一行验证码\n第二行请勿泄露", {
        collapseWhitespace: false
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("修改详情分类")).toHaveValue("verification");
  });

  it("closes from the close button, backdrop, and Escape key", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole("button", { name: "关闭短信详情" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={onClose}
      />
    );
    await user.click(screen.getByTestId("message-detail-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={onClose}
      />
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close when the dialog panel itself is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole("dialog", { name: "短信详情 955xx" }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls category change with the selected category", async () => {
    const onCategoryChange = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      <MessageDetailDialog
        message={message}
        onCategoryChange={onCategoryChange}
        onClose={() => undefined}
      />
    );

    await user.selectOptions(screen.getByLabelText("修改详情分类"), "other");

    expect(onCategoryChange).toHaveBeenCalledWith("msg-1", "other");
  });

  it("moves focus into the dialog and returns focus after unmount", () => {
    const opener = document.createElement("button");
    opener.textContent = "opener";
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(
      <MessageDetailDialog
        message={message}
        onCategoryChange={async () => undefined}
        onClose={() => undefined}
      />
    );

    expect(screen.getByRole("dialog", { name: "短信详情 955xx" })).toHaveFocus();

    unmount();

    expect(opener).toHaveFocus();
    opener.remove();
  });
});
