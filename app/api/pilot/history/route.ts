import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  actor,
  database,
  failure,
  requireMembership,
} from "@/lib/pilot/server";
export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    const id = z.uuid().parse(request.nextUrl.searchParams.get("split"));
    await requireMembership(id, user.id);
    const rows = await database(
      `pilot_revisions?split_id=eq.${id}&select=revision,document,created_at&order=revision.desc&limit=100`,
    );
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
