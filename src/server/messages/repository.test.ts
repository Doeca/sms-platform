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

  it("returns an existing message when duplicate retries arrive concurrently", async () => {
    const input = {
      receivedPhoneNumber: "+8613800000000",
      sender: "955xx",
      body: "您的验证码是 123456",
      receivedAt: new Date("2026-05-30T08:30:00.000Z")
    };

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        saveIncomingMessage(input, {
          category: "verification",
          source: "keyword"
        })
      )
    );

    const messageIds = new Set(results.map((result) => result.message.id));

    expect(messageIds.size).toBe(1);
    expect(results.filter((result) => result.duplicate)).toHaveLength(7);
    await expect(prisma.message.count()).resolves.toBe(1);
  });

  it("keeps one source row when different messages from the same source arrive concurrently", async () => {
    const receivedPhoneNumber = "+8613800000000";
    const deviceName = "Redmi 1";
    const simSlot = 1;

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        saveIncomingMessage(
          {
            receivedPhoneNumber,
            deviceName,
            simSlot,
            sender: `sender-${index}`,
            body: `普通通知 ${index}`,
            receivedAt: new Date(`2026-05-30T08:3${index}:00.000Z`)
          },
          { category: "other", source: "kimi" }
        )
      )
    );

    const sources = await prisma.messageSource.findMany({
      where: { receivedPhoneNumber, deviceName, simSlot }
    });

    expect(sources).toHaveLength(1);
    await expect(prisma.message.count()).resolves.toBe(8);
  });

  it("claims an existing source row before creating a source identity", async () => {
    const existingSource = await prisma.messageSource.create({
      data: {
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: 1
      }
    });

    const saved = await saveIncomingMessage(
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

    expect(saved.message.sourceId).toBe(existingSource.id);
    await expect(prisma.messageSource.count()).resolves.toBe(1);
    await expect(prisma.messageSourceIdentity.count()).resolves.toBe(1);
  });

  it("claims an existing source row once when matching messages arrive concurrently", async () => {
    const existingSource = await prisma.messageSource.create({
      data: {
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: 1
      }
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        saveIncomingMessage(
          {
            receivedPhoneNumber: "+8613800000000",
            deviceName: "Redmi 1",
            simSlot: 1,
            sender: `sender-${index}`,
            body: `普通通知 ${index}`,
            receivedAt: new Date(`2026-05-30T08:3${index}:00.000Z`)
          },
          { category: "other", source: "kimi" }
        )
      )
    );

    expect(results.every((result) => result.message.sourceId === existingSource.id)).toBe(
      true
    );
    await expect(prisma.messageSource.count()).resolves.toBe(1);
    await expect(prisma.messageSourceIdentity.count()).resolves.toBe(1);
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
