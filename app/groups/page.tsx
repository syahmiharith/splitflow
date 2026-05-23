"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock3, Plus, Users, WalletCards } from "lucide-react";
import { AppCard } from "@/components/ui/app-card";
import { deriveGlobalAnalytics, deriveGroupAnalytics } from "@/lib/analytics";
import { formatKrw } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";

export default function GroupsPage() {
  const { state, createGroup } = useSplitFlow();
  const globalSummary = deriveGlobalAnalytics(state.groups);

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="groups-route">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Summary icon={Users} label="Groups" value={String(globalSummary.activeGroups)} tone="blue" />
        <Summary icon={CheckCircle2} label="Active splits" value={String(globalSummary.openProposals)} tone="green" />
        <Summary icon={WalletCards} label="Outstanding" value={formatKrw(globalSummary.stillOwed)} tone="amber" />
      </div>

      <div className="space-y-4">
        {state.groups.map((group) => {
          const summary = deriveGroupAnalytics(group);
          return (
          <AppCard key={group.id} className="p-5">
            <div className="flex gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-blue-50 text-app-blue">
                <Users className="h-8 w-8" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <h2 className="min-w-0 flex-1 truncate text-xl font-bold sm:text-2xl">{group.name}</h2>
                  <span className="shrink-0 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-semibold text-app-green">
                    {summary.openChangeRequests > 0 ? "Needs review" : "Active"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-app-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {group.members.length} members
                  </span>
                  <span>{summary.activeProposals} active proposals</span>
                  <span className="basis-full inline-flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4" />
                    Updated {new Date(group.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <AvatarStack names={group.members.map((member) => member.name)} />
                  <Link
                    href={`/groups/${group.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-app-border px-4 text-sm font-semibold text-app-blue hover:bg-slate-50"
                  >
                    Open group
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </AppCard>
        );
        })}
      </div>

      <button
        type="button"
        onClick={() => createGroup({ name: `New Group ${state.groups.length + 1}`, description: "Shared-cost workspace" })}
        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-app-blue text-base font-semibold text-white shadow-soft"
        data-testid="groups-create-group"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        New Group
      </button>
    </div>
  );
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone: "blue" | "green" | "amber" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-app-border bg-white p-3 shadow-[0_1px_2px_rgba(24,33,47,0.04)] sm:p-4">
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${tone === "green" ? "bg-green-50 text-app-green" : tone === "amber" ? "bg-amber-50 text-app-amber" : "bg-blue-50 text-app-blue"}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="whitespace-nowrap text-lg font-bold sm:text-2xl">{value}</div>
      <div className="text-xs leading-tight text-app-muted sm:text-sm">{label}</div>
    </div>
  );
}

function AvatarStack({ names }: { names: string[] }) {
  return (
    <div className="flex -space-x-2">
      {names.slice(0, 3).map((name) => (
        <span key={name} className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-slate-200 text-xs font-bold">
          {name.charAt(0).toUpperCase()}
        </span>
      ))}
      {names.length > 3 ? <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-slate-100 text-xs font-bold text-app-muted">+{names.length - 3}</span> : null}
    </div>
  );
}
