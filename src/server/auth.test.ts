import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE_NAME,
  buildAccessCookie,
  createAccessCookieValue,
  extractBearerToken,
  hasValidAccessCookie,
  hasValidIngestToken
} from "./auth";

describe("extractBearerToken", () => {
  it("extracts bearer tokens", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("rejects non-bearer headers", () => {
    expect(extractBearerToken("Token abc123")).toBeNull();
  });
});

describe("hasValidIngestToken", () => {
  it("validates the configured ingest token", () => {
    expect(hasValidIngestToken("Bearer phone-secret", "phone-secret")).toBe(
      true
    );
    expect(hasValidIngestToken("Bearer wrong", "phone-secret")).toBe(false);
  });
});

describe("web access cookie", () => {
  it("creates and validates a signed cookie value", () => {
    const value = createAccessCookieValue("web-secret");
    expect(
      hasValidAccessCookie(`${ACCESS_COOKIE_NAME}=${value}`, "web-secret")
    ).toBe(true);
    expect(hasValidAccessCookie(`${ACCESS_COOKIE_NAME}=bad`, "web-secret")).toBe(
      false
    );
  });

  it("builds an httpOnly sameSite cookie", () => {
    const cookie = buildAccessCookie("web-secret", false);
    expect(cookie).toContain(`${ACCESS_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });
});
