import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatsBar } from "./StatsBar";

describe("StatsBar", () => {
  it("renders all inbox counts", () => {
    render(
      <StatsBar
        stats={{
          all: 10,
          unread: 3,
          verification: 2,
          loan_collection: 4,
          other: 4,
          unreadByCategory: {
            verification: 0,
            loan_collection: 0,
            other: 0
          }
        }}
      />
    );

    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("未读")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("验证码")).toBeInTheDocument();
    expect(screen.getByText("贷款/催收")).toBeInTheDocument();
  });
});
