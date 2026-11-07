import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  actor,
  database,
  failure,
  requireMembership,
} from "@/lib/pilot/server";
const feedbackSchema = z.object({
  id: z.uuid(),
  splitId: z.uuid().optional(),
  expected: z.string().trim().min(1).max(1000),
  actual: z.string().trim().min(1).max(1000),
});
export async function POST(request: NextRequest) {
  try {
    const user = await actor(request);
    const input = feedbackSchema.parse(await request.json());
    if (input.splitId) await requireMembership(input.splitId, user.id);
    await database("pilot_feedback", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify({
        id: input.id,
        user_id: user.id,
        split_id: input.splitId ?? null,
        expected: input.expected,
        actual: input.actual,
        app_version: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      }),
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
