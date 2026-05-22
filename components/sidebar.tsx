"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Grid2X2, HelpCircle, Home, MessageCircle, Settings, Users, Waypoints } from "lucide-react";
import { useSplitFlow } from "@/lib/store";

export function Sidebar() {
  const pathname = usePathname();
  const { state, activeGroup } = useSplitFlow();
  const groupBase = `/groups/${activeGroup.id}`;
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: groupBase, label: "Overview", icon: Grid2X2 },
    { href: `${groupBase}/chat`, label: "Chat", icon: MessageCircle },
    { href: `${groupBase}/proposals`, label: "Proposals", icon: FileText },
    { href: `${groupBase}/inbox`, label: "Inbox", icon: Users },
    { href: `${groupBase}/settings`, label: "Settings", icon: Settings }
  ];

  return (
    <aside className="hidden min-h-screen w-[280px] shrink-0 border-r border-app-border bg-white lg:flex lg:flex-col" data-testid="sidebar">
      <div className="flex h-[92px] items-center gap-3 border-b border-app-border px-6">
        <div className="grid h-11 w-11 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-app-blue">
          <Waypoints className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-2xl font-bold tracking-tight text-app-text">SplitFlow</div>
          <div className="truncate text-xs text-app-muted">Group agreement workspace</div>
        </div>
      </div>

      <div className="border-b border-app-border px-4 py-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">Groups</div>
        <div className="space-y-1" data-testid="sidebar-group-list">
          {state.groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}/chat`}
              className={`block rounded-lg px-3 py-2 text-sm font-semibold ${group.id === activeGroup.id ? "bg-blue-50 text-app-blue" : "text-app-text hover:bg-slate-50"}`}
            >
              <span className="block truncate">{group.name}</span>
              <span className="text-xs font-normal text-app-muted">{group.members.length} members</span>
            </Link>
          ))}
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-5" aria-label="Main navigation">
        <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-app-muted">Workspace</div>
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`relative flex h-12 items-center gap-3 rounded-lg px-5 text-sm font-semibold transition ${
                active ? "bg-blue-50 text-app-blue" : "text-app-text hover:bg-slate-50"
              }`}
            >
              {active ? <span className="absolute left-0 h-8 w-1 rounded-r bg-app-blue" aria-hidden="true" /> : null}
              <Icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-6 px-3 pb-6">
        <button className="flex w-full items-center gap-3 rounded-lg border border-app-border bg-white px-5 py-3 text-left text-sm font-medium text-app-text hover:bg-slate-50">
          <HelpCircle className="h-5 w-5 text-app-muted" aria-hidden="true" />
          <span className="flex-1">Help & Support</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { activeGroup } = useSplitFlow();
  const groupBase = `/groups/${activeGroup.id}`;
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: `${groupBase}/chat`, label: "Chat", icon: MessageCircle },
    { href: `${groupBase}/proposals`, label: "Proposals", icon: FileText },
    { href: `${groupBase}/inbox`, label: "Inbox", icon: Users },
    { href: `${groupBase}/settings`, label: "Settings", icon: Settings }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-app-border bg-white px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(24,33,47,0.05)] lg:hidden" aria-label="Mobile navigation">
      {navItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium ${
              active ? "text-app-blue" : "text-app-muted"
            }`}
          >
            {active ? <span className="absolute -top-2 h-1 w-16 rounded-full bg-app-blue" aria-hidden="true" /> : null}
            <Icon className={`h-6 w-6 ${active ? "fill-app-blue/10" : ""}`} aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
