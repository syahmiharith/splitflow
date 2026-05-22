"use client";

import { useEffect } from "react";
import { useSplitFlow } from "@/lib/store";

export function GroupRouteSync({ groupId }: { groupId: string }) {
  const { state, selectGroup } = useSplitFlow();

  useEffect(() => {
    if (state.selectedGroupId !== groupId && state.groups.some((group) => group.id === groupId)) {
      selectGroup(groupId);
    }
  }, [groupId, selectGroup, state.groups, state.selectedGroupId]);

  return null;
}
