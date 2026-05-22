"use client";

import { CreditCard, Map, RotateCcw, Utensils } from "lucide-react";
import { useSplitFlow } from "@/lib/store";

type DemoToolbarProps = {
  compact?: boolean;
  showLoaders?: boolean;
};

export function DemoToolbar({ compact = false, showLoaders = true }: DemoToolbarProps) {
  const { loadDemo, resetDemo } = useSplitFlow();

  return (
    <div className={`flex flex-wrap gap-2 rounded-2xl border border-app-border bg-white p-2 md:rounded-lg ${compact ? "mb-4" : ""}`} data-testid="demo-toolbar">
      {showLoaders ? (
        <>
          <DemoButton icon={Utensils} label="Load BBQ Demo" onClick={() => loadDemo("bbq")} />
          <DemoButton icon={Map} label="Load Trip Demo" onClick={() => loadDemo("trip")} />
          <DemoButton icon={CreditCard} label="Load Subscription Demo" onClick={() => loadDemo("subscription")} />
        </>
      ) : null}
      <DemoButton icon={RotateCcw} label="Reset Demo Data" onClick={resetDemo} testId="reset-demo-data" />
    </div>
  );
}

function DemoButton({ icon: Icon, label, onClick, testId }: { icon: typeof Utensils; label: string; onClick: () => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-text hover:bg-slate-50"
    >
      <Icon className="h-4 w-4 text-app-blue" aria-hidden="true" />
      {label}
    </button>
  );
}
