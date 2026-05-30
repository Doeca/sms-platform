import { describe, expect, it, vi } from "vitest";
import { classifyWithKimi } from "./kimi";

describe("classifyWithKimi", () => {
  it("maps a valid Kimi JSON response", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: "{\"category\":\"loan_collection\"}"
            }
          }
        ]
      })
    );

    await expect(
      classifyWithKimi("请尽快还款", {
        apiKey: "key",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 8000,
        fetchImpl
      })
    ).resolves.toBe("loan_collection");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.moonshot.cn/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer key",
          "Content-Type": "application/json"
        })
      })
    );
  });

  it("throws for invalid response categories", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: "{\"category\":\"verification\"}"
            }
          }
        ]
      })
    );

    await expect(
      classifyWithKimi("ambiguous text", {
        apiKey: "key",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 8000,
        fetchImpl
      })
    ).rejects.toThrow("Invalid Kimi category");
  });

  it("throws when Kimi returns a non-2xx response", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("rate limited", { status: 429 })
    );

    await expect(
      classifyWithKimi("ambiguous text", {
        apiKey: "key",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 8000,
        fetchImpl
      })
    ).rejects.toThrow("Kimi request failed with status 429");
  });
});
