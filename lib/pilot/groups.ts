import { z } from "zod";
import type { Expense } from "./model";
export const groupPeople = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(80),
      email: z.email().toLowerCase(),
    }),
  )
  .min(2)
  .max(30)
  .refine(
    (people) => new Set(people.map((p) => p.email)).size === people.length,
    "Each person needs a different email.",
  );
export const groupContent = z.object({
  name: z.string().trim().min(1).max(80),
  people: groupPeople,
});
export const groupInput = groupContent.extend({
  id: z.uuid(),
  expected: z.number().int().min(0),
  key: z.uuid(),
});
export type SavedGroup = z.infer<typeof groupContent> & {
  id: string;
  revision: number;
};
export function expenseFromGroup(group: SavedGroup): Expense {
  return {
    title: "",
    mode: "paid",
    participants: group.people.map((p) => ({ ...p, paid: 0 })),
    items: [
      { name: "Dinner", amount: 0, included: group.people.map((p) => p.email) },
    ],
  };
}
