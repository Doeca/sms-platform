import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { prisma } from "@/server/db/prisma";
import { resetDatabase } from "@/server/db/test-utils";
import { saveIncomingMessage } from "@/server/messages/repository";
import { handleIngestRequest, POST } from "./route";

beforeEach(async () => {
  vi.stubEnv("SMS_INGEST_TOKEN", "phone-secret");
  vi.stubEnv("KIMI_API_KEY", "kimi-secret");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("Network calls are not expected in ingest route tests");
    })
  );
  await resetDatabase();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await prisma.$disconnect();
});

afterEach(() => {
  vi.useRealTimers();
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
  body: "您的验证码是 123456"
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
    const now = new Date("2026-06-01T12:34:56.789Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const response = await POST(request(validPayload));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message.receivedAt).toBe(now.toISOString());
    expect(json.message.category).toBe("verification");
    expect(json.message.classificationSource).toBe("keyword");
    expect(json.message.isRead).toBe(false);
    expect(json.duplicate).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores legacy receivedAt payload values and uses server time", async () => {
    const now = new Date("2026-06-01T12:34:56.789Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const response = await POST(
      request({
        ...validPayload,
        receivedAt: "2020-01-01T00:00:00.000Z"
      })
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message.receivedAt).toBe(now.toISOString());
  });

  it("returns success for duplicate retries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:34:56.789Z"));

    await POST(request(validPayload));
    const response = await POST(request(validPayload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.duplicate).toBe(true);
  });

  it("omits internal classification errors from the ingest response", async () => {
    const response = await handleIngestRequest(
      request({
        ...validPayload,
        body: "普通通知"
      }),
      {
        classify: vi.fn(async () => ({
          category: "other",
          source: "fallback",
          error: "KIMI_API_KEY is not configured"
        } as const)),
        save: saveIncomingMessage
      }
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.message.category).toBe("other");
    expect(json.message.classificationSource).toBe("fallback");
    expect(json.message.classificationError).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("KIMI_API_KEY");
  });

  it("returns a stable JSON error when persistence fails", async () => {
    const response = await handleIngestRequest(request(validPayload), {
      classify: vi.fn(async () => ({
        category: "verification",
        source: "keyword"
      } as const)),
      save: vi.fn(async () => {
        throw new Error("database down");
      }) as typeof saveIncomingMessage
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to ingest message"
    });
  });
});
