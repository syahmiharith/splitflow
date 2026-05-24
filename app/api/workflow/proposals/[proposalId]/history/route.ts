import { NextResponse } from "next/server";
import { getProposalHistory } from "@/lib/workflow/proposal-history";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId") ?? undefined;
  const history = await getProposalHistory(proposalId, groupId);

  if (!history) {
    const now = new Date().toISOString();
    return NextResponse.json({
      proposalRecord: {
        id: proposalId,
        groupId: groupId ?? "",
        currentVersionId: "",
        versionIds: [],
        createdAt: now,
        updatedAt: now
      },
      versions: [],
      artifacts: [],
      runs: []
    });
  }

  return NextResponse.json(history);
}
