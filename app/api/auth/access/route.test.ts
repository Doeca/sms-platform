import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { ACCESS_COOKIE_NAME } from "@/server/auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/access", () => {
  it("sets an access cookie for a valid key", async () => {
    vi.stubEnv("WEB_ACCESS_KEY", "web-secret");

    const response = await POST(
      new Request("http://localhost/api/auth/access", {
        method: "POST",
        body: JSON.stringify({ accessKey: "web-secret" })
      })
    );

    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain(ACCESS_COOKIE_NAME);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).not.toContain("Secure");
  });

  it("sets a secure access cookie in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEB_ACCESS_KEY", "web-secret");

    const response = await POST(
      new Request("http://localhost/api/auth/access", {
        method: "POST",
        body: JSON.stringify({ accessKey: "web-secret" })
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("rejects invalid keys", async () => {
    vi.stubEnv("WEB_ACCESS_KEY", "web-secret");

    const response = await POST(
      new Request("http://localhost/api/auth/access", {
        method: "POST",
        body: JSON.stringify({ accessKey: "wrong" })
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects null JSON bodies as invalid access keys", async () => {
    vi.stubEnv("WEB_ACCESS_KEY", "web-secret");

    const response = await POST(
      new Request("http://localhost/api/auth/access", {
        method: "POST",
        body: "null"
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid access key"
    });
  });

  it("rejects invalid JSON bodies", async () => {
    vi.stubEnv("WEB_ACCESS_KEY", "web-secret");

    const response = await POST(
      new Request("http://localhost/api/auth/access", {
        method: "POST",
        body: "{"
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body"
    });
  });

  it("rejects requests when the web access key is not configured", async () => {
    vi.stubEnv("WEB_ACCESS_KEY", "");

    const response = await POST(
      new Request("http://localhost/api/auth/access", {
        method: "POST",
        body: JSON.stringify({ accessKey: "web-secret" })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid access key"
    });
  });
});
