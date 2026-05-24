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
    <div className="h-full min-h-0 overflow-hidden" data-testid="proposal-detail-route">
      <GroupRouteSync groupId={params.groupId} />
      <div className="h-full min-h-0 min-w-0 overflow-y-auto p-6">
        <p className="text-sm text-app-muted">Split details, deterministic math, claimed payments, and settlement readiness open in the review panel.</p>
      </div>
      <WorkspaceDetailPanel fallbackProposal={proposal} />
    </div>
  );
}
