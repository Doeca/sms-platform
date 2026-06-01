import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyMessage } from "./classify";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("./kimi");
});

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

  it("uses Kimi verification when keywords do not match", async () => {
    const classifyWithKimi = vi.fn(async () => "verification" as const);

    const result = await classifyMessage("登录动态数字为 246810", {
      classifyWithKimi
    });

    expect(result).toEqual({ category: "verification", source: "kimi" });
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

  it("falls back when the default Kimi API key is blank", async () => {
    vi.stubEnv("KIMI_API_KEY", "   ");

    const result = await classifyMessage("普通通知");

    expect(result).toEqual({
      category: "other",
      source: "fallback",
      error: "KIMI_API_KEY is not configured"
    });
  });

  it("defaults invalid KIMI_TIMEOUT_MS values to 8000", async () => {
    vi.stubEnv("KIMI_API_KEY", "key");
    vi.stubEnv("KIMI_BASE_URL", "   ");
    vi.stubEnv("KIMI_MODEL", "");
    vi.stubEnv("KIMI_TIMEOUT_MS", "not-a-number");

    const classifyWithKimi = vi.fn(async () => "other" as const);
    vi.doMock("./kimi", () => ({
      classifyWithKimi
    }));
    vi.resetModules();

    const { classifyMessage: classifyWithMockedKimi } = await import(
      "./classify"
    );

    await expect(classifyWithMockedKimi("普通通知")).resolves.toEqual({
      category: "other",
      source: "kimi"
    });

    expect(classifyWithKimi).toHaveBeenCalledWith(
      "普通通知",
      expect.objectContaining({
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 8000
      })
    );
  });
});
