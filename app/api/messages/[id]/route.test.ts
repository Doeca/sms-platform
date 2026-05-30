import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAccessCookie } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { resetDatabase } from "@/server/db/test-utils";
import { saveIncomingMessage, updateMessage } from "@/server/messages/repository";
import { handleUpdateRequest, PATCH } from "./route";

beforeEach(async () => {
  vi.stubEnv("WEB_ACCESS_KEY", "web-secret");
  await resetDatabase();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

function authedPatch(body: unknown) {
  return new Request("http://localhost/api/messages/message-id", {
    method: "PATCH",
    headers: {
      Cookie: buildAccessCookie("web-secret", false),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function authedRawPatch(body: string) {
  return new Request("http://localhost/api/messages/message-id", {
    method: "PATCH",
    headers: {
      Cookie: buildAccessCookie("web-secret", false),
      "Content-Type": "application/json"
    },
    body
  });
}

function context(id: string) {
  return {
    params: Promise.resolve({ id })
  };
}

describe("PATCH /api/messages/:id", () => {
  it("rejects requests without the access cookie", async () => {
    const response = await PATCH(new Request("http://localhost/api/messages/1"), {
      params: Promise.resolve({ id: "1" })
    });

    expect(response.status).toBe(401);
  });

  it("rejects invalid JSON bodies", async () => {
    const response = await PATCH(authedRawPatch("{"), context("message-id"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body"
    });
  });

  it("rejects invalid update payloads", async () => {
    const response = await PATCH(authedPatch({ isRead: "yes" }), context("1"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid update payload"
    });
  });

  it("marks messages read", async () => {
    const saved = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    const response = await PATCH(authedPatch({ isRead: true }), {
      params: Promise.resolve({ id: saved.message.id })
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message.isRead).toBe(true);
    expect(json.message.receivedAt).toBe("2026-05-30T08:30:00.000Z");
    expect(json.message.source.label).toBe("+8613800000000");
  });

  it("manually changes the category", async () => {
    const saved = await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "loan",
        body: "请尽快还款",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "loan_collection", source: "kimi" }
    );

    const response = await PATCH(authedPatch({ category: "other" }), {
      params: Promise.resolve({ id: saved.message.id })
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message.category).toBe("other");
    expect(json.message.classificationSource).toBe("manual");
  });

  it("returns stable JSON when the message does not exist", async () => {
    const response = await PATCH(authedPatch({ isRead: true }), context("missing"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Message not found"
    });
  });

  it("returns stable JSON when updating fails unexpectedly", async () => {
    const response = await handleUpdateRequest(
      authedPatch({ isRead: true }),
      context("message-id"),
      {
        update: vi.fn(async () => {
          throw new Error("database down");
        }) as typeof updateMessage
      }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to update message"
    });
  });
});
