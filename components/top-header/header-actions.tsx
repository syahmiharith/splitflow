"use client";

import Link from "next/link";
import { Bell, MoreHorizontal, RotateCcw } from "lucide-react";
import { useState } from "react";

export function HeaderActions({
  activeGroupId,
  unresolvedChangeRequests,
  onResetDemo
}: {
  activeGroupId: string;
  unresolvedChangeRequests: number;
  onResetDemo: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Link
        href={`/groups/${activeGroupId}/inbox`}
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-app-border bg-white text-app-text hover:bg-slate-50"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-app-red px-1 text-xs font-bold text-white">
          {unresolvedChangeRequests}
        </span>
      </Link>
      <div className="relative">
        <button
          type="button"
          data-testid="header-actions-more"
          onClick={() => setOpen((current) => !current)}
          className="grid h-11 w-11 place-items-center rounded-xl border border-app-border bg-white text-app-text hover:bg-slate-50"
          aria-label="More actions"
          aria-expanded={open}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
        {open ? (
          <div
            className="absolute right-0 top-12 z-50 w-48 rounded-lg border border-app-border bg-white p-2 shadow-soft"
            data-testid="header-actions-menu"
          >
            <button
              type="button"
              data-testid="reset-demo-data"
              onClick={() => {
                onResetDemo();
                setOpen(false);
              }}
              className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-app-text hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4 text-app-blue" aria-hidden="true" />
              Reset demo data
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
