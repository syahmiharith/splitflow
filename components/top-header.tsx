"use client";

import Link from "next/link";
import { Bell, ChevronDown, Menu, Plus, RotateCcw, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { deriveGlobalAnalytics } from "@/lib/analytics";
import { useSplitFlow } from "@/lib/store";
import type { DeviceLayoutMode } from "@/lib/use-device-profile";

const routeCopy: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Home", subtitle: "Global overview across groups" },
  "/agent-lab": { title: "Agent Lab", subtitle: "Developer workflow diagnostics" }
};

function routeTitle(pathname: string) {
  if (routeCopy[pathname]) return routeCopy[pathname];
  if (/\/groups\/[^/]+\/proposals/.test(pathname)) return { title: "Group Proposals", subtitle: "Review proposal records and settlement actions" };
  if (/\/groups\/[^/]+\/inbox/.test(pathname)) return { title: "Notifications", subtitle: "Review participant updates and responses" };
  if (/\/groups\/[^/]+\/settings/.test(pathname)) return { title: "Group Settings", subtitle: "Manage members and context" };
  if (/\/groups\/[^/]+/.test(pathname)) return { title: "Group Overview", subtitle: "Group-scoped analytics and activity" };
  return { title: "Home", subtitle: "Global overview across groups" };
}

export function TopHeader({ layoutMode = "unknown", onMenuClick }: { layoutMode?: DeviceLayoutMode; onMenuClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, activeGroup, activeChat, selectGroup, createGroup, resetDemo } = useSplitFlow();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const isChatRoute = /\/groups\/[^/]+\/chat/.test(pathname);
  const copy = isChatRoute ? { title: activeChat.title, subtitle: activeGroup.name } : routeTitle(pathname);
  const groupRoute = pathname.startsWith("/groups/");
  const globalSummary = deriveGlobalAnalytics(state.groups);
  const menuVisibilityClass = layoutMode === "desktop" ? "hidden" : layoutMode === "unknown" ? "flex md:hidden" : "flex";

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const groupId = createGroup({
      name: trimmed,
      description,
      members: ["Syahmi", "Ali", "Sarah"]
    });
    setName("");
    setDescription("");
    setCreating(false);
    setOpen(false);
    router.push(`/groups/${groupId}/chat`);
  }

  return (
    <header className="sticky top-0 z-30 grid min-h-[68px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 border-b border-app-border bg-white px-4 py-3 md:flex md:min-h-[76px] md:justify-between md:gap-4 md:px-6 md:py-4 lg:px-8" data-testid="top-header">
      <div className={`${menuVisibilityClass} items-center`}>
        <button
          type="button"
          onClick={onMenuClick}
          className="grid h-11 w-11 place-items-center rounded-xl text-app-text hover:bg-slate-50"
          aria-label="Open menu"
          data-testid="mobile-sidebar-open"
        >
          <Menu className="h-8 w-8" aria-hidden="true" />
        </button>
      </div>

      <div className="min-w-0 text-center md:text-left">
        <h1 className="truncate text-lg font-bold tracking-tight text-app-text sm:text-xl md:text-2xl">{copy.title}</h1>
        <p className="mt-1 hidden truncate text-sm text-app-muted md:block">{copy.subtitle}</p>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 md:gap-3">
        <div className="relative hidden md:block">
          <button
            type="button"
            data-testid="group-switcher"
            onClick={() => setOpen((value) => !value)}
            className={`flex h-11 max-w-[140px] items-center gap-2 rounded-lg border px-3 text-sm font-semibold hover:bg-slate-50 sm:max-w-[220px] sm:gap-3 sm:px-4 ${groupRoute ? "border-blue-200 bg-blue-50 text-app-blue" : "border-app-border bg-white text-app-text"}`}
            aria-label="Select group"
          >
            <Users className="h-5 w-5" aria-hidden="true" />
            <span className="min-w-0 truncate">{activeGroup?.name ?? "Create group"}</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          {open ? (
            <div className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-app-border bg-white p-2 shadow-soft" data-testid="group-switcher-menu">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
                Current group: {activeGroup?.name ?? "No group selected"}
              </div>
              {state.groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    selectGroup(group.id);
                    setOpen(false);
                    router.push(`/groups/${group.id}/chat`);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 ${group.id === activeGroup.id ? "text-app-blue" : "text-app-text"}`}
                >
                  {group.name}
                  <span className="text-xs text-app-muted">{group.members.length}</span>
                </button>
              ))}
              <div className="my-2 border-t border-app-border" />
              <button
                type="button"
                data-testid="create-group-open"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-app-blue hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create new group
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          data-testid="reset-demo-data"
          onClick={resetDemo}
          className="grid h-11 w-11 place-items-center rounded-xl border border-app-border bg-white text-app-text hover:bg-slate-50"
          aria-label="Reset demo data"
        >
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link href={`/groups/${activeGroup.id}/inbox`} className="relative grid h-11 w-11 place-items-center rounded-xl border border-app-border bg-white text-app-text hover:bg-slate-50" aria-label="Notifications">
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-app-red px-1 text-xs font-bold text-white">
            {globalSummary.unresolvedChangeRequests}
          </span>
        </Link>
      </div>

      {creating ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 px-4">
          <form onSubmit={onCreate} className="w-full max-w-md rounded-lg border border-app-border bg-white p-5 shadow-soft" data-testid="create-group-modal">
            <h2 className="text-lg font-bold">Create group</h2>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-app-muted">Group name</span>
              <input data-testid="create-group-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-app-border px-3 outline-none focus:border-app-blue" />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-semibold text-app-muted">Context</span>
              <textarea data-testid="create-group-description" value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-app-border px-3 py-2 outline-none focus:border-app-blue" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="h-10 rounded-lg border border-app-border px-3 text-sm font-semibold">Cancel</button>
              <button data-testid="create-group-submit" type="submit" className="h-10 rounded-lg bg-app-blue px-3 text-sm font-semibold text-white">Create group</button>
            </div>
          </form>
        </div>
      ) : null}
    </header>
  );
}
