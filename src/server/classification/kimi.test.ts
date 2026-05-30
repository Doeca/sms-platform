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
        apiKey: " key ",
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

    const fetchCalls = fetchImpl.mock.calls as unknown as Array<
      [RequestInfo | URL, RequestInit?]
    >;
    const requestInit = fetchCalls[0]?.[1];
    const requestBody = JSON.parse(String(requestInit?.body)) as {
      model?: unknown;
      messages?: unknown[];
      response_format?: unknown;
      max_completion_tokens?: unknown;
      stream?: unknown;
    };

    expect(requestBody).toEqual(
      expect.objectContaining({
        model: "kimi-k2.6",
        response_format: { type: "json_object" },
        max_completion_tokens: 50,
        stream: false
      })
    );
    expect(requestBody.messages).toHaveLength(2);
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

  it("throws for malformed JSON content", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: "not json"
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
    ).rejects.toThrow();
  });

  it("throws when Kimi omits message content", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {}
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
    ).rejects.toThrow("Kimi response did not include message content");
  });

  it("does not call fetch when the API key is blank", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: "{\"category\":\"other\"}"
            }
          }
        ]
      })
    );

    await expect(
      classifyWithKimi("ambiguous text", {
        apiKey: "   ",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 8000,
        fetchImpl
      })
    ).rejects.toThrow("KIMI_API_KEY is not configured");

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("aborts the Kimi request when the timeout elapses", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn(
      ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })) as typeof fetch
    );

    try {
      const result = classifyWithKimi("ambiguous text", {
        apiKey: "key",
        baseUrl: "https://api.moonshot.cn/v1",
        model: "kimi-k2.6",
        timeoutMs: 25,
        fetchImpl
      });
      const rejection = expect(result).rejects.toThrow("aborted");

      await vi.advanceTimersByTimeAsync(25);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
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
