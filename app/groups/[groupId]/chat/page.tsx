"use client";

import { useParams } from "next/navigation";
import { ChatWorkspace } from "@/components/chat-workspace";
import { GroupRouteSync } from "@/components/group-route-sync";

export default function GroupChatPage() {
  const params = useParams<{ groupId: string }>();

  return (
    <>
      <GroupRouteSync groupId={params.groupId} />
      <ChatWorkspace />
    </>
  );
}
