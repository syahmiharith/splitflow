import { NextResponse } from "next/server";
import { z } from "zod";
import { applyWorkflowAction } from "@/lib/workflow/workflow-service";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("send_proposal"),
    groupId: z.string().min(1),
    chatId: z.string().min(1),
    proposalId: z.string().min(1),
    idempotencyKey: z.string().min(1)
  }),
  z.object({
    type: z.literal("participant_response"),
    groupId: z.string().min(1),
    chatId: z.string().min(1),
    proposalId: z.string().min(1),
    participantId: z.string().min(1),
    status: z.enum(["accepted", "opted_out", "requested_changes"]),
    note: z.string().optional(),
    idempotencyKey: z.string().min(1)
  }),
  z.object({
    type: z.literal("accept_change"),
    groupId: z.string().min(1),
    chatId: z.string().min(1),
    proposalId: z.string().min(1),
    idempotencyKey: z.string().min(1)
  }),
  z.object({
    type: z.literal("mark_paid"),
    groupId: z.string().min(1),
    chatId: z.string().min(1),
    proposalId: z.string().min(1),
    participantId: z.string().min(1),
    idempotencyKey: z.string().min(1)
  }),
  z.object({
    type: z.literal("mark_settled"),
    groupId: z.string().min(1),
    chatId: z.string().min(1),
    proposalId: z.string().min(1),
    idempotencyKey: z.string().min(1)
  })
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow action request." }, { status: 400 });
  }
  try {
    return NextResponse.json(await applyWorkflowAction(parsed.data));
  } catch {
    return NextResponse.json({ error: "Workflow action failed safely." }, { status: 500 });
  }
}
