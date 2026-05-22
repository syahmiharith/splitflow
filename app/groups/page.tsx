"use client";

import { CheckCircle2, ChevronRight, Clock3, FlameKindling, Home, Plane, Plus, Users, WalletCards } from "lucide-react";
import { AppCard } from "@/components/ui/app-card";

const groups = [
  {
    name: "BBQ Crew",
    icon: FlameKindling,
    status: "Active",
    tone: "green",
    members: "8 members",
    detail: "1 active proposal",
    meta: "Last activity: Today",
    action: "Open Group"
  },
  {
    name: "Housemates",
    icon: Home,
    status: "Past Due",
    tone: "red",
    members: "4 members",
    detail: "2 unpaid bills",
    meta: "Outstanding: ₩42,000",
    action: "View Split"
  },
  {
    name: "Jeju Trip 2026",
    icon: Plane,
    status: "Draft",
    tone: "amber",
    members: "5 members",
    detail: "Draft settlement ready",
    meta: "Last activity: 2 days ago",
    action: "Open Group"
  },
  {
    name: "Netflix Family",
    icon: NetflixIcon,
    status: "Upcoming",
    tone: "blue",
    members: "5 members",
    detail: "Next billing in 3 days",
    meta: "Last activity: 5 days ago",
    action: "View Split"
  }
];

export default function GroupsPage() {
  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="groups-route">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Summary icon={Users} label="Groups" value="4" tone="blue" />
        <Summary icon={CheckCircle2} label="Active splits" value="3" tone="green" />
        <Summary icon={WalletCards} label="Outstanding" value="₩102,000" tone="amber" />
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <AppCard key={group.name} className="p-5">
              <div className="flex gap-4">
                <div className={`grid h-20 w-20 shrink-0 place-items-center rounded-full ${group.tone === "green" ? "bg-blue-50 text-app-blue" : group.tone === "red" ? "bg-green-50 text-app-green" : group.tone === "amber" ? "bg-violet-50 text-app-violet" : "bg-red-50 text-red-600"}`}>
                  <Icon className="h-10 w-10" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <h2 className="min-w-0 flex-1 truncate text-xl font-bold sm:text-2xl">{group.name}</h2>
                    <span className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold ${badgeClass(group.tone)}`}>{group.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-base text-app-muted">
                    <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{group.members}</span>
                    <span>•</span>
                    <span>{group.detail}</span>
                    <span className="basis-full inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{group.meta}</span>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <AvatarStack />
                    <button type="button" className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-2xl border border-app-border px-3 text-xs font-semibold text-app-blue sm:gap-2 sm:px-4 sm:text-base">
                      {group.action}
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </AppCard>
          );
        })}
      </div>

      <button type="button" className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-app-blue text-lg font-semibold text-white shadow-soft">
        <Plus className="h-6 w-6" aria-hidden="true" />
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

function AvatarStack() {
  return (
    <div className="flex -space-x-2">
      {["A", "S", "D"].map((letter) => (
        <span key={letter} className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-slate-200 text-xs font-bold">{letter}</span>
      ))}
      <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-slate-100 text-xs font-bold text-app-muted">+5</span>
    </div>
  );
}

function badgeClass(tone: string) {
  if (tone === "green") return "bg-green-50 text-app-green";
  if (tone === "red") return "bg-red-50 text-app-red";
  if (tone === "amber") return "bg-amber-50 text-app-amber";
  return "bg-blue-50 text-app-blue";
}

function NetflixIcon({ className }: { className?: string }) {
  return <span className={`text-5xl font-black text-red-600 ${className ?? ""}`}>N</span>;
}
