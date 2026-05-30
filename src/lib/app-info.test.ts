import { describe, expect, it } from "vitest";
import { APP_NAME, POLL_INTERVAL_MS } from "./app-info";

describe("app info", () => {
  it("exposes stable application metadata", () => {
    expect(APP_NAME).toBe("SMS Inbox");
    expect(POLL_INTERVAL_MS).toBe(5000);
  });
});
