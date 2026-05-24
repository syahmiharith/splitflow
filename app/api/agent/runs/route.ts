import { NextResponse } from "next/server";
import { z } from "zod";
import { createWorkflowRun, executeWorkflowRun } from "@/lib/workflow/workflow-service";
import { getWorkflowQueue } from "@/lib/workflow/workflow-queue";

export const runtime = "nodejs";

const requestSchema = z.object({
  runId: z.string().min(1).optional(),
  groupId: z.string().min(1),
  chatId: z.string().min(1),
  message: z.string().min(1).max(4000),
  sourceMessageId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1)
});

function shouldExecuteWorkflowInline(): boolean {
  return process.env.VERCEL === "1" || process.env.SPLITFLOW_WORKFLOW_EXECUTION_MODE === "inline";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow run request." }, { status: 400 });
  }

  try {
    const created = await createWorkflowRun(parsed.data);
    if (shouldExecuteWorkflowInline()) {
      return NextResponse.json(await executeWorkflowRun(created.run.id));
    }
    getWorkflowQueue().enqueueRun(created.run.id);
    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: "Workflow run failed safely." }, { status: 500 });
  }
}
