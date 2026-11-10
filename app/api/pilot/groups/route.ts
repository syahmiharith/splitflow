import { NextRequest, NextResponse } from "next/server";
import {
  actor,
  database,
  failure,
  PilotError,
  requireWritable,
} from "@/lib/pilot/server";
import { groupInput, type SavedGroup } from "@/lib/pilot/groups";
export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    const rows = await database(
      `pilot_groups?owner=eq.${user.id}&select=document&order=updated_at.desc&limit=100`,
    );
    return NextResponse.json(
      rows.map((r: { document: SavedGroup }) => r.document),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    requireWritable();
    const user = await actor(request);
    const input = groupInput.parse(await request.json());
    if (!input.people.some((p) => p.email === user.email))
      throw new PilotError("Include yourself in the group.");
    const next: SavedGroup = {
      id: input.id,
      revision: input.expected + 1,
      name: input.name,
      people: input.people,
    };
    return NextResponse.json(
      await database("rpc/save_pilot_group", {
        method: "POST",
        body: JSON.stringify({
          p_owner: user.id,
          p_key: input.key,
          p_expected: input.expected,
          p_document: next,
        }),
      }),
    );
  } catch (error) {
    if (error instanceof PilotError && error.status === 409)
      return failure(
        new PilotError(
          "This group changed. Review the latest group before saving your retained edit.",
          409,
        ),
      );
    if (error instanceof PilotError && error.status === 403)
      return failure(
        new PilotError("Group unavailable for this account.", 403),
      );
    return failure(error);
  }
}
