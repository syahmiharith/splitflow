"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { Bell, Check, FileText, Grid2X2, Home, MessageCircle, Plus, Settings, Waypoints, X } from "lucide-react";
import type { ChatSession, SplitFlowGroup } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type TestId = (id: string) => string;
type Participant = SplitFlowGroup["members"][number];

export function SidebarBrand({ onClose }: { onClose?: () => void }) {
  return (
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
  );
}

export function WorkspaceNav({
  pathname,
  groupBase,
  onNavigate,
  testId
}: {
  pathname: string;
  groupBase: string;
  onNavigate?: () => void;
  testId: TestId;
}) {
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: groupBase, label: "Overview", icon: Grid2X2 },
    { href: `${groupBase}/proposals`, label: "Proposals", icon: FileText },
    { href: `${groupBase}/inbox`, label: "Notifications", icon: Bell }
  ];

  return (
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
            onClick={onNavigate}
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
  );
}

export function GroupAccordion({
  groups,
  activeGroupId,
  activeChatId,
  expandedGroupIds,
  onExpandedChange,
  onOpenChat,
  testId
}: {
  groups: SplitFlowGroup[];
  activeGroupId: string;
  activeChatId: string;
  expandedGroupIds: Set<string>;
  onExpandedChange: (ids: Set<string>) => void;
  onOpenChat: (groupId: string, chatId: string) => void;
  testId: TestId;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto border-b border-app-border px-4 py-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">Groups</div>
      <Accordion
        type="multiple"
        value={Array.from(expandedGroupIds)}
        onValueChange={(values) => onExpandedChange(new Set(values))}
        className="space-y-1"
        data-testid={testId("sidebar-group-list")}
      >
        {groups.map((group) => {
          const groupActive = group.id === activeGroupId;
          return (
            <AccordionItem key={group.id} value={group.id} className="rounded-lg border-b-0">
              <AccordionTrigger
                className="min-h-12 rounded-lg px-3 py-2 text-sm font-semibold text-app-text hover:bg-slate-50 hover:no-underline"
                data-testid={testId(`sidebar-group-${group.id}`)}
                aria-label={`Toggle ${group.name} chats`}
              >
                <span className="min-w-0 flex-1 pr-2">
                  <span className="block truncate">{group.name}</span>
                  <span className="block text-xs font-normal text-app-muted">{group.members.length} members</span>
                </span>
              </AccordionTrigger>

              <AccordionContent className="pb-1 pt-1">
                <div className="ml-5 space-y-1 border-l border-app-border pl-2">
                  <ChatSessionList
                    chats={group.chats}
                    groupId={group.id}
                    active={groupActive}
                    activeChatId={activeChatId}
                    onOpenChat={onOpenChat}
                    testId={testId}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

export function ChatSessionList({
  chats,
  groupId,
  active,
  activeChatId,
  onOpenChat,
  testId
}: {
  chats: ChatSession[];
  groupId: string;
  active: boolean;
  activeChatId: string;
  onOpenChat: (groupId: string, chatId: string) => void;
  testId: TestId;
}) {
  return (
    <div className="space-y-1" data-testid={testId(active ? "chat-session-list" : `chat-session-list-${groupId}`)}>
      {chats.map((chat) => {
        const chatActive = active && chat.id === activeChatId;
        return (
          <button
            key={chat.id}
            type="button"
            onClick={() => onOpenChat(groupId, chat.id)}
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
  );
}

export function SidebarFooter({
  activeGroup,
  currentParticipant,
  currentParticipantRole,
  groupBase,
  onAddChat,
  onOpenProfile,
  onNavigate,
  testId
}: {
  activeGroup: SplitFlowGroup;
  currentParticipant?: Participant;
  currentParticipantRole: string;
  groupBase: string;
  onAddChat: () => void;
  onOpenProfile: () => void;
  onNavigate?: () => void;
  testId: TestId;
}) {
  return (
    <div className="space-y-3 border-t border-app-border px-3 py-4">
      <button
        type="button"
        onClick={onAddChat}
        className="ml-auto grid h-11 w-11 place-items-center rounded-full bg-app-blue text-white shadow-soft hover:bg-blue-700"
        aria-label={`New chat for ${activeGroup.name}`}
        data-testid={testId("new-chat")}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-1.5">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
          data-testid={testId("sidebar-profile-button")}
          aria-label="Open account settings"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-200 text-xs font-bold text-app-text">
            {currentParticipant?.name.slice(0, 2) ?? "You"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-app-text">{currentParticipant?.name ?? "You"}</span>
            <span className="block truncate text-xs text-app-muted">{currentParticipantRole}</span>
          </span>
        </button>
        <Link
          href={`${groupBase}/settings`}
          onClick={onNavigate}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-app-muted hover:bg-slate-50 hover:text-app-text"
          aria-label="Group settings"
          data-testid={testId("profile-settings-link")}
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export function ProfileSheet({
  open,
  activeGroup,
  currentParticipant,
  groupBase,
  currentUser,
  onClose,
  onNavigate,
  onPointerDown,
  onPointerUp,
  onSetCurrentUser,
  testId
}: {
  open: boolean;
  activeGroup: SplitFlowGroup;
  currentParticipant?: Participant;
  groupBase: string;
  currentUser: string;
  onClose: () => void;
  onNavigate?: () => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onSetCurrentUser: (userId: string) => void;
  testId: TestId;
}) {
  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end transition-colors duration-200 ${
        open ? "pointer-events-auto bg-slate-900/30" : "pointer-events-none bg-slate-900/0"
      }`}
      data-testid={testId("profile-sheet-backdrop")}
      aria-hidden={!open}
    >
      <div
        className={`max-h-[86vh] w-full overflow-y-auto rounded-t-2xl border border-app-border bg-white p-4 shadow-soft transition-transform duration-200 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        data-testid={testId("profile-bottom-sheet")}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
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
            onClick={onClose}
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
            onClose();
            onNavigate?.();
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
              const active = participant.id === currentUser;
              return (
                <button
                  key={participant.id}
                  type="button"
                  onClick={() => onSetCurrentUser(participant.id)}
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
  );
}
