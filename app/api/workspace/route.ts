import { NextRequest, NextResponse } from "next/server";
import {
  actor,
  database,
  failure,
  requireWritable,
  PilotError,
} from "@/lib/pilot/server";
import {
  operationSchema as inputSchema,
  prepareOperation,
  WorkspaceError,
} from "@/lib/activity/operations";
import type { RecordRow } from "@/lib/activity/client";
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
    return failure(
      error instanceof WorkspaceError
        ? new PilotError(error.message, error.status)
        : error,
    );
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
    const current = rows[0]?.document as RecordRow["document"] | undefined;
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
    const friendRows = await database(
      `activity_records?kind=eq.group&members=cs.${encodeURIComponent(`{"${user.email.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"}`)}&select=kind,document`,
    );
    const context: RecordRow[] = [...rows, ...friendRows.filter((r: RecordRow) => r.document.id !== input.id)];
    const groupId = (input.input as { groupId?: string } | undefined)?.groupId;
    if (input.kind === "activity" && input.expected === 0 && groupId) {
      const groups = await database(
        `activity_records?id=eq.${encodeURIComponent(groupId)}&kind=eq.group&select=kind,document`,
      );
      context.push(...groups);
    }
    const next = prepareOperation(context, user.email, input).document;
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
    return failure(
      error instanceof WorkspaceError
        ? new PilotError(error.message, error.status)
        : error,
    );
  }
}
