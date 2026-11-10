import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  actor,
  database,
  failure,
  PilotError,
  requireWritable,
} from "@/lib/pilot/server";
import { draftExpenseSchema } from "@/lib/activity/draft";
const identity = z.object({
  activity: z.uuid(),
  slot: z.union([z.literal("new"), z.uuid()]),
});
async function access(request: NextRequest) {
  const user = await actor(request);
  const input = identity.parse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const rows = await database(
    `activity_records?id=eq.${input.activity}&kind=eq.activity&select=members`,
  );
  if (!rows[0]?.members.includes(user.email))
    throw new PilotError("Activity unavailable.", 403);
  return {
    user,
    input,
    path: `activity_drafts?owner=eq.${user.id}&activity_id=eq.${input.activity}&slot=eq.${input.slot}`,
  };
}
export async function GET(request: NextRequest) {
  try {
    const { path } = await access(request);
    const rows = await database(`${path}&select=revision,document`);
    return NextResponse.json(
      rows.length
        ? { revision: rows[0].revision, expense: rows[0].document }
        : null,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    requireWritable();
    const { user, input } = await access(request);
    const body = z
      .object({
        expected: z.number().int().min(0),
        key: z.uuid(),
        expense: draftExpenseSchema,
      })
      .parse(await request.json());
    return NextResponse.json(
      await database("rpc/save_activity_draft", {
        method: "POST",
        body: JSON.stringify({
          p_owner: user.id,
          p_activity: input.activity,
          p_slot: input.slot,
          p_expected: body.expected,
          p_key: body.key,
          p_document: body.expense,
        }),
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    requireWritable();
    const { path } = await access(request);
    const expected = z.coerce
      .number()
      .int()
      .positive()
      .parse(request.nextUrl.searchParams.get("expected"));
    const deleted = await database(`${path}&revision=eq.${expected}`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
    if (!deleted.length)
      throw new PilotError(
        "The saved draft changed. Review it before clearing.",
        409,
      );
    return NextResponse.json({ cleared: true });
  } catch (e) {
    return failure(e);
  }
}
