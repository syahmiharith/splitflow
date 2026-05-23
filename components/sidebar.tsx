"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Bell, Check, ChevronDown, ChevronRight, FileText, Grid2X2, HelpCircle, Home, MessageCircle, Plus, Settings, Waypoints, X } from "lucide-react";
import { useSplitFlow } from "@/lib/store";
import type { DeviceLayoutMode } from "@/lib/use-device-profile";

export function Sidebar({ layoutMode = "unknown" }: { layoutMode?: DeviceLayoutMode }) {
  const visibilityClass = layoutMode === "desktop" ? "flex" : "hidden lg:flex";
  const canonicalTestIds = layoutMode === "desktop" || layoutMode === "unknown";

  return (
    <aside className={`${visibilityClass} min-h-screen w-[280px] shrink-0 flex-col border-r border-app-border bg-white`} data-testid="sidebar">
      <SidebarContent canonicalTestIds={canonicalTestIds} />
    </aside>
  );
}

export function MobileSidebarOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      className={`fixed inset-0 z-50 flex flex-col bg-white transition-transform duration-200 ease-out ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-hidden={!open}
      aria-label="Mobile sidebar"
      data-testid="mobile-sidebar-overlay"
    >
      {open ? <SidebarContent onClose={onClose} onNavigate={onClose} /> : null}
    </aside>
  );
}

function SidebarContent({
  onClose,
  onNavigate,
  canonicalTestIds = true
}: {
  onClose?: () => void;
  onNavigate?: () => void;
  canonicalTestIds?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, activeGroup, activeChat, selectGroup, selectChat, createChat, setCurrentUser } = useSplitFlow();
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set([activeGroup.id]));
  const dragStartY = useRef<number | null>(null);
  const groupBase = `/groups/${activeGroup.id}`;
  const handleNavigate = onNavigate ? () => window.setTimeout(onNavigate, 0) : undefined;
  const currentParticipant =
    activeGroup.members.find((participant) => participant.id === state.currentUser) ??
    activeGroup.members.find((participant) => participant.id === "you") ??
    activeGroup.members[0];
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: groupBase, label: "Overview", icon: Grid2X2 },
    { href: `${groupBase}/proposals`, label: "Proposals", icon: FileText },
    { href: `${groupBase}/inbox`, label: "Notifications", icon: Bell }
  ];
  const testId = (id: string) => (canonicalTestIds ? id : `${id}-hidden`);

  useEffect(() => {
    setExpandedGroupIds((current) => {
      if (current.has(activeGroup.id)) return current;
      const next = new Set(current);
      next.add(activeGroup.id);
      return next;
    });
  }, [activeGroup.id]);

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function openGroupChat(groupId: string, chatId: string) {
    selectGroup(groupId);
    selectChat(chatId, groupId);
    router.push(`/groups/${groupId}/chat`);
    handleNavigate?.();
  }

  function addChat(groupId: string) {
    createChat(groupId);
    router.push(`/groups/${groupId}/chat`);
    handleNavigate?.();
  }

  function onSheetPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragStartY.current = event.clientY;
  }

  function onSheetPointerUp(event: PointerEvent<HTMLDivElement>) {
    const startY = dragStartY.current;
    dragStartY.current = null;
    if (startY !== null && event.clientY - startY > 80) {
      setProfileSheetOpen(false);
    }
  }

  return (
    <>
      <div className="flex h-[92px] items-center gap-3 border-b border-app-border px-6">
        <div className="grid h-11 w-11 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-app-blue">
          <Waypoints className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-2xl font-bold tracking-tight text-app-text">SplitFlow</div>
          <div className="truncate text-xs text-app-muted">Group agreement workspace</div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto grid h-10 w-10 place-items-center rounded-lg border border-app-border text-app-muted hover:bg-slate-50"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav className="border-b border-app-border px-3 py-5" aria-label="Main navigation">
        <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-app-muted">Workspace</div>
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href === groupBase
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavigate}
              data-testid={testId(`nav-${item.label.toLowerCase()}`)}
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

      <div className="min-h-0 flex-1 overflow-y-auto border-b border-app-border px-4 py-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">Groups</div>
        <div className="space-y-1" data-testid={testId("sidebar-group-list")}>
          {state.groups.map((group) => {
            const expanded = expandedGroupIds.has(group.id);
            const groupActive = group.id === activeGroup.id;
            return (
              <div key={group.id} className="rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                    groupActive ? "bg-blue-50 text-app-blue" : "text-app-text hover:bg-slate-50"
                  }`}
                  aria-expanded={expanded}
                  data-testid={testId(`sidebar-group-${group.id}`)}
                >
                  {expanded ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{group.name}</span>
                    <span className="block text-xs font-normal text-app-muted">{group.members.length} members</span>
                  </span>
                </button>

                {expanded ? (
                  <div className="ml-5 mt-1 space-y-1 border-l border-app-border pl-2">
                    <div className="space-y-1" data-testid={testId(groupActive ? "chat-session-list" : `chat-session-list-${group.id}`)}>
                      {group.chats.map((chat) => {
                        const chatActive = groupActive && chat.id === activeChat.id;
                        return (
                          <button
                            key={chat.id}
                            type="button"
                            onClick={() => openGroupChat(group.id, chat.id)}
                            className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                              chatActive ? "bg-blue-50 text-app-blue" : "text-app-text hover:bg-slate-50"
                            }`}
                            data-testid={testId(`sidebar-chat-${chat.id}`)}
                          >
                            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => addChat(group.id)}
                      className="grid h-10 w-10 place-items-center rounded-full bg-app-blue text-white shadow-soft hover:bg-blue-700"
                      aria-label={`New chat for ${group.name}`}
                      data-testid={testId(groupActive ? "new-chat" : `new-chat-${group.id}`)}
                    >
                      <Plus className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6 px-3 pb-6">
        <button
          type="button"
          onClick={() => setProfileSheetOpen(true)}
          className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-app-border bg-white text-sm font-bold text-app-text shadow-[0_1px_2px_rgba(24,33,47,0.04)] hover:bg-slate-50"
          data-testid={testId("sidebar-profile-button")}
          aria-label="Open account settings"
        >
          <span className="grid h-full w-full place-items-center rounded-full bg-slate-200">
            {currentParticipant?.name.slice(0, 2) ?? "You"}
          </span>
        </button>
        <button className="flex w-full items-center gap-3 rounded-lg border border-app-border bg-white px-5 py-3 text-left text-sm font-medium text-app-text hover:bg-slate-50">
          <HelpCircle className="h-5 w-5 text-app-muted" aria-hidden="true" />
          <span className="flex-1">Help & Support</span>
        </button>
      </div>

      <div
        className={`fixed inset-0 z-[60] flex items-end transition-colors duration-200 ${
          profileSheetOpen ? "pointer-events-auto bg-slate-900/30" : "pointer-events-none bg-slate-900/0"
        }`}
        data-testid={testId("profile-sheet-backdrop")}
        aria-hidden={!profileSheetOpen}
      >
        <div
          className={`max-h-[86vh] w-full overflow-y-auto rounded-t-2xl border border-app-border bg-white p-4 shadow-soft transition-transform duration-200 ease-out ${
            profileSheetOpen ? "translate-y-0" : "translate-y-full"
          }`}
          data-testid={testId("profile-bottom-sheet")}
          onPointerDown={onSheetPointerDown}
          onPointerUp={onSheetPointerUp}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" aria-hidden="true" />
          <div className="flex items-start gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-200 text-sm font-bold text-app-text">
              {currentParticipant?.name.slice(0, 2) ?? "You"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">Account</div>
              <h2 className="mt-1 truncate text-lg font-bold">{currentParticipant?.name ?? "You"}</h2>
              <p className="mt-1 text-sm text-app-muted">Demo profile controls for reviewer testing.</p>
            </div>
            <button
              type="button"
              onClick={() => setProfileSheetOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-app-border text-app-muted hover:bg-slate-50"
              aria-label="Close profile sheet"
              data-testid={testId("profile-sheet-close")}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <Link
            href={`${groupBase}/settings`}
            onClick={() => {
              setProfileSheetOpen(false);
              handleNavigate?.();
            }}
            className="mt-4 flex min-h-12 items-center gap-3 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-text hover:bg-slate-50"
            data-testid={testId("profile-settings-link")}
          >
            <Settings className="h-5 w-5 text-app-blue" aria-hidden="true" />
            Group settings
          </Link>

          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">Switch demo user</div>
            <div className="mt-2 space-y-2">
              {activeGroup.members.map((participant) => {
                const active = participant.id === state.currentUser;
                return (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => setCurrentUser(participant.id)}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm font-semibold ${
                      active ? "border-blue-200 bg-blue-50 text-app-blue" : "border-app-border bg-white text-app-text hover:bg-slate-50"
                    }`}
                    data-testid={testId(`profile-switch-${participant.id}`)}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-[11px] text-app-text">
                      {participant.name.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{participant.name}</span>
                    {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
