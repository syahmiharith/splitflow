"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useSplitFlow } from "@/lib/store";
import { GroupRouteSync } from "@/components/group-route-sync";
import { WorkspaceDetailPanel } from "@/components/workspace-detail-panel";

export default function GroupProposalDetailPage() {
  const params = useParams<{ groupId: string; proposalId: string }>();
  const { activeGroup, openProposalPanel } = useSplitFlow();
  const proposal = activeGroup.proposals.find((item) => item.id === params.proposalId);

  useEffect(() => {
    openProposalPanel(params.proposalId);
  }, [openProposalPanel, params.proposalId]);

  return (
    <div className="flex min-h-[calc(100vh-76px)] flex-col lg:flex-row" data-testid="proposal-detail-route">
      <GroupRouteSync groupId={params.groupId} />
      <div className="min-w-0 flex-1 p-6">
        <p className="text-sm text-app-muted">Trip Split details open in the review panel.</p>
      </div>
      <WorkspaceDetailPanel fallbackProposal={proposal} />
    </div>
  );
}
