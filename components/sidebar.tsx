"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useSplitFlow } from "@/lib/store";
import type { DeviceLayoutMode } from "@/lib/use-device-profile";
import {
  GroupAccordion,
  ProfileSheet,
  SidebarBrand,
  SidebarFooter,
  WorkspaceNav
} from "@/components/sidebar/sidebar-parts";

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
  const currentParticipantRole = currentParticipant?.id === "you" ? "Admin" : "Member";
  const testId = (id: string) => (canonicalTestIds ? id : `${id}-hidden`);

  useEffect(() => {
    setExpandedGroupIds((current) => {
      if (current.has(activeGroup.id)) return current;
      const next = new Set(current);
      next.add(activeGroup.id);
      return next;
    });
  }, [activeGroup.id]);

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
      <SidebarBrand onClose={onClose} />
      <WorkspaceNav pathname={pathname} groupBase={groupBase} onNavigate={handleNavigate} testId={testId} />
      <GroupAccordion
        groups={state.groups}
        activeGroupId={activeGroup.id}
        activeChatId={activeChat.id}
        expandedGroupIds={expandedGroupIds}
        onExpandedChange={setExpandedGroupIds}
        onOpenChat={openGroupChat}
        testId={testId}
      />
      <SidebarFooter
        activeGroup={activeGroup}
        currentParticipant={currentParticipant}
        currentParticipantRole={currentParticipantRole}
        groupBase={groupBase}
        onAddChat={() => addChat(activeGroup.id)}
        onOpenProfile={() => setProfileSheetOpen(true)}
        onNavigate={handleNavigate}
        testId={testId}
      />
      <ProfileSheet
        open={profileSheetOpen}
        activeGroup={activeGroup}
        currentParticipant={currentParticipant}
        groupBase={groupBase}
        currentUser={state.currentUser}
        onClose={() => setProfileSheetOpen(false)}
        onNavigate={handleNavigate}
        onPointerDown={onSheetPointerDown}
        onPointerUp={onSheetPointerUp}
        onSetCurrentUser={setCurrentUser}
        testId={testId}
      />
    </>
  );
}
