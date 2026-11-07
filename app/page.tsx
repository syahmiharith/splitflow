import { Suspense } from "react";
import SplitWorkspace from "@/components/split-workspace";
export default function HomePage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-app-muted">Loading SplitFlow…</div>}
    >
      <SplitWorkspace />
    </Suspense>
  );
}
