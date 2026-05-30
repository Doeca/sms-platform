import { describe, expect, it, vi } from "vitest";
import { classifyMessage } from "./classify";

describe("classifyMessage", () => {
  it("uses keyword classification before Kimi", async () => {
    const classifyWithKimi = vi.fn();

    const result = await classifyMessage("您的验证码是 123456", {
      classifyWithKimi
    });

    expect(result).toEqual({ category: "verification", source: "keyword" });
    expect(classifyWithKimi).not.toHaveBeenCalled();
  });

  it("uses Kimi for non-verification messages", async () => {
    const classifyWithKimi = vi.fn(async () => "loan_collection" as const);

    const result = await classifyMessage("请尽快处理逾期账单", {
      classifyWithKimi
    });

    expect(result).toEqual({ category: "loan_collection", source: "kimi" });
  });

  it("falls back to other when Kimi fails", async () => {
    const classifyWithKimi = vi.fn(async () => {
      throw new Error("network down");
    });

    const result = await classifyMessage("普通通知", {
      classifyWithKimi
    });

    expect(result).toEqual({
      category: "other",
      source: "fallback",
      error: "network down"
    });
  });
});
