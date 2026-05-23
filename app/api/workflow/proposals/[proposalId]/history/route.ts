import { NextResponse } from "next/server";
import { getProposalHistory } from "@/lib/workflow/proposal-history";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const { searchParams } = new URL(request.url);
  const history = await getProposalHistory(proposalId, searchParams.get("groupId") ?? undefined);

  if (!history) {
    return NextResponse.json({ error: "Proposal history was not found." }, { status: 404 });
  }

  return NextResponse.json(history);
}
