import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReadFilterMenu } from "./ReadFilterMenu";

describe("ReadFilterMenu", () => {
  it("opens a compact read-state menu and changes state", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<ReadFilterMenu readState="all" onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: "筛选" });
    await user.click(trigger);

    const menu = screen.getByRole("menu", { name: "已读状态筛选" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(within(menu).getByRole("menuitemradio", { name: "全部" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(within(menu).getByRole("menuitemradio", { name: "未读" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(within(menu).getByRole("menuitemradio", { name: "已读" })).toHaveAttribute(
      "aria-checked",
      "false"
    );

    await user.click(within(menu).getByRole("menuitemradio", { name: "未读" }));

    expect(onChange).toHaveBeenCalledWith("unread");
    expect(screen.queryByRole("menu", { name: "已读状态筛选" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("does not render source or category filters", async () => {
    const user = userEvent.setup();

    render(<ReadFilterMenu readState="read" onChange={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "筛选 已读" }));

    expect(screen.queryByText("来源")).not.toBeInTheDocument();
    expect(screen.queryByText("分类")).not.toBeInTheDocument();
  });

  it("labels the trigger with the unread state", () => {
    render(<ReadFilterMenu readState="unread" onChange={() => undefined} />);

    expect(screen.getByRole("button", { name: "筛选 未读" })).toBeInTheDocument();
  });

  it("marks the current non-all state as checked", async () => {
    const user = userEvent.setup();

    render(<ReadFilterMenu readState="read" onChange={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "筛选 已读" }));

    const menu = screen.getByRole("menu", { name: "已读状态筛选" });
    expect(within(menu).getByRole("menuitemradio", { name: "全部" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(within(menu).getByRole("menuitemradio", { name: "未读" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(within(menu).getByRole("menuitemradio", { name: "已读" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("supports menu keyboard navigation and Escape close", async () => {
    const user = userEvent.setup();

    render(<ReadFilterMenu readState="all" onChange={() => undefined} />);

    const trigger = screen.getByRole("button", { name: "筛选" });
    await user.click(trigger);

    const menu = screen.getByRole("menu", { name: "已读状态筛选" });
    const allOption = within(menu).getByRole("menuitemradio", { name: "全部" });
    const unreadOption = within(menu).getByRole("menuitemradio", { name: "未读" });
    const readOption = within(menu).getByRole("menuitemradio", { name: "已读" });

    expect(allOption).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(unreadOption).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(allOption).toHaveFocus();

    await user.keyboard("{End}");
    expect(readOption).toHaveFocus();

    await user.keyboard("{Home}");
    expect(allOption).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "已读状态筛选" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("selects the focused option with keyboard activation", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<ReadFilterMenu readState="all" onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: "筛选" });
    await user.click(trigger);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("unread");
    expect(screen.queryByRole("menu", { name: "已读状态筛选" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.keyboard("{ArrowDown}{ArrowDown} ");

    expect(onChange).toHaveBeenCalledWith("read");
    expect(screen.queryByRole("menu", { name: "已读状态筛选" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
