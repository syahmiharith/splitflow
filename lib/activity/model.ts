import { z } from "zod";
import {
  applyCommand,
  calculateExpense,
  commandSchema,
  expenseSchema,
  type Expense,
  type Split,
} from "@/lib/pilot/model";
import { groupPeople } from "@/lib/pilot/groups";
export const activityInput = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["quick", "planned", "recurring"]),
  people: groupPeople,
  groupId: z.uuid().optional(),
  templates: z.array(expenseSchema).max(100).optional(),
});
export const groupInput = z.object({
  name: z.string().trim().min(1).max(80),
  people: groupPeople,
});
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Enter a valid date.",
  );
export const activityCommand = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    text: z.string().trim().min(1).max(4000),
  }),
  z.object({
    type: z.literal("expense"),
    id: z.uuid(),
    expense: expenseSchema,
  }),
  z.object({
    type: z.literal("expenseCommand"),
    id: z.uuid(),
    expected: z.number().int().positive(),
    command: commandSchema,
  }),
  z.object({
    type: z.literal("schedule"),
    expectedVersion: z.number().int().min(0),
    expense: expenseSchema,
    start: date,
    dueDay: z.number().int().min(1).max(28),
    variable: z.boolean(),
  }),
  z.object({
    type: z.literal("acceptTerms"),
    version: z.number().int().positive(),
  }),
  z.object({ type: z.literal("pauseSchedule"), paused: z.boolean() }),
  z.object({ type: z.literal("archive"), archived: z.boolean() }),
]);
export const groupCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join") }),
  z.object({
    type: z.literal("rename"),
    name: z.string().trim().min(1).max(80),
  }),
  z.object({ type: z.literal("invite"), people: groupPeople }),
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("remove"), email: z.email().toLowerCase() }),
]);
export type Person = z.infer<typeof groupPeople>[number];
export type SharedGroup = {
  id: string;
  revision: number;
  name: string;
  owner: string;
  people: Person[];
  joined: string[];
  invitations: Record<string, string>;
};
export type Schedule = {
  resumeFrom?: string;
  version: number;
  expense: Expense;
  start: string;
  dueDay: number;
  variable: boolean;
  paused: boolean;
  accepted: string[];
};
export type Activity = {
  templates?: Expense[];
  id: string;
  revision: number;
  title: string;
  kind: "quick" | "planned" | "recurring";
  owner: string;
  people: Person[];
  groupId?: string;
  expenses: (Split & { period?: string; dueDate?: string })[];
  messages: { id: string; actor: string; text: string; at: string }[];
  schedule?: Schedule;
  archivedBy: string[];
};
export function createGroup(
  actor: string,
  input: z.infer<typeof groupInput>,
): SharedGroup {
  const value = groupInput.parse(input);
  if (!value.people.some((p) => p.email === actor))
    throw Error("Include yourself.");
  return {
    id: crypto.randomUUID(),
    revision: 1,
    owner: actor,
    ...value,
    joined: [actor],
    invitations: Object.fromEntries(
      value.people
        .filter((p) => p.email !== actor)
        .map((p) => [
          p.email,
          new Date(Date.now() + 7 * 86400000).toISOString(),
        ]),
    ),
  };
}
export function changeGroup(
  current: SharedGroup,
  actor: string,
  input: z.infer<typeof groupCommand>,
): SharedGroup {
  if (!current.people.some((p) => p.email === actor))
    throw Error("Group access required.");
  const cmd = groupCommand.parse(input),
    next = structuredClone(current);
  if (cmd.type === "join") {
    if (!next.joined.includes(actor)) {
      if (
        !next.invitations?.[actor] ||
        Date.parse(next.invitations[actor]) < Date.now()
      )
        throw Error(
          "This group invitation expired. Ask the owner to invite you again.",
        );
      next.joined.push(actor);
      delete next.invitations[actor];
    }
  } else if (cmd.type === "leave") {
    if (actor === current.owner)
      throw Error("The owner cannot leave the group.");
    next.joined = next.joined.filter((e) => e !== actor);
    next.people = next.people.filter((p) => p.email !== actor);
  } else {
    if (actor !== current.owner)
      throw Error("Only the group owner can manage members and settings.");
    if (cmd.type === "rename") next.name = cmd.name;
    else if (cmd.type === "remove") {
      if (cmd.email === next.owner) throw Error("The owner cannot be removed.");
      next.people = next.people.filter((p) => p.email !== cmd.email);
      next.joined = next.joined.filter((e) => e !== cmd.email);
      delete next.invitations[cmd.email];
    } else {
      const unique = new Map(next.people.map((p) => [p.email, p]));
      cmd.people.forEach((p) => unique.set(p.email, p));
      next.people = groupPeople.parse([...unique.values()]);
      for (const p of cmd.people) {
        if (!next.joined.includes(p.email))
          next.invitations[p.email] = new Date(
            Date.now() + 7 * 86400000,
          ).toISOString();
      }
    }
  }
  next.revision++;
  return next;
}
export function createActivity(
  actor: string,
  input: z.infer<typeof activityInput>,
): Activity {
  const value = activityInput.parse(input);
  if (!value.people.some((p) => p.email === actor))
    throw Error("Include yourself.");
  return {
    id: crypto.randomUUID(),
    revision: 1,
    owner: actor,
    ...value,
    expenses: [],
    messages: [],
    archivedBy: [],
  };
}
function checkExpense(activity: Activity, expense: Expense) {
  calculateExpense(expense);
  if (
    expense.participants.some(
      (p) => !activity.people.some((m) => m.email === p.email),
    )
  )
    throw Error("Choose people participating in this activity.");
}
export function changeActivity(
  current: Activity,
  actor: string,
  input: z.infer<typeof activityCommand>,
): Activity {
  if (!current.people.some((p) => p.email === actor))
    throw Error("Activity access required.");
  const cmd = activityCommand.parse(input),
    next = structuredClone(current);
  let text = "";
  if (cmd.type === "message") text = cmd.text;
  if (cmd.type === "expense") {
    checkExpense(current, cmd.expense);
    if (!cmd.expense.participants.some((p) => p.email === actor))
      throw Error("Include yourself in the expense.");
    if (next.expenses.some((e) => e.id === cmd.id))
      throw Error("This expense already exists.");
    next.expenses.push({
      id: cmd.id,
      organizer: actor,
      revision: 1,
      expense: cmd.expense,
      responses: {},
      repayments: [],
      audit: [{ actor, action: "published", at: new Date().toISOString() }],
    });
    text = `Added ${cmd.expense.title}`;
  }
  if (cmd.type === "expenseCommand") {
    const index = next.expenses.findIndex((e) => e.id === cmd.id);
    if (index < 0) throw Error("Expense unavailable.");
    if (next.expenses[index].revision !== cmd.expected)
      throw Error("This expense changed. Review the current version.");
    if (cmd.command.type === "revise")
      checkExpense(current, cmd.command.expense);
    next.expenses[index] = {
      ...next.expenses[index],
      ...applyCommand(next.expenses[index], actor, cmd.command),
    };
    text = `Updated ${next.expenses[index].expense.title}`;
  }
  if (cmd.type === "schedule") {
    if (cmd.expectedVersion !== (current.schedule?.version ?? 0))
      throw Error(
        "Recurring terms changed. Reopen the schedule and review the latest version.",
      );
    if (actor !== current.owner || current.kind !== "recurring")
      throw Error("Only the recurring activity owner can set terms.");
    checkExpense(current, cmd.expense);
    if (
      cmd.expense.mode !== "paid" ||
      !cmd.expense.participants.some((p) => p.email === actor)
    )
      throw Error("Set the expected payer and include yourself.");
    next.schedule = {
      version: (current.schedule?.version ?? 0) + 1,
      expense: cmd.expense,
      start: cmd.start,
      dueDay: cmd.dueDay,
      variable: cmd.variable,
      paused: false,
      accepted: [actor],
    };
    text = "Proposed recurring terms; affected members must accept.";
  }
  if (cmd.type === "acceptTerms") {
    if (!next.schedule || next.schedule.version !== cmd.version)
      throw Error("Recurring terms changed. Review the latest version.");
    if (!next.schedule.expense.participants.some((p) => p.email === actor))
      throw Error("These terms do not include you.");
    if (!next.schedule.accepted.includes(actor))
      next.schedule.accepted.push(actor);
    text = "Accepted recurring terms";
  }
  if (cmd.type === "pauseSchedule") {
    if (actor !== current.owner || !next.schedule)
      throw Error("Only the owner can pause or resume the schedule.");
    next.schedule.paused = cmd.paused;
    if (!cmd.paused)
      next.schedule.resumeFrom = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Seoul",
      });
    text = cmd.paused
      ? "Paused future recurring costs"
      : "Resumed recurring costs";
  }
  if (cmd.type === "archive") {
    next.archivedBy = next.archivedBy.filter((e) => e !== actor);
    if (cmd.archived) next.archivedBy.push(actor);
  }
  if (text)
    next.messages.push({
      id: crypto.randomUUID(),
      actor,
      text,
      at: new Date().toISOString(),
    });
  next.revision++;
  return next;
}
export function duePeriods(
  activity: Activity,
  today: string,
): { period: string; date: string; dueDate: string }[] {
  const s = activity.schedule;
  if (
    !s ||
    s.paused ||
    s.variable ||
    s.expense.participants.some((p) => !s.accepted.includes(p.email))
  )
    return [];
  const result = [];
  const [year, month, day] = s.start.split("-").map(Number);
  let cursor = new Date(Date.UTC(year, month - 1, 1));
  for (let count = 0; count < 1200; count++) {
    const y = cursor.getUTCFullYear(),
      m = cursor.getUTCMonth();
    const period = `${y}-${String(m + 1).padStart(2, "0")}`;
    const at = `${period}-${String(Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())).padStart(2, "0")}`;
    if (at > today) break;
    const due = new Date(
      Date.UTC(y, m + (s.dueDay < Number(at.slice(8)) ? 1 : 0), s.dueDay),
    )
      .toISOString()
      .slice(0, 10);
    if (
      (!s.resumeFrom || at >= s.resumeFrom) &&
      !activity.expenses.some((e) => e.period === period)
    )
      result.push({ period, date: at, dueDate: due });
    cursor = new Date(Date.UTC(y, m + 1, 1));
  }
  return result;
}
export function publishDuePeriods(current: Activity, today: string): Activity {
  const periods = duePeriods(current, today);
  if (!periods.length) return current;
  const next = structuredClone(current),
    schedule = next.schedule!;
  for (const period of periods) {
    next.expenses.push({
      id: crypto.randomUUID(),
      revision: 1,
      organizer: next.owner,
      expense: {
        ...structuredClone(schedule.expense),
        mode: "planned",
        title: `${schedule.expense.title} · ${period.period}`,
      },
      responses: Object.fromEntries(
        schedule.accepted.map((email) => [
          email,
          {
            revision: 1,
            status: "accepted" as const,
            reason: `Recurring terms v${schedule.version}`,
          },
        ]),
      ),
      repayments: [],
      audit: [
        {
          actor: next.owner,
          action: `Scheduled period ${period.period}; terms v${schedule.version}`,
          at: new Date().toISOString(),
        },
      ],
      period: period.period,
      dueDate: period.dueDate,
    });
    next.messages.push({
      id: crypto.randomUUID(),
      actor: next.owner,
      text: `Scheduled ${period.period}: ${schedule.expense.title}. Due ${period.dueDate}.`,
      at: new Date().toISOString(),
    });
  }
  next.revision++;
  return next;
}
