import { describe, expect, it } from "vitest";
import { buildDedupeKey } from "./identifiers";

describe("buildDedupeKey", () => {
  it("uses receiving number, sender, body, and received time", () => {
    const key = buildDedupeKey({
      receivedPhoneNumber: "+8613800000000",
      sender: "955xx",
      body: "hello",
      receivedAt: new Date("2026-05-30T08:30:00.000Z")
    });

    expect(key).toBe(
      "+8613800000000|955xx|hello|2026-05-30T08:30:00.000Z"
    );
  });
});
