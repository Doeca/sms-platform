import { afterEach, describe, expect, it, vi } from "vitest";
import { enterAccessKey, fetchMessages, updateMessage } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("client api", () => {
  it("submits the access key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true }))
    );

    await enterAccessKey("secret");

    expect(fetch).toHaveBeenCalledWith("/api/auth/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey: "secret" })
    });
  });

  it("fetches messages with filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ messages: [], sources: [], stats: {} }))
    );

    await fetchMessages({ readState: "unread", category: "verification" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/messages?readState=unread&category=verification"
    );
  });

  it("omits the read state when all messages are requested", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ messages: [], sources: [], stats: {} }))
    );

    await fetchMessages({ readState: "all", sourceId: "source-1" });

    expect(fetch).toHaveBeenCalledWith("/api/messages?sourceId=source-1");
  });

  it("skips empty filters and URL-encodes filter values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ messages: [], sources: [], stats: {} }))
    );

    await fetchMessages({ category: undefined, sourceId: "source / 1" });

    expect(fetch).toHaveBeenCalledWith("/api/messages?sourceId=source+%2F+1");
  });

  it("patches messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: { id: "1" } }))
    );

    await updateMessage("1", { isRead: true });

    expect(fetch).toHaveBeenCalledWith("/api/messages/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true })
    });
  });

  it("URL-encodes message ids in patch paths", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: { id: "source/1" } }))
    );

    await updateMessage("source/1?", { category: "other" });

    expect(fetch).toHaveBeenCalledWith("/api/messages/source%2F1%3F", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "other" })
    });
  });

  it("throws for non-ok responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Nope", { status: 401 }))
    );

    await expect(enterAccessKey("wrong")).rejects.toThrow(
      "Request failed with status 401"
    );
  });

  it("throws a stable error for invalid success JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 200 }))
    );

    await expect(fetchMessages()).rejects.toThrow("Response was not valid JSON");
  });
});
