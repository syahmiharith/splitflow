import { z } from "zod";
import { distributeRoundingRemainderFairly } from "@/lib/domain/money";

const won = z.number().int().min(0).max(1_000_000_000);
export const expenseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  mode: z.enum(["paid", "planned"]),
  participants: z
    .array(
      z.object({
        email: z.email().toLowerCase(),
        name: z.string().trim().min(1).max(80),
        paid: won,
      }),
    )
    .min(2)
    .max(30),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        amount: won.positive(),
        included: z.array(z.email().toLowerCase()).min(1),
        custom: z.record(z.string(), won).optional(),
      }),
    )
    .min(1)
    .max(100),
});
export type Expense = z.infer<typeof expenseSchema>;
export type Response = {
  revision: number;
  status: "accepted" | "declined" | "correction";
  reason: string;
};
export type Repayment = {
  id: string;
  from: string;
  to: string;
  amount: number;
  status: "reported" | "confirmed" | "disputed";
};
export type Split = {
  id: string;
  organizer: string;
  revision: number;
  expense: Expense;
  responses: Record<string, Response>;
  repayments: Repayment[];
  audit: { actor: string; action: string; at: string }[];
};

export function calculateExpense(input: Expense) {
  const expense = expenseSchema.parse(input);
  const emails = expense.participants.map((p) => p.email);
  if (new Set(emails).size !== emails.length)
    throw new Error("Each participant needs a different email.");
  const shares = Object.fromEntries(emails.map((email) => [email, 0]));
  for (const item of expense.items) {
    if (
      new Set(item.included).size !== item.included.length ||
      item.included.some((email) => !emails.includes(email))
    )
      throw new Error("Select valid participants for each item.");
    let allocation: Record<string, number>;
    if (item.custom) {
      if (
        Object.keys(item.custom).length !== item.included.length ||
        item.included.some((email) => item.custom?.[email] === undefined) ||
        Object.values(item.custom).reduce((a, b) => a + b, 0) !== item.amount
      )
        throw new Error(
          "Custom shares must match the included people and item total.",
        );
      allocation = item.custom;
    } else {
      allocation = distributeRoundingRemainderFairly(
        item.amount,
        item.included.map((id) => ({
          id,
          rawAmount: item.amount / item.included.length,
        })),
      );
    }
    for (const email of item.included) shares[email] += allocation[email];
  }
  const total = expense.items.reduce((sum, item) => sum + item.amount, 0);
  if (expense.participants.reduce((sum, p) => sum + p.paid, 0) !== total)
    throw new Error("Payer contributions must equal the expense total.");
  return { total, shares };
}

export function balances(split: Split) {
  const { shares } = calculateExpense(split.expense);
  const remaining = Object.fromEntries(
    split.expense.participants.map((p) => [p.email, shares[p.email] - p.paid]),
  );
  for (const payment of split.repayments.filter(
    (p) => p.status === "confirmed",
  )) {
    remaining[payment.from] -= payment.amount;
    remaining[payment.to] += payment.amount;
  }
  return remaining;
}

export function itemShare(item: Expense["items"][number], email: string) {
  if (!item.included.includes(email)) return 0;
  return (
    item.custom?.[email] ??
    distributeRoundingRemainderFairly(
      item.amount,
      item.included.map((id) => ({
        id,
        rawAmount: item.amount / item.included.length,
      })),
    )[email]
  );
}

function participantCommitment(expense: Expense, email: string) {
  return JSON.stringify(
    expense.items
      .filter((item) => item.included.includes(email))
      .map((item) => {
        const amount = itemShare(item, email);
        return [item.name, amount];
      }),
  );
}

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("revise"),
    expense: expenseSchema,
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    type: z.literal("respond"),
    status: z.enum(["accepted", "declined", "correction"]),
    reason: z.string().trim().max(500),
  }),
  z.object({
    type: z.literal("report"),
    to: z.email().toLowerCase(),
    amount: won.positive(),
  }),
  z.object({
    type: z.literal("receipt"),
    paymentId: z.uuid(),
    status: z.enum(["confirmed", "disputed"]),
  }),
]);
export const mutationSchema = z.object({
  id: z.uuid(),
  key: z.uuid(),
  expected: z.number().int().min(0),
  expense: expenseSchema.optional(),
  command: commandSchema.optional(),
});
export type PilotMutation = Omit<z.infer<typeof mutationSchema>, "key">;

