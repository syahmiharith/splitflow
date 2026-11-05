import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  actor,
  database,
  failure,
  requireMembership,
  PilotError,
} from "@/lib/pilot/server";
const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started"), id: z.uuid() }),
  z.object({ type: z.literal("ai_used"), id: z.uuid() }),
  z.object({ type: z.literal("published"), id: z.uuid(), splitId: z.uuid() }),
]);
export async function POST(request: NextRequest) {
  try {
    const user = await actor(request);
    const input = schema.parse(await request.json());
    if (input.type === "started") {
      await database("pilot_creation_measurements", {
        method: "POST",
        headers: {
          Prefer: "return=representation,resolution=ignore-duplicates",
        },
        body: JSON.stringify({ id: input.id, user_id: user.id }),
      });
    } else {
      if (
        input.type === "published" &&
        (await requireMembership(input.splitId, user.id)) !== "organizer"
      )
        throw new PilotError("Organizer access required.", 403);
      const filter = `user_id=eq.${user.id}&id=eq.${input.id}${input.type === "published" ? "&published_at=is.null" : ""}`;
      await database(`pilot_creation_measurements?${filter}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(
          input.type === "published"
            ? {
                split_id: input.splitId,
                published_at: new Date().toISOString(),
              }
            : { used_ai: true },
        ),
      });
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
