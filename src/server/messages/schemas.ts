import { z } from "zod";

export const messageCategorySchema = z.enum([
  "verification",
  "loan_collection",
  "other"
]);

export const readStateSchema = z.enum(["all", "unread", "read"]);

export const incomingMessageSchema = z.object({
  receivedPhoneNumber: z.string().trim().min(1),
  deviceName: z.string().trim().min(1).optional(),
  simSlot: z.coerce.number().int().min(0).max(8).optional(),
  sender: z.string().trim().min(1),
  body: z.string().trim().min(1),
  receivedAt: z.coerce.date()
});

export const listMessagesQuerySchema = z.object({
  readState: readStateSchema.default("all"),
  category: messageCategorySchema.optional(),
  sourceId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  before: z.coerce.date().optional()
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
