import { pilotRequest } from "@/lib/pilot/session";
import {
  createGroup,
  changeGroup,
  createActivity,
  changeActivity,
  publishDuePeriods,
  type Activity,
  type SharedGroup,
} from "./model";
export type RecordRow =
  | { kind: "group"; document: SharedGroup }
  | { kind: "activity"; document: Activity };
export type Operation = {
  id: string;
  key: string;
  expected: number;
  kind: "group" | "activity";
  input?: unknown;
  command?: unknown;
};
const storage = "splitflow-unified-sample-v1";
export const samplePeople = [
  { name: "Alex", email: "alex@example.test" },
  { name: "Minji", email: "minji@example.test" },
  { name: "Sam", email: "sam@example.test" },
];
function seed(): RecordRow[] {
  const group = createGroup(samplePeople[0].email, {
    name: "Friends & housemates",
    people: samplePeople,
  });
  group.joined = samplePeople.map((p) => p.email);
  let activity = createActivity(samplePeople[0].email, {
    title: "Weekend together",
    kind: "quick",
    people: samplePeople,
    groupId: group.id,
  });
  activity = changeActivity(activity, samplePeople[0].email, {
    type: "expense",
    id: crypto.randomUUID(),
    expense: {
      title: "Dinner",
      mode: "paid",
      participants: samplePeople.map((p, i) => ({
        ...p,
        paid: i === 0 ? 60000 : 0,
      })),
      items: [
        {
          name: "Dinner",
          amount: 60000,
          included: samplePeople.map((p) => p.email),
        },
      ],
    },
  });
  let trip = createActivity(samplePeople[0].email, {
    title: "Plan a shared trip",
    kind: "planned",
    people: samplePeople,
    groupId: group.id,
  });
  trip = changeActivity(trip, samplePeople[0].email, {
    type: "expense",
    id: crypto.randomUUID(),
    expense: {
      title: "Transport and tickets",
      mode: "planned",
      participants: samplePeople.map((p, i) => ({
        ...p,
        paid: i === 0 ? 90000 : i === 1 ? 30000 : 0,
      })),
      items: [
        {
          name: "Transport",
          amount: 90000,
          included: samplePeople.map((p) => p.email),
        },
        {
          name: "Tickets",
          amount: 30000,
          included: samplePeople.slice(0, 2).map((p) => p.email),
          units: { [samplePeople[0].email]: 1, [samplePeople[1].email]: 2 },
        },
      ],
    },
  });
  let rent = createActivity(samplePeople[0].email, {
    title: "Household rent",
    kind: "recurring",
    people: samplePeople,
    groupId: group.id,
  });
  rent = changeActivity(rent, samplePeople[0].email, {
    type: "schedule",
    expectedVersion: 0,
    start: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
    dueDay: 28,
    variable: false,
    expense: {
      title: "Rent",
      mode: "paid",
      participants: samplePeople.map((p, i) => ({
        ...p,
        paid: i === 0 ? 900000 : 0,
      })),
      items: [
        {
          name: "Monthly rent",
          amount: 900000,
          included: samplePeople.map((p) => p.email),
        },
      ],
    },
  });
  rent = changeActivity(rent, samplePeople[2].email, {
    type: "acceptTerms",
    version: 1,
  });
  return [
    { kind: "group", document: group },
    { kind: "activity", document: activity },
    { kind: "activity", document: trip },
    { kind: "activity", document: rent },
  ];
}
function sampleState(): {
  rows: RecordRow[];
  operations: Record<string, Activity | SharedGroup>;
} {
  const raw = localStorage.getItem(storage);
  if (raw) return JSON.parse(raw);
  const value = { rows: seed(), operations: {} };
  localStorage.setItem(storage, JSON.stringify(value));
  return value;
}
export async function loadWorkspace(
  guest: boolean,
  email: string,
): Promise<RecordRow[]> {
  if (!guest) return pilotRequest("/api/workspace");
  const value = sampleState();
  value.rows = value.rows.map((row) =>
    row.kind === "activity"
      ? {
          ...row,
          document: publishDuePeriods(
            row.document,
            new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
          ),
        }
      : row,
  );
  localStorage.setItem(storage, JSON.stringify(value));
  return value.rows.filter((row) =>
    row.document.people.some((p) => p.email === email),
  );
}
export async function writeWorkspace(
  guest: boolean,
  email: string,
  op: Operation,
): Promise<Activity | SharedGroup> {
  if (!guest)
    return pilotRequest("/api/workspace", {
      method: "POST",
      body: JSON.stringify(op),
    });
  const value = sampleState(),
    row = value.rows.find((r) => r.document.id === op.id);
  if (row && !row.document.people.some((p) => p.email === email))
    throw Error("Workspace unavailable.");
  const previous = value.operations[`${email}:${op.key}`];
  if (previous) {
    if (previous.id !== op.id) throw Error("Submission key already used.");
    return previous;
  }
  if ((row?.document.revision ?? 0) !== op.expected)
    throw Error("This activity changed. Review the latest version.");
  let document: Activity | SharedGroup;
  if (op.kind === "group")
    document = row
      ? changeGroup(
          row.document as SharedGroup,
          email,
          op.command as Parameters<typeof changeGroup>[2],
        )
      : createGroup(email, op.input as Parameters<typeof createGroup>[1]);
  else {
    const input = op.input as Parameters<typeof createActivity>[1];
    if (!row && input.groupId) {
      const group = value.rows.find(
        (r) => r.kind === "group" && r.document.id === input.groupId,
      )?.document as SharedGroup | undefined;
      if (
        !group?.joined.includes(email) ||
        input.people.some((p) => !group.joined.includes(p.email))
      )
        throw Error("Choose joined group members.");
    }
    document = row
      ? changeActivity(
          row.document as Activity,
          email,
          op.command as Parameters<typeof changeActivity>[2],
        )
      : createActivity(email, input);
  }
  document.id = op.id;
  value.rows = value.rows.filter((r) => r.document.id !== op.id);
  value.rows.push({ kind: op.kind, document } as RecordRow);
  value.operations[`${email}:${op.key}`] = document;
  localStorage.setItem(storage, JSON.stringify(value));
  return document;
}
export function resetSample() {
  localStorage.removeItem(storage);
}
