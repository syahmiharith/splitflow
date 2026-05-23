"use client";

import { ChevronDown, Plus, Users } from "lucide-react";
import type { SplitFlowGroup } from "@/lib/types";

type GroupSwitcherProps = {
  groups: SplitFlowGroup[];
  activeGroup?: SplitFlowGroup;
  groupRoute: boolean;
  open: boolean;
  onToggle: () => void;
  onSelectGroup: (groupId: string) => void;
  onCreateClick: () => void;
};

export function GroupSwitcher({
  groups,
  activeGroup,
  groupRoute,
  open,
  onToggle,
  onSelectGroup,
  onCreateClick
}: GroupSwitcherProps) {
  return (
    <div className="relative hidden md:block">
      <button
        type="button"
        data-testid="group-switcher"
        onClick={onToggle}
        className={`flex h-11 max-w-[140px] items-center gap-2 rounded-lg border px-3 text-sm font-semibold hover:bg-slate-50 sm:max-w-[220px] sm:gap-3 sm:px-4 ${
          groupRoute ? "border-blue-200 bg-blue-50 text-app-blue" : "border-app-border bg-white text-app-text"
        }`}
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
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              data-testid={`group-switcher-option-${group.id}`}
              onClick={() => onSelectGroup(group.id)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 ${
                group.id === activeGroup?.id ? "text-app-blue" : "text-app-text"
              }`}
            >
              {group.name}
              <span className="text-xs text-app-muted">{group.members.length}</span>
            </button>
          ))}
          <div className="my-2 border-t border-app-border" />
          <button
            type="button"
            data-testid="create-group-open"
            onClick={onCreateClick}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-app-blue hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create new group
          </button>
        </div>
      ) : null}
    </div>
  );
}