export function applyCommand(
  current: Split,
  actor: string,
  input: z.infer<typeof commandSchema>,
): Split {
  const command = commandSchema.parse(input);
  if (!current.expense.participants.some((p) => p.email === actor))
    throw new Error("Participant access required.");
  const next = structuredClone(current);
  if (command.type === "revise") {
    if (actor !== current.organizer)
      throw new Error("Only the organizer can revise this split.");
    const old = calculateExpense(current.expense);
    const updated = calculateExpense(command.expense);
    if (
      command.expense.participants.map((p) => p.email).join("|") !==
      current.expense.participants.map((p) => p.email).join("|")
    )
      throw new Error(
        "Keep the existing participants when revising a published split.",
      );
    for (const p of command.expense.participants) {
      const previous = current.expense.participants.find(
        (person) => person.email === p.email,
      )!;
      if (
        old.shares[p.email] !== updated.shares[p.email] ||
        participantCommitment(current.expense, p.email) !==
          participantCommitment(command.expense, p.email) ||
        previous.paid !== p.paid ||
        current.expense.mode !== command.expense.mode
      )
        delete next.responses[p.email];
    }
    next.expense = command.expense;
  }
  if (command.type === "respond") {
    if (command.status === "correction" && !command.reason)
      throw new Error("Describe the correction you need.");
    next.responses[actor] = {
      revision: current.revision,
      status:
        current.expense.mode === "paid" && command.status === "declined"
          ? "correction"
          : command.status,
      reason: command.reason,
    };
  }
  if (command.type === "report") {
    if (
      current.expense.mode !== "paid" ||
      command.to === actor ||
      !current.expense.participants.some((p) => p.email === command.to)
    )
      throw new Error("Choose a recipient in this recorded expense.");
    next.repayments.push({
      id: crypto.randomUUID(),
      from: actor,
      to: command.to,
      amount: command.amount,
      status: "reported",
    });
  }
  if (command.type === "receipt") {
    const payment = next.repayments.find((p) => p.id === command.paymentId);
    if (!payment || payment.to !== actor || payment.status !== "reported")
      throw new Error("Only the recipient can review a reported payment.");
    payment.status = command.status;
  }
  next.revision += 1;
  next.audit.push({
    actor,
    action:
      command.type === "revise" ? `Revision: ${command.reason}` : command.type,
    at: new Date().toISOString(),
  });
  return next;
}

export function settlements(split: Split) {
  const remaining = balances(split);
  const debtors = split.expense.participants
    .filter((person) => remaining[person.email] > 0)
    .map((person) => ({
      email: person.email,
      amount: remaining[person.email],
    }));
  const creditors = split.expense.participants
    .filter((person) => remaining[person.email] < 0)
    .map((person) => ({
      email: person.email,
      amount: -remaining[person.email],
    }));
  const transfers: { from: string; to: string; amount: number }[] = [];
  let debtor = 0;
  let creditor = 0;
  while (debtor < debtors.length && creditor < creditors.length) {
    const amount = Math.min(debtors[debtor].amount, creditors[creditor].amount);
    transfers.push({
      from: debtors[debtor].email,
      to: creditors[creditor].email,
      amount,
    });
    debtors[debtor].amount -= amount;
    creditors[creditor].amount -= amount;
    if (debtors[debtor].amount === 0) debtor += 1;
    if (creditors[creditor].amount === 0) creditor += 1;
  }
  return transfers;
}
