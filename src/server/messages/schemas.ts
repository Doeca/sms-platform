import { z } from "zod";

export const messageCategorySchema = z.enum([
  "verification",
  "loan_collection",
  "other"
]);

export const readStateSchema = z.enum(["all", "unread", "read"]);

const isoDateSchema = z.iso.datetime().transform((value) => new Date(value));

const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

function parseLocalDateTime(value: string) {
  const match = value.trim().match(localDateTimePattern);

  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] =
    match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const date = new Date(year, month - 1, day, hour, minute, second);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }

  return date;
}

const ingestDateSchema = z.union([
  isoDateSchema,
  z.string().transform((value, context) => {
    const date = parseLocalDateTime(value);

    if (!date) {
      context.addIssue({
        code: "custom",
        message: "Invalid datetime"
      });
      return z.NEVER;
    }

    return date;
  })
]);

const optionalSimSlotSchema = z.preprocess(
  (value) => {
    if (value === null) {
      return undefined;
    }

    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  },
  z.coerce.number().int().min(0).max(8).optional()
);

export const incomingMessageSchema = z.object({
  receivedPhoneNumber: z.string().trim().min(1),
  deviceName: z.string().trim().min(1).optional(),
  simSlot: optionalSimSlotSchema,
  sender: z.string().trim().min(1),
  body: z.string().trim().min(1),
  receivedAt: ingestDateSchema
});

export const listMessagesQuerySchema = z.object({
  readState: readStateSchema.default("all"),
  category: messageCategorySchema.optional(),
  sourceId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  before: isoDateSchema.optional()
});

export const updateMessageSchema = z
  .object({
    isRead: z.boolean().optional(),
    category: messageCategorySchema.optional()
  })
  .refine((value) => value.isRead !== undefined || value.category !== undefined, {
    message: "At least one supported field must be provided"
  });

export type IncomingMessageInput = z.infer<typeof incomingMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type MessageCategoryInput = z.infer<typeof messageCategorySchema>;
