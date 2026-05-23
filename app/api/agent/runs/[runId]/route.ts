import { NextResponse } from "next/server";
import { getWorkflowRunResult } from "@/lib/workflow/workflow-service";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const result = await getWorkflowRunResult(runId);
  if (!result) {
    return NextResponse.json({ error: "Workflow run was not found." }, { status: 404 });
  }
  return NextResponse.json(result);
}
