import { NextResponse } from "next/server";
import { hasValidIngestToken } from "@/server/auth";
import { classifyMessage } from "@/server/classification/classify";
import type { ClassificationResult } from "@/server/classification/types";
import { saveIncomingMessage } from "@/server/messages/repository";
import { incomingMessageSchema } from "@/server/messages/schemas";

type SavedMessageResult = Awaited<ReturnType<typeof saveIncomingMessage>>;

type IngestDependencies = {
  classify: (body: string) => Promise<ClassificationResult>;
  save: typeof saveIncomingMessage;
};

function serializeSavedMessage(saved: SavedMessageResult) {
  return {
    duplicate: saved.duplicate,
    message: {
      id: saved.message.id,
      sourceId: saved.message.sourceId,
      sender: saved.message.sender,
      body: saved.message.body,
      receivedAt: saved.message.receivedAt.toISOString(),
      category: saved.message.category,
      classificationSource: saved.message.classificationSource,
      isRead: saved.message.isRead,
      createdAt: saved.message.createdAt.toISOString(),
      updatedAt: saved.message.updatedAt.toISOString(),
      source: saved.message.source
    }
  };
}

export async function handleIngestRequest(
  request: Request,
  dependencies: IngestDependencies
) {
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

  const incomingMessage = {
    ...parsed.data,
    receivedAt: new Date()
  };

  try {
    const classification = await dependencies.classify(parsed.data.body);
    const saved = await dependencies.save(incomingMessage, classification);

    return NextResponse.json(serializeSavedMessage(saved), {
      status: saved.duplicate ? 200 : 201
    });
  } catch {
    return NextResponse.json({ error: "Failed to ingest message" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleIngestRequest(request, {
    classify: classifyMessage,
    save: saveIncomingMessage
  });
}
