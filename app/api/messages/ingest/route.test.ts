import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { resetDatabase } from "@/server/db/test-utils";
import { POST } from "./route";

beforeEach(async () => {
  vi.stubEnv("SMS_INGEST_TOKEN", "phone-secret");
  vi.stubEnv("KIMI_API_KEY", "kimi-secret");
  await resetDatabase();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

function request(body: unknown, token = "phone-secret") {
  return new Request("http://localhost/api/messages/ingest", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function rawRequest(body: string, token = "phone-secret") {
  return new Request("http://localhost/api/messages/ingest", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body
  });
}

const validPayload = {
  receivedPhoneNumber: "+8613800000000",
  deviceName: "Redmi 1",
  simSlot: 1,
  sender: "955xx",
  body: "您的验证码是 123456",
  receivedAt: "2026-05-30T08:30:00.000Z"
};

describe("POST /api/messages/ingest", () => {
  it("rejects invalid ingest tokens", async () => {
    const response = await POST(request(validPayload, "wrong"));

    expect(response.status).toBe(401);
  });

  it("rejects invalid JSON bodies", async () => {
    const response = await POST(rawRequest("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body"
    });
  });

  it("rejects invalid payloads with issues", async () => {
    const response = await POST(request({ body: "missing required fields" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid ingest payload");
    expect(json.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "receivedPhoneNumber"
        })
      ])
    );
  });

  it("stores valid verification SMS payloads", async () => {
    const response = await POST(request(validPayload));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message.category).toBe("verification");
    expect(json.message.classificationSource).toBe("keyword");
    expect(json.message.isRead).toBe(false);
    expect(json.duplicate).toBe(false);
  });

  it("returns success for duplicate retries", async () => {
    await POST(request(validPayload));
    const response = await POST(request(validPayload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.duplicate).toBe(true);
  });
});
