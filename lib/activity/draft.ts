import { z } from "zod";
export const draftExpenseSchema = z.object({
  title: z.string().max(120),
  mode: z.enum(["paid", "planned"]),
  participants: z
    .array(
      z.object({
        name: z.string().max(80),
        email: z.string().max(254),
        paid: z.number().int().min(0).max(1000000000),
      }),
    )
    .min(2)
    .max(30),
  items: z
    .array(
      z.object({
        name: z.string().max(120),
        amount: z.number().int().min(0).max(1000000000),
        included: z.array(z.string().max(254)).max(30),
        custom: z
          .record(z.string(), z.number().int().min(0).max(1000000000))
          .optional(),
        units: z
          .record(z.string(), z.number().int().min(0).max(1000000))
          .optional(),
      }),
    )
    .min(1)
    .max(100),
});
