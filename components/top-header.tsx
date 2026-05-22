"use client";

import { ArrowLeft, Bell, ChevronDown, Menu, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const routeCopy: Record<string, { title: string; subtitle: string }> = {
  "/chat": { title: "AI Split Agent", subtitle: "Create, review, and track split proposals" },
  "/dashboard": { title: "Dashboard", subtitle: "Monitor active proposals and organizer risk" },
  "/proposals": { title: "Proposals", subtitle: "Review proposal states and next actions" },
  "/groups": { title: "Groups", subtitle: "Manage participant context and demo views" },
  "/analytics": { title: "Analytics", subtitle: "Understand fairness, exposure, and settlement health" },
  "/inbox": { title: "Proposal Review", subtitle: "Respond to this split proposal" }
};

export function TopHeader() {
  const pathname = usePathname();
  const copy = routeCopy[pathname] ?? routeCopy["/chat"];

  const focused = pathname === "/inbox";

  return (
    <header className="sticky top-0 z-30 grid min-h-[68px] grid-cols-[56px_minmax(0,1fr)_104px] items-center gap-2 border-b border-app-border bg-white px-4 py-3 md:flex md:min-h-[76px] md:justify-between md:gap-4 md:px-6 md:py-4 lg:px-8" data-testid="top-header">
      <div className="flex items-center md:hidden">
        {focused ? (
          <Link href="/proposals" className="grid h-11 w-11 place-items-center rounded-xl text-app-text hover:bg-slate-50" aria-label="Back to proposals">
            <ArrowLeft className="h-7 w-7" aria-hidden="true" />
          </Link>
        ) : (
          <button className="grid h-11 w-11 place-items-center rounded-xl text-app-text hover:bg-slate-50" aria-label="Open menu">
            <Menu className="h-8 w-8" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="min-w-0 text-center md:text-left">
        <h1 className="truncate text-2xl font-bold tracking-tight text-app-text">{copy.title}</h1>
        <p className="mt-1 hidden truncate text-sm text-app-muted md:block">{copy.subtitle}</p>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 md:gap-3">
        <button className="hidden h-11 items-center gap-3 rounded-lg border border-app-border bg-white px-4 text-sm font-semibold text-app-text hover:bg-slate-50 sm:flex" aria-label="Select group">
          <Users className="h-5 w-5" aria-hidden="true" />
          <span>BBQ Crew</span>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
        {!focused ? (
        <button className="relative grid h-11 w-11 place-items-center rounded-xl border border-app-border bg-white text-app-text hover:bg-slate-50" aria-label="Notifications">
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-app-red px-1 text-xs font-bold text-white">
            3
          </span>
        </button>
        ) : null}
        <button className="flex h-11 items-center gap-3 rounded-xl border border-app-border bg-white px-2.5 text-sm font-semibold text-app-text hover:bg-slate-50 md:rounded-lg" aria-label="User menu">
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-slate-200 text-[11px]">You</span>
          <span className="hidden sm:inline">You</span>
          <ChevronDown className="hidden h-4 w-4 sm:block" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
