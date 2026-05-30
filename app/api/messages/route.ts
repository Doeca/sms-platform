import { NextResponse } from "next/server";
import { hasValidAccessCookie } from "@/server/auth";
import { formatSourceLabel } from "@/server/messages/format";
import { listMessages } from "@/server/messages/repository";
import { listMessagesQuerySchema } from "@/server/messages/schemas";

type ListMessage = Awaited<ReturnType<typeof listMessages>>["messages"][number];
const singleValueQueryKeys = [
  "readState",
  "category",
  "sourceId",
  "limit",
  "before"
] as const;

function serializeMessage(message: ListMessage) {
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

export async function GET(request: Request) {
  if (!hasValidAccessCookie(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);

  if (singleValueQueryKeys.some((key) => url.searchParams.getAll(key).length > 1)) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const parsed = listMessagesQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const result = await listMessages(parsed.data);

  return NextResponse.json({
    messages: result.messages.map(serializeMessage),
    sources: result.sources.map((source) => ({
      id: source.id,
      receivedPhoneNumber: source.receivedPhoneNumber,
      deviceName: source.deviceName,
      simSlot: source.simSlot,
      label: formatSourceLabel(source)
    })),
    stats: result.stats
  });
}
