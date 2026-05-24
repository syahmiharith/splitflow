"use client";

import Link from "next/link";
import { BarChart3, FileText, Home, MessageCircle, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSplitFlow } from "@/lib/store";

const items = [
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "proposals", label: "Proposals", icon: FileText },
  { key: "groups", label: "Groups", icon: Users },
  { key: "analytics", label: "Analytics", icon: BarChart3 }
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { activeGroup } = useSplitFlow();
  const groupBase = `/groups/${activeGroup.id}`;

  function hrefFor(key: (typeof items)[number]["key"]) {
    if (key === "chat") return `${groupBase}/chat`;
    if (key === "proposals") return `${groupBase}/proposals`;
    if (key === "groups") return "/groups";
    if (key === "analytics") return "/analytics";
    return "/";
  }

  function isActive(key: (typeof items)[number]["key"], href: string) {
    if (key === "dashboard") return pathname === "/" || pathname === "/dashboard";
    if (key === "groups") return pathname === "/groups";
    if (key === "analytics") return pathname === "/analytics";
    if (key === "chat") return pathname === href || pathname === "/chat";
    if (key === "proposals") return pathname === href || pathname.startsWith(`${href}/`) || pathname === "/proposals";
    return false;
  }

  return (
    <nav
      className="grid h-[72px] shrink-0 grid-cols-5 border-t border-app-border bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_14px_rgba(24,33,47,0.06)] md:hidden"
      aria-label="Primary navigation"
      data-testid="bottom-nav"
    >
      {items.map((item) => {
        const href = hrefFor(item.key);
        const active = isActive(item.key, href);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={href}
            aria-current={active ? "page" : undefined}
            data-testid={`bottom-nav-${item.key}`}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold ${
              active ? "text-app-blue" : "text-app-muted"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
