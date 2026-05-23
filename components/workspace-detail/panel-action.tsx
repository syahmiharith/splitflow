"use client";

import type { LucideIcon } from "lucide-react";

export function PanelAction({
  icon: Icon,
  label,
  onClick,
  testId,
  primary = false
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  testId: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${
        primary ? "bg-app-blue text-white hover:bg-blue-700" : "border border-app-border bg-white text-app-text hover:bg-slate-50"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
