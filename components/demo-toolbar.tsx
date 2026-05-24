"use client";

import { CreditCard, Map, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useSplitFlow } from "@/lib/store";

type DemoToolbarProps = {
  compact?: boolean;
  showLoaders?: boolean;
};

export function DemoToolbar({ compact = false, showLoaders = true }: DemoToolbarProps) {
  const { loadDemo, resetDemo } = useSplitFlow();
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <div className={`flex flex-wrap gap-2 rounded-2xl border border-app-border bg-white p-2 md:rounded-lg ${compact ? "mb-4" : ""}`} data-testid="demo-toolbar">
      {showLoaders ? (
        <>
          <DemoButton icon={Map} label="Load Han River BBQ" onClick={() => loadDemo("trip")} />
          <DemoButton icon={CreditCard} label="Load Subscription Proposal" onClick={() => loadDemo("subscription")} />
        </>
      ) : null}
      <DemoButton
        icon={RotateCcw}
        label={confirmingReset ? "Confirm Reset" : "Reset Demo Data"}
        onClick={() => {
          if (!confirmingReset) {
            setConfirmingReset(true);
            return;
          }
          resetDemo();
          setConfirmingReset(false);
        }}
        testId="reset-demo-data"
      />
    </div>
  );
}

function DemoButton({ icon: Icon, label, onClick, testId }: { icon: typeof Map; label: string; onClick: () => void; testId?: string }) {
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
