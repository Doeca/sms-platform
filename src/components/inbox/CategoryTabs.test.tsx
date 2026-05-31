import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategoryTabs } from "./CategoryTabs";

const stats = {
  all: 8,
  unread: 4,
  verification: 4,
  loan_collection: 2,
  other: 2,
  unreadByCategory: {
    verification: 3,
    loan_collection: 1,
    other: 0
  }
};

describe("CategoryTabs", () => {
  it("renders category tabs with unread badges", () => {
    render(
      <CategoryTabs
        activeCategory="verification"
        stats={stats}
        onChange={() => undefined}
      />
    );

    expect(screen.getByRole("tab", { name: "验证码 3" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "金融 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "其他" })).toBeInTheDocument();
  });

  it("maps the financial tab to loan_collection", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CategoryTabs
        activeCategory="verification"
        stats={stats}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("tab", { name: "金融 1" }));

    expect(onChange).toHaveBeenCalledWith("loan_collection");
  });
});
