import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import { resetDatabase } from "@/server/db/test-utils";
import {
  listMessages,
  saveIncomingMessage,
  updateMessage
} from "./repository";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("message repository", () => {
  it("stores incoming messages as unread and reuses the same source", async () => {
    const first = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: 1,
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    const second = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: 1,
        sender: "10086",
        body: "普通通知",
        receivedAt: new Date("2026-05-30T08:31:00.000Z")
      },
      { category: "other", source: "kimi" }
    );

    expect(first.message.isRead).toBe(false);
    expect(first.duplicate).toBe(false);
    expect(second.message.sourceId).toBe(first.message.sourceId);
  });

  it("returns an existing message for duplicate retry payloads", async () => {
    const input = {
      receivedPhoneNumber: "+8613800000000",
      sender: "955xx",
      body: "您的验证码是 123456",
      receivedAt: new Date("2026-05-30T08:30:00.000Z")
    };

    const first = await saveIncomingMessage(input, {
      category: "verification",
      source: "keyword"
    });
    const duplicate = await saveIncomingMessage(input, {
      category: "verification",
      source: "keyword"
    });

    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.message.id).toBe(first.message.id);
  });

  it("filters messages by read state and category", async () => {
    const saved = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613900000000",
        sender: "loan",
        body: "请尽快还款",
        receivedAt: new Date("2026-05-30T08:31:00.000Z")
      },
      { category: "loan_collection", source: "kimi" }
    );

    await updateMessage(saved.message.id, { isRead: true });

    const readVerification = await listMessages({
      readState: "read",
      category: "verification",
      limit: 100
    });

    expect(readVerification.messages).toHaveLength(1);
    expect(readVerification.messages[0].id).toBe(saved.message.id);
    expect(readVerification.stats.unread).toBe(1);
  });

  it("marks manual category edits with manual classification source", async () => {
    const saved = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "loan",
        body: "请尽快还款",
        receivedAt: new Date("2026-05-30T08:31:00.000Z")
      },
      { category: "loan_collection", source: "kimi" }
    );

    const updated = await updateMessage(saved.message.id, {
      category: "other"
    });

    expect(updated.category).toBe("other");
    expect(updated.classificationSource).toBe("manual");
  });
});
