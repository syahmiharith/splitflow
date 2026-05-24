"use client";

import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { deriveGlobalAnalytics } from "@/lib/analytics";
import { useSplitFlow } from "@/lib/store";
import type { DeviceLayoutMode } from "@/lib/use-device-profile";
import { CreateGroupModal } from "@/components/top-header/create-group-modal";
import { GroupSwitcher } from "@/components/top-header/group-switcher";
import { HeaderActions } from "@/components/top-header/header-actions";
import { MobileMenuButton } from "@/components/top-header/mobile-menu-button";
import { routeTitle } from "@/components/top-header/route-title";

export function TopHeader({ layoutMode = "unknown", onMenuClick }: { layoutMode?: DeviceLayoutMode; onMenuClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, activeGroup, activeChat, selectGroup, createGroup, resetDemo } = useSplitFlow();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState("Syahmi, Ali, Sarah, Daniel, Mira, Hakim, Adam, Minji");
  const [organizer, setOrganizer] = useState("Syahmi");
  const [currency, setCurrency] = useState("KRW");
  const [starterPrompt, setStarterPrompt] = useState("");
  const isChatRoute = /\/groups\/[^/]+\/chat/.test(pathname);
  const copy = isChatRoute ? { title: activeChat.title, subtitle: activeGroup.name } : routeTitle(pathname);
  const groupRoute = pathname.startsWith("/groups/");
  const globalSummary = deriveGlobalAnalytics(state.groups);

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const groupId = createGroup({
      name: trimmed,
      description,
      members: parseMembers(members, organizer)
    });
    setName("");
    setDescription("");
    setMembers("Syahmi, Ali, Sarah, Daniel, Mira, Hakim, Adam, Minji");
    setOrganizer("Syahmi");
    setCurrency("KRW");
    setStarterPrompt("");
    setCreating(false);
    setOpen(false);
    router.push(`/groups/${groupId}/chat`);
  }

  function selectGroupFromSwitcher(groupId: string) {
    selectGroup(groupId);
    setOpen(false);
    router.push(`/groups/${groupId}/chat`);
  }

  return (
    <header className="sticky top-0 z-30 grid min-h-[68px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 border-b border-app-border bg-white px-4 py-3 md:flex md:min-h-[76px] md:justify-between md:gap-4 md:px-6 md:py-4 lg:px-8" data-testid="top-header">
      <MobileMenuButton layoutMode={layoutMode} onMenuClick={onMenuClick} />

      <div className="min-w-0 text-center md:text-left">
        <h1 className="truncate text-lg font-bold tracking-tight text-app-text sm:text-xl md:text-2xl">{copy.title}</h1>
        <p className="mt-1 hidden truncate text-sm text-app-muted md:block">{copy.subtitle}</p>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 md:gap-3">
        <GroupSwitcher
          groups={state.groups}
          activeGroup={activeGroup}
          groupRoute={groupRoute}
          open={open}
          onToggle={() => setOpen((value) => !value)}
          onSelectGroup={selectGroupFromSwitcher}
          onCreateClick={() => setCreating(true)}
        />
        <HeaderActions
          activeGroupId={activeGroup.id}
          unresolvedChangeRequests={globalSummary.unresolvedChangeRequests}
          onResetDemo={resetDemo}
        />
      </div>

      {creating ? (
        <CreateGroupModal
          name={name}
          description={description}
          members={members}
          organizer={organizer}
          currency={currency}
          starterPrompt={starterPrompt}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onMembersChange={setMembers}
          onOrganizerChange={setOrganizer}
          onCurrencyChange={setCurrency}
          onStarterPromptChange={setStarterPrompt}
          onCancel={() => setCreating(false)}
          onSubmit={onCreate}
        />
      ) : null}
    </header>
  );
}

function parseMembers(value: string, organizer: string): string[] {
  const names = value.split(",").map((item) => item.trim()).filter(Boolean);
  const organizerName = organizer.trim() || names[0] || "Syahmi";
  return [organizerName, ...names.filter((name) => name.toLowerCase() !== organizerName.toLowerCase())];
}
