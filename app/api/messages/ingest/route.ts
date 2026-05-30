import { NextResponse } from "next/server";
import { hasValidIngestToken } from "@/server/auth";
import { classifyMessage } from "@/server/classification/classify";
import { saveIncomingMessage } from "@/server/messages/repository";
import { incomingMessageSchema } from "@/server/messages/schemas";

export async function POST(request: Request) {
  if (!hasValidIngestToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Invalid ingest token" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = incomingMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid ingest payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      { status: 400 }
    );
  }

  const classification = await classifyMessage(parsed.data.body);
  const saved = await saveIncomingMessage(parsed.data, classification);

  return NextResponse.json(saved, {
    status: saved.duplicate ? 200 : 201
  });
}
