import { prepareOperation, prepareBatch } from "./operations";
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
  const friends: RecordRow[] = samplePeople.flatMap((p,i) => samplePeople.slice(i+1).map(other => {
    const group = createGroup(p.email,{name:"Friendship",friendship:true,people:[p,other]});
    return {kind:"group" as const,document:changeGroup(group,other.email,{type:"join"})};
  }));
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
  // Synthetic sample scenario: both participants explicitly agreed to this dinner.
  for (const person of samplePeople.slice(1)) activity = changeActivity(activity, person.email, {
    type:"expenseCommand",id:activity.expenses[0].id,expected:activity.expenses[0].revision,
    command:{type:"respond",status:"accepted",reason:"Sample participant agreement"},
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
    ...friends,
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
  const { document } = prepareOperation(value.rows, email, op);
  value.rows = value.rows.filter((r) => r.document.id !== op.id);
  value.rows.push({ kind: op.kind, document } as RecordRow);
  value.operations[`${email}:${op.key}`] = document;
  localStorage.setItem(storage, JSON.stringify(value));
  return document;
}
export function resetSample() {
  localStorage.removeItem(storage);
}

/** One storage commit; a failed member of a batch leaves the sample untouched. */
export function commitSampleBatch(email: string, operations: Operation[]) {
  const state = sampleState();
  const prior = operations.map((op) => state.operations[`${email}:${op.key}`]);
  if (prior.every(Boolean)) return prior;
  if (prior.some(Boolean)) throw Error("Incomplete operation batch.");
  const prepared = prepareBatch(state.rows, email, operations);
  state.rows = prepared.rows;
  operations.forEach((op, i) => {
    state.operations[`${email}:${op.key}`] = prepared.results[i].document;
  });
  localStorage.setItem(storage, JSON.stringify(state));
  return prepared.results.map((r) => r.document);
}
