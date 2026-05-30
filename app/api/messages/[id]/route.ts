import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasValidAccessCookie } from "@/server/auth";
import { formatSourceLabel } from "@/server/messages/format";
import { updateMessage } from "@/server/messages/repository";
import { updateMessageSchema } from "@/server/messages/schemas";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdatedMessage = Awaited<ReturnType<typeof updateMessage>>;

function serializeMessage(message: UpdatedMessage) {
  return {
    id: message.id,
    sender: message.sender,
    body: message.body,
    receivedAt: message.receivedAt.toISOString(),
    createdAt: message.createdAt.toISOString(),
    category: message.category,
    classificationSource: message.classificationSource,
    classificationError: message.classificationError,
    isRead: message.isRead,
    source: {
      id: message.source.id,
      receivedPhoneNumber: message.source.receivedPhoneNumber,
      deviceName: message.source.deviceName,
      simSlot: message.source.simSlot,
      label: formatSourceLabel(message.source)
    }
  };
}

function isRecordNotFoundError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!hasValidAccessCookie(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const message = await updateMessage(id, parsed.data);

    return NextResponse.json({
      message: serializeMessage(message)
    });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}
