"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronRight, FileText, Grid2X2, HelpCircle, MessageCircle, Users, Waypoints } from "lucide-react";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/dashboard", label: "Dashboard", icon: Grid2X2 },
  { href: "/proposals", label: "Proposals", icon: FileText },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-[260px] shrink-0 border-r border-app-border bg-white lg:flex lg:flex-col" data-testid="sidebar">
      <div className="flex h-[92px] items-center gap-3 border-b border-app-border px-6">
        <div className="grid h-11 w-11 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-app-blue">
          <Waypoints className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-2xl font-bold tracking-tight text-app-text">SplitFlow</div>
          <div className="truncate text-xs text-app-muted">Smart splits. Fair every time.</div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-5" aria-label="Main navigation">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/chat" && pathname.startsWith(item.href));
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
          <ChevronRight className="h-4 w-4 text-app-muted" aria-hidden="true" />
        </button>
        <div className="px-5 text-xs leading-5 text-app-muted">
          <div>© 2025 SplitFlow, Inc.</div>
          <div>All rights reserved.</div>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  if (pathname === "/inbox") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-app-border bg-white px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(24,33,47,0.05)] lg:hidden" aria-label="Mobile navigation">
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== "/chat" && pathname.startsWith(item.href));
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
