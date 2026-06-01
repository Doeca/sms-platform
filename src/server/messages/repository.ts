import { Prisma, type MessageCategory } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { ClassificationResult } from "@/server/classification/types";
import { buildDedupeKey, buildSourceIdentityKey } from "./identifiers";
import type {
  IncomingMessageInput,
  ListMessagesQuery,
  UpdateMessageInput
} from "./schemas";

type PersistIncomingMessageInput = IncomingMessageInput & {
  receivedAt: Date;
};

async function findOrCreateSource(input: IncomingMessageInput) {
  const identityKey = buildSourceIdentityKey(input);
  const existingIdentity = await prisma.messageSourceIdentity.findUnique({
    where: { identityKey },
    include: { source: true }
  });

  if (existingIdentity) {
    return existingIdentity.source;
  }

  const existingSource = await prisma.messageSource.findFirst({
    where: {
      receivedPhoneNumber: input.receivedPhoneNumber,
      deviceName: input.deviceName ?? null,
      simSlot: input.simSlot ?? null
    }
  });

  if (existingSource) {
    try {
      await prisma.messageSourceIdentity.create({
        data: {
          identityKey,
          sourceId: existingSource.id
        }
      });

      return existingSource;
    } catch (error) {
      if (
        !isUniqueConstraintError(error, "identityKey") &&
        !isUniqueConstraintError(error, "sourceId")
      ) {
        throw error;
      }

      const identity = await prisma.messageSourceIdentity.findUnique({
        where: { identityKey },
        include: { source: true }
      });

      if (!identity) {
        throw error;
      }

      return identity.source;
    }
  }

  const identity = await prisma.messageSourceIdentity.upsert({
    where: { identityKey },
    update: {},
    create: {
      identityKey,
      source: {
        create: {
          receivedPhoneNumber: input.receivedPhoneNumber,
          deviceName: input.deviceName,
          simSlot: input.simSlot
        }
      }
    },
    include: { source: true }
  });

  return identity.source;
}

function messageInclude() {
  return {
    source: true
  } satisfies Prisma.MessageInclude;
}

function isUniqueConstraintError(error: unknown, field: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  const target = error.meta?.target;

  return (
    error.code === "P2002" &&
    (target === field || (Array.isArray(target) && target.includes(field)))
  );
}

export async function saveIncomingMessage(
  input: PersistIncomingMessageInput,
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
  try {
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
  } catch (error) {
    if (!isUniqueConstraintError(error, "dedupeKey")) {
      throw error;
    }

    const duplicate = await prisma.message.findUnique({
      where: { dedupeKey },
      include: messageInclude()
    });

    if (!duplicate) {
      throw error;
    }

    return {
      duplicate: true,
      message: duplicate
    };
  }
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

  const [
    messages,
    sources,
    all,
    unread,
    verification,
    loanCollection,
    other,
    unreadVerification,
    unreadLoanCollection,
    unreadOther
  ] = await Promise.all([
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
    prisma.message.count({ where: { category: "other" } }),
    prisma.message.count({
      where: { category: "verification", isRead: false }
    }),
    prisma.message.count({
      where: { category: "loan_collection", isRead: false }
    }),
    prisma.message.count({ where: { category: "other", isRead: false } })
  ]);

  return {
    messages,
    sources,
    stats: {
      all,
      unread,
      verification,
      loan_collection: loanCollection,
      other,
      unreadByCategory: {
        verification: unreadVerification,
        loan_collection: unreadLoanCollection,
        other: unreadOther
      }
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
