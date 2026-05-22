"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSplitFlow } from "@/lib/store";

export function LegacyGroupRedirect({ target }: { target: "chat" | "proposals" | "inbox" | "overview" }) {
  const router = useRouter();
  const { activeGroup } = useSplitFlow();

  useEffect(() => {
    const suffix = target === "overview" ? "" : `/${target}`;
    router.replace(`/groups/${activeGroup.id}${suffix}`);
  }, [activeGroup.id, router, target]);

  return (
    <div className="p-6 text-sm text-app-muted" data-testid="legacy-redirect">
      Opening {activeGroup.name}...
    </div>
  );
}
