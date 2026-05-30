import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { ACCESS_COOKIE_NAME } from "@/server/auth";

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
    expect(response.headers.get("set-cookie")).toContain(ACCESS_COOKIE_NAME);
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
});
