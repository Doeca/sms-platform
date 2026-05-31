import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReadFilterMenu } from "./ReadFilterMenu";

describe("ReadFilterMenu", () => {
  it("opens a compact read-state menu and changes state", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<ReadFilterMenu readState="all" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "筛选" }));

    const menu = screen.getByRole("menu", { name: "已读状态筛选" });
    expect(within(menu).getByRole("menuitemradio", { name: "全部" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await user.click(within(menu).getByRole("menuitemradio", { name: "未读" }));

    expect(onChange).toHaveBeenCalledWith("unread");
  });

  it("does not render source or category filters", async () => {
    const user = userEvent.setup();

    render(<ReadFilterMenu readState="read" onChange={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "筛选 已读" }));

    expect(screen.queryByText("来源")).not.toBeInTheDocument();
    expect(screen.queryByText("分类")).not.toBeInTheDocument();
  });
});
