import { z } from "zod";
import {
  activityInput,
  groupInput,
  activityCommand,
  groupCommand,
  createActivity,
  changeActivity,
  createGroup,
  changeGroup,
  type SharedGroup,
  type Activity,
} from "./model";
import type { Operation, RecordRow } from "./client";
export class WorkspaceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export const operationSchema = z.object({
  id: z.uuid(),
  key: z.uuid(),
  expected: z.number().int().min(0),
  kind: z.enum(["group", "activity"]),
  input: z.unknown().optional(),
  command: z.unknown().optional(),
});
/** Shared authorization and domain validation for manual, assistant and guest writes. */
export function prepareOperation(
  rows: RecordRow[],
  email: string,
  raw: Operation,
): RecordRow {
  const op = operationSchema.parse(raw);
  const row = rows.find((r) => r.document.id === op.id);
  if (
    row &&
    (!row.document.people.some((p) => p.email === email) ||
      row.kind !== op.kind)
  )
    throw new WorkspaceError("Workspace unavailable for this account.", 403);
  if ((row?.document.revision ?? 0) !== op.expected)
    throw new WorkspaceError(
      "This activity changed. Review the latest version.",
      409,
    );
  let document: Activity | SharedGroup;
  if (op.kind === "group")
    document = row
      ? changeGroup(
          row.document as SharedGroup,
          email,
          groupCommand.parse(op.command),
        )
      : createGroup(email, groupInput.parse(op.input));
  else if (row)
    document = changeActivity(
      row.document as Activity,
      email,
      activityCommand.parse(op.command),
    );
  else {
    const value = activityInput.parse(op.input);
    if (value.groupId) {
      const group = rows.find(
        (r) => r.kind === "group" && r.document.id === value.groupId,
      )?.document as SharedGroup | undefined;
      if (
        !group?.joined.includes(email) ||
        value.people.some((p) => !group.joined.includes(p.email))
      )
        throw new WorkspaceError(
          "Choose joined group members for this activity.",
          403,
        );
    }
    document = createActivity(email, value);
  }
  document.id = op.id;
  return { kind: op.kind, document } as RecordRow;
}
export function prepareBatch(
  rows: RecordRow[],
  email: string,
  operations: Operation[],
) {
  const next = structuredClone(rows),
    results: RecordRow[] = [];
  for (const op of operations) {
    const result = prepareOperation(next, email, op);
    const index = next.findIndex((r) => r.document.id === op.id);
    if (index < 0) next.push(result);
    else next[index] = result;
    results.push(result);
  }
  return { rows: next, results };
}
