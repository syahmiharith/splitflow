"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSplitFlow } from "@/lib/store";

export default function ProposalDetailShortcutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, activeGroup } = useSplitFlow();

  useEffect(() => {
    const group = state.groups.find((item) => item.proposals.some((proposal) => proposal.id === params.id)) ?? activeGroup;
    router.replace(`/groups/${group.id}/proposals/${params.id}`);
  }, [activeGroup, params.id, router, state.groups]);

  return (
    <div className="px-4 py-5 text-sm text-app-muted md:p-6" data-testid="proposal-detail-redirect">
      Opening split details...
    </div>
  );
}
