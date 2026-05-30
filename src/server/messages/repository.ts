import type { MessageCategory, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { ClassificationResult } from "@/server/classification/types";
import { buildDedupeKey } from "./identifiers";
import type {
  IncomingMessageInput,
  ListMessagesQuery,
  UpdateMessageInput
} from "./schemas";

async function findOrCreateSource(input: IncomingMessageInput) {
  const existing = await prisma.messageSource.findFirst({
    where: {
      receivedPhoneNumber: input.receivedPhoneNumber,
      deviceName: input.deviceName ?? null,
      simSlot: input.simSlot ?? null
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.messageSource.create({
    data: {
      receivedPhoneNumber: input.receivedPhoneNumber,
      deviceName: input.deviceName,
      simSlot: input.simSlot
    }
  });
}

function messageInclude() {
  return {
    source: true
  } satisfies Prisma.MessageInclude;
}

export async function saveIncomingMessage(
  input: IncomingMessageInput,
  classification: ClassificationResult
) {
  const dedupeKey = buildDedupeKey(input);
  const existing = await prisma.message.findUnique({
    where: { dedupeKey },
    include: messageInclude()
  });

  if (existing) {
    return {
      duplicate: true,
      message: existing
    };
  }

  const source = await findOrCreateSource(input);
  const message = await prisma.message.create({
    data: {
      sourceId: source.id,
      sender: input.sender,
      body: input.body,
      receivedAt: input.receivedAt,
      category: classification.category,
      classificationSource: classification.source,
      classificationError: classification.error,
      dedupeKey
    },
    include: messageInclude()
  });

  return {
    duplicate: false,
    message
  };
}

export async function listMessages(query: ListMessagesQuery) {
  const where: Prisma.MessageWhereInput = {};

  if (query.readState === "read") {
    where.isRead = true;
  }

  if (query.readState === "unread") {
    where.isRead = false;
  }

  if (query.category) {
    where.category = query.category;
  }

  if (query.sourceId) {
    where.sourceId = query.sourceId;
  }

  if (query.before) {
    where.receivedAt = {
      lt: query.before
    };
  }

  const [messages, sources, all, unread, verification, loanCollection, other] =
    await Promise.all([
      prisma.message.findMany({
        where,
        include: messageInclude(),
        orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        take: query.limit
      }),
      prisma.messageSource.findMany({
        orderBy: [{ deviceName: "asc" }, { receivedPhoneNumber: "asc" }]
      }),
      prisma.message.count(),
      prisma.message.count({ where: { isRead: false } }),
      prisma.message.count({ where: { category: "verification" } }),
      prisma.message.count({ where: { category: "loan_collection" } }),
      prisma.message.count({ where: { category: "other" } })
    ]);

  return {
    messages,
    sources,
    stats: {
      all,
      unread,
      verification,
      loan_collection: loanCollection,
      other
    }
  };
}

export async function updateMessage(id: string, patch: UpdateMessageInput) {
  const data: Prisma.MessageUpdateInput = {};

  if (patch.isRead !== undefined) {
    data.isRead = patch.isRead;
  }

  if (patch.category !== undefined) {
    data.category = patch.category as MessageCategory;
    data.classificationSource = "manual";
    data.classificationError = null;
  }

  return prisma.message.update({
    where: { id },
    data,
    include: messageInclude()
  });
}
