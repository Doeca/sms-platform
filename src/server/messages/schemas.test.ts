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

  it("accepts Android local datetime strings without timezone", () => {
    const parsed = incomingMessageSchema.parse({
      receivedPhoneNumber: "+8613800000000",
      sender: "955xx",
      body: "您的验证码是 123456，请勿泄露",
      receivedAt: "2026-01-28 14:30:00"
    });

    expect(parsed.receivedAt).toEqual(new Date(2026, 0, 28, 14, 30, 0));
  });

  it("rejects missing required fields", () => {
    const result = incomingMessageSchema.safeParse({
      receivedPhoneNumber: "+8613800000000",
      body: "missing sender and receivedAt"
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-string and invalid received timestamps", () => {
    for (const receivedAt of [null, 0, "not-a-date"]) {
      const result = incomingMessageSchema.safeParse({
        receivedPhoneNumber: "+8613800000000",
        sender: "955xx",
        body: "bad timestamp",
        receivedAt
      });

      expect(result.success).toBe(false);
    }
  });

  it("treats blank and null SIM slots as absent", () => {
    for (const simSlot of [null, "", "   "]) {
      const parsed = incomingMessageSchema.parse({
        receivedPhoneNumber: "+8613800000000",
        simSlot,
        sender: "955xx",
        body: "blank sim slot",
        receivedAt: "2026-05-30T08:30:00.000Z"
      });

      expect(parsed.simSlot).toBeUndefined();
    }
  });
});

describe("listMessagesQuerySchema", () => {
  it("defaults the limit to 100", () => {
    const parsed = listMessagesQuerySchema.parse({});
    expect(parsed.limit).toBe(100);
    expect(parsed.readState).toBe("all");
  });

  it("requires before to be an ISO datetime string when provided", () => {
    expect(
      listMessagesQuerySchema.parse({ before: "2026-05-30T08:30:00.000Z" }).before
    ).toEqual(new Date("2026-05-30T08:30:00.000Z"));

    for (const before of [null, 0, "not-a-date"]) {
      expect(listMessagesQuerySchema.safeParse({ before }).success).toBe(false);
    }
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
