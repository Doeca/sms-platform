import { NextResponse } from "next/server";
import { buildAccessCookie, hasValidWebAccessKey } from "@/server/auth";

type AccessPayload = {
  accessKey?: unknown;
};

function isAccessPayload(payload: unknown): payload is AccessPayload {
  return typeof payload === "object" && payload !== null;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const expected = process.env.WEB_ACCESS_KEY;
  const accessKey = isAccessPayload(payload) ? payload.accessKey : undefined;

  if (!hasValidWebAccessKey(accessKey, expected)) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": buildAccessCookie(expected)
      }
    }
  );
}
