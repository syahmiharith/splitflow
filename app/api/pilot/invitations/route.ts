import { createHash, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  actor,
  database,
  failure,
  pilotConfig,
  requireMembership,
  requireWritable,
  PilotError,
} from "@/lib/pilot/server";
const requestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("issue"),
    splitId: z.uuid(),
    email: z.email().toLowerCase(),
    key: z.uuid(),
  }),
  z.object({
    type: z.literal("redeem"),
    token: z.string().regex(/^[a-f0-9]{64}$/),
  }),
]);
export async function POST(request: NextRequest) {
  try {
    requireWritable();
    const user = await actor(request);
    const input = requestSchema.parse(await request.json());
    if (input.type === "redeem") {
      const result = await database("rpc/redeem_pilot_invitation", {
        method: "POST",
        body: JSON.stringify({
          p_hash: createHash("sha256").update(input.token).digest("hex"),
          p_user: user.id,
          p_email: user.email,
        }),
      });
      return NextResponse.json({ splitId: result });
    }
    if ((await requireMembership(input.splitId, user.id)) !== "organizer")
      throw new PilotError("Only the organizer can invite participants.", 403);
    const token = createHmac("sha256", pilotConfig().key)
      .update(JSON.stringify([user.id, input.key, input.splitId, input.email]))
      .digest("hex");
    const result = await database("rpc/issue_pilot_invitation", {
      method: "POST",
      body: JSON.stringify({
        p_split: input.splitId,
        p_issuer: user.id,
        p_email: input.email,
        p_hash: createHash("sha256").update(token).digest("hex"),
      }),
    });
    return NextResponse.json({ token, expiresAt: result });
  } catch (error) {
    return failure(error);
  }
}
