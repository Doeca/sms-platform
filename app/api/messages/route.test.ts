import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAccessCookie } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { resetDatabase } from "@/server/db/test-utils";
import { saveIncomingMessage } from "@/server/messages/repository";
import { GET } from "./route";

beforeEach(async () => {
  vi.stubEnv("WEB_ACCESS_KEY", "web-secret");
  await resetDatabase();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

function authedRequest(url = "http://localhost/api/messages") {
  return new Request(url, {
    headers: {
      Cookie: buildAccessCookie("web-secret", false)
    }
  });
}

describe("GET /api/messages", () => {
  it("rejects requests without the access cookie", async () => {
    const response = await GET(new Request("http://localhost/api/messages"));

    expect(response.status).toBe(401);
  });

  it("returns messages, sources, and stats", async () => {
    await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    const response = await GET(authedRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.messages).toHaveLength(1);
    expect(json.messages[0].receivedAt).toBe("2026-05-30T08:30:00.000Z");
    expect(json.messages[0].source.label).toBe("+8613800000000");
    expect(json.sources).toHaveLength(1);
    expect(json.sources[0].label).toBe("+8613800000000");
    expect(json.stats.verification).toBe(1);
  });

  it("applies category filters", async () => {
    await saveIncomingMessage(
      {
        receivedPhoneNumber: "+8613800000000",
        sender: "955xx",
        body: "您的验证码是 123456",
        receivedAt: new Date("2026-05-30T08:30:00.000Z")
      },
      { category: "verification", source: "keyword" }
    );

    const response = await GET(
      authedRequest("http://localhost/api/messages?category=other")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.messages).toHaveLength(0);
    expect(json.stats.verification).toBe(1);
  });

  it("rejects invalid query parameters", async () => {
    const response = await GET(
      authedRequest("http://localhost/api/messages?limit=0")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid query" });
  });

  it.each([
    "readState=nope",
    "category=spam",
    "sourceId=",
    "before=not-a-date",
    "limit=201",
    "limit=1.5",
    "limit=0&limit=100",
    "readState=nope&readState=read",
    "category=other&category=verification",
    "sourceId=one&sourceId=two",
    "before=2026-05-30T08%3A30%3A00.000Z&before=2026-05-31T08%3A30%3A00.000Z"
  ])("rejects invalid query string %s", async (queryString) => {
    const response = await GET(
      authedRequest(`http://localhost/api/messages?${queryString}`)
    );

    expect(response.status).toBe(400);
  });
});
