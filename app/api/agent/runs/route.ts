import { NextResponse } from "next/server";
import { z } from "zod";
import { runWorkflow } from "@/lib/workflow/workflow-service";

export const runtime = "nodejs";

const requestSchema = z.object({
  runId: z.string().min(1).optional(),
  groupId: z.string().min(1),
  chatId: z.string().min(1),
  message: z.string().min(1).max(4000),
  sourceMessageId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1)
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow run request." }, { status: 400 });
  }

  try {
    const result = await runWorkflow(parsed.data);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Workflow run failed safely." }, { status: 500 });
  }
}
