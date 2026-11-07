import { z } from "zod";
import { expenseSchema } from "./model";
export const conversationSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().min(1),
  title: z.string().max(120),
  messages: z
    .array(
      z.object({
        id: z.uuid(),
        role: z.enum(["user", "assistant"]),
        content: z.string().max(6000),
      }),
    )
    .max(100),
  draft: expenseSchema.nullable(),
});
export type Conversation = z.infer<typeof conversationSchema>;
export const conversationInput = z
  .object({
    id: z.uuid(),
    key: z.uuid(),
    expected: z.number().int().min(0),
    message: z.string().trim().min(1).max(2000).optional(),
    draft: expenseSchema.optional(),
  })
  .refine(
    (v) => Boolean(v.message) !== Boolean(v.draft),
    "Send a message or save a draft.",
  );
