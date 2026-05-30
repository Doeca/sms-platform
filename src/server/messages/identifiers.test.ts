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
      JSON.stringify([
        "+8613800000000",
        "955xx",
        "hello",
        "2026-05-30T08:30:00.000Z"
      ])
    );
  });

  it("does not collide when fields contain delimiters", () => {
    const receivedAt = new Date("2026-05-30T08:30:00.000Z");
    const first = buildDedupeKey({
      receivedPhoneNumber: "+8613800000000",
      sender: "955xx|hello",
      body: "body",
      receivedAt
    });
    const second = buildDedupeKey({
      receivedPhoneNumber: "+8613800000000",
      sender: "955xx",
      body: "hello|body",
      receivedAt
    });

    expect(first).not.toBe(second);
  });
});
