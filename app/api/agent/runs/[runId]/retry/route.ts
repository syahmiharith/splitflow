import { NextResponse } from "next/server";
import { retryWorkflow } from "@/lib/workflow/workflow-service";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  try {
    const result = await retryWorkflow(runId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Workflow run cannot be retried." }, { status: 400 });
  }
}
