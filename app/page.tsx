"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ActivityWorkspace from "@/components/activity/workspace";
import SplitWorkspace from "@/components/split-workspace";
function Entry() {
  const search = useSearchParams();
  const [invitation, setInvitation] = useState(false);
  useEffect(() => {
    setInvitation(location.hash.startsWith("#invite="));
  }, []);
  return invitation ||
    search.has("view") ||
    search.has("legacy") ||
    search.has("split") ||
    search.has("conversation") ? (
    <SplitWorkspace />
  ) : (
    <ActivityWorkspace />
  );
}
export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8">Loading SplitFlow…</div>}>
      <Entry />
    </Suspense>
  );
}
