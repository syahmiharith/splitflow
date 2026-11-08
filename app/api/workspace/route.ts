import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  actor,
  database,
  failure,
  requireWritable,
  PilotError,
} from "@/lib/pilot/server";
import {
  activityInput,
  groupInput,
  activityCommand,
  groupCommand,
  createActivity,
  changeActivity,
  createGroup,
  changeGroup,
  type Activity,
  type SharedGroup,
} from "@/lib/activity/model";
const inputSchema = z.object({
  id: z.uuid(),
  key: z.uuid(),
  expected: z.number().int().min(0),
  kind: z.enum(["group", "activity"]),
  input: z.unknown().optional(),
  command: z.unknown().optional(),
});
export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    const rows = await database(
      `activity_records?members=cs.${encodeURIComponent(`{"${user.email.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"}`)}&select=kind,document&order=updated_at.desc`,
    );
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    requireWritable();
    const user = await actor(request),
      input = inputSchema.parse(await request.json());
    const rows = await database(
      `activity_records?id=eq.${input.id}&select=kind,document`,
    );
    const current = rows[0]?.document as Activity | SharedGroup | undefined;
    if (current && !current.people.some((p) => p.email === user.email))
      throw new PilotError("Workspace unavailable for this account.", 403);
    const prior = await database(
      `activity_operations?actor=eq.${user.id}&key=eq.${input.key}&select=record_id,result`,
    );
    if (prior.length) {
      if (prior[0].record_id !== input.id || !current)
        throw new PilotError("Operation unavailable.", 403);
      return NextResponse.json(prior[0].result);
    }
    let next: Activity | SharedGroup;
    if (input.expected === 0) {
      if (current) throw new PilotError("This record already exists.", 409);
      if (input.kind === "group")
        next = createGroup(user.email, groupInput.parse(input.input));
      else {
        const value = activityInput.parse(input.input);
        if (value.groupId) {
          const groups = await database(
            `activity_records?id=eq.${value.groupId}&kind=eq.group&select=document`,
          );
          const group = groups[0]?.document as SharedGroup | undefined;
          if (
            !group?.joined.includes(user.email) ||
            value.people.some((p) => !group.joined.includes(p.email))
          )
            throw new PilotError(
              "Choose joined group members for this activity.",
              403,
            );
        }
        next = createActivity(user.email, value);
      }
      next.id = input.id;
    } else {
      if (!current || rows[0].kind !== input.kind)
        throw new PilotError("Workspace unavailable.", 403);
      if (current.revision !== input.expected)
        throw new PilotError(
          "This activity changed. Review the latest version before retrying.",
          409,
        );
      next =
        input.kind === "group"
          ? changeGroup(
              current as SharedGroup,
              user.email,
              groupCommand.parse(input.command),
            )
          : changeActivity(
              current as Activity,
              user.email,
              activityCommand.parse(input.command),
            );
    }
    const result = await database("rpc/commit_activity", {
      method: "POST",
      body: JSON.stringify({
        p_actor: user.id,
        p_key: input.key,
        p_id: input.id,
        p_kind: input.kind,
        p_expected: input.expected,
        p_document: next,
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return failure(error);
  }
}
