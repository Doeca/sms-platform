import { describe, expect, it } from "vitest";
import {
  incomingMessageSchema,
  listMessagesQuerySchema,
  updateMessageSchema
} from "./schemas";

describe("incomingMessageSchema", () => {
  it("accepts the Android forwarding payload", () => {
    const parsed = incomingMessageSchema.parse({
      receivedPhoneNumber: "+8613800000000",
      deviceName: "Redmi 1",
      simSlot: 1,
      sender: "955xx",
      body: "您的验证码是 123456，请勿泄露",
      receivedAt: "2026-05-30T08:30:00.000Z"
    });

    expect(parsed.receivedAt).toEqual(new Date("2026-05-30T08:30:00.000Z"));
    expect(parsed.simSlot).toBe(1);
  });

  it("rejects missing required fields", () => {
    const result = incomingMessageSchema.safeParse({
      receivedPhoneNumber: "+8613800000000",
      body: "missing sender and receivedAt"
    });

    expect(result.success).toBe(false);
  });
});

describe("listMessagesQuerySchema", () => {
  it("defaults the limit to 100", () => {
    const parsed = listMessagesQuerySchema.parse({});
    expect(parsed.limit).toBe(100);
    expect(parsed.readState).toBe("all");
  });
});

describe("updateMessageSchema", () => {
  it("accepts read-state and category updates", () => {
    expect(updateMessageSchema.parse({ isRead: true })).toEqual({ isRead: true });
    expect(updateMessageSchema.parse({ category: "loan_collection" })).toEqual({
      category: "loan_collection"
    });
  });

  it("rejects an empty patch", () => {
    expect(updateMessageSchema.safeParse({}).success).toBe(false);
  });
});
