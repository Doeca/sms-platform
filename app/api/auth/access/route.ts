import { NextResponse } from "next/server";
import { buildAccessCookie } from "@/server/auth";

type AccessPayload = {
  accessKey?: unknown;
};

export async function POST(request: Request) {
  let payload: AccessPayload;

  try {
    payload = (await request.json()) as AccessPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const expected = process.env.WEB_ACCESS_KEY;

  if (
    typeof payload.accessKey !== "string" ||
    !expected ||
    payload.accessKey !== expected
  ) {
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
