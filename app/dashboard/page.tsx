"use client";

import { Bell, Bot, Check, ChevronRight, Clock3, FileText, Pencil, Users, WalletCards, Zap } from "lucide-react";
import { formatKrw } from "@/lib/format";
import { countParticipants } from "@/lib/split";
import { useSplitFlow } from "@/lib/store";
import { AppCard } from "@/components/ui/app-card";

const rows = [
  { name: "Ali", status: "Accepted", action: "Waiting for payment", tone: "green" },
  { name: "Sarah", status: "Pending", action: "Send reminder", tone: "amber" },
  { name: "Daniel", status: "Requested changes", action: "Review changes", tone: "violet" },
  { name: "Aiman", status: "Accepted", action: "Waiting for payment", tone: "green" }
];

export default function DashboardPage() {
  const { activeProposal, sendProposal, askAiToAdjust } = useSplitFlow();
  const counts = countParticipants(activeProposal);

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="dashboard-route">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Metric icon={WalletCards} label="Still Owed" value={formatKrw(70000)} tone="blue" />
        <Metric icon={FileText} label="Active Proposals" value="4" tone="blue" />
        <Metric icon={Clock3} label="Pending Responses" value={String(counts.pending + 1)} tone="amber" />
      </div>

      <AppCard className="overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-5">
          <BarIcon />
          <h2 className="text-xl font-bold">Live Status</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 md:grid-cols-4">
          <StatusTile label="Accepted" value={counts.accepted} tone="green" />
          <StatusTile label="Pending" value={counts.pending} tone="amber" />
          <StatusTile label="Changes" value={counts.changes} tone="violet" />
          <StatusTile label="Paid" value={counts.paid} tone="blue" />
        </div>
        <div className="divide-y divide-app-border border-t border-app-border">
          {rows.map((row) => (
            <button key={row.name} type="button" className="flex min-h-20 w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
              <Avatar name={row.name} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-app-text">{row.name}</div>
        <div className="mt-1 flex items-center gap-2 text-sm text-app-text">
          <StatusDot tone={row.tone} />
          <span className="truncate">{row.status}</span>
        </div>
        <span className={`mt-2 inline-block rounded-lg px-3 py-1.5 text-xs font-medium sm:hidden ${pillClass(row.tone)}`}>{row.action}</span>
      </div>
              <span className={`hidden rounded-lg px-3 py-2 text-xs font-medium sm:inline ${pillClass(row.tone)}`}>{row.action}</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-app-muted" aria-hidden="true" />
            </button>
          ))}
        </div>
      </AppCard>

      <AppCard className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <Zap className="h-7 w-7 fill-blue-50 text-app-blue" aria-hidden="true" />
          <h2 className="text-xl font-bold">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ActionButton icon={Bell} label="Remind Pending" onClick={sendProposal} />
          <ActionButton icon={Pencil} label="Review Changes" onClick={askAiToAdjust} tone="violet" />
          <ActionButton icon={Bot} label="Ask AI" onClick={askAiToAdjust} />
        </div>
      </AppCard>

      <AppCard className="p-5">
        <div className="mb-3 flex items-center gap-3">
          <WarningIcon />
          <h2 className="text-xl font-bold">Risk & Action Queue</h2>
        </div>
        <ActionRow icon={Pencil} title="Daniel requested edit" text="Review and respond to keep the proposal moving." tone="violet" />
        <ActionRow icon={Users} title="2 participants have not responded" text="2 participants are still pending. Send a reminder to pending participants." tone="amber" />
        <ActionRow icon={WalletCards} title="Sarah accepted but has not paid" text="Follow up to collect the outstanding amount." tone="green" />
      </AppCard>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof WalletCards; label: string; value: string; tone: "blue" | "amber" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-app-border bg-white p-3 shadow-[0_1px_2px_rgba(24,33,47,0.04)] sm:p-4">
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-full ${tone === "amber" ? "bg-amber-50 text-app-amber" : "bg-blue-50 text-app-blue"}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="text-xs leading-tight text-app-muted sm:text-sm">{label}</div>
      <div className="mt-1 whitespace-nowrap text-lg font-bold text-app-text sm:text-xl">{value}</div>
    </div>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "violet" | "blue" }) {
  return (
    <div className={`rounded-xl border p-4 ${tileClass(tone)}`}>
      <div className="flex items-center gap-3">
        <StatusDot tone={tone} large />
        <div>
          <div className="text-sm text-app-text">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone = "blue" }: { icon: typeof Bell; label: string; onClick: () => void; tone?: "blue" | "violet" }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-14 items-center justify-center gap-3 rounded-xl border px-4 text-sm font-semibold ${tone === "violet" ? "border-violet-200 text-app-violet" : "border-blue-200 text-app-blue"}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </button>
  );
}

function ActionRow({ icon: Icon, title, text, tone }: { icon: typeof Bell; title: string; text: string; tone: "green" | "amber" | "violet" }) {
  return (
    <button type="button" className="flex w-full items-center gap-3 border-t border-app-border py-4 text-left first:border-t-0">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tone === "green" ? "bg-green-50 text-app-green" : tone === "amber" ? "bg-amber-50 text-app-amber" : "bg-violet-50 text-app-violet"}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold">{title}</div>
        <div className="mt-1 text-sm text-app-muted">{text}</div>
      </div>
      <ChevronRight className="h-5 w-5 text-app-muted" aria-hidden="true" />
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  return <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-bold text-app-text">{name.charAt(0)}</div>;
}

function StatusDot({ tone, large = false }: { tone: string; large?: boolean }) {
  return (
    <span className={`grid ${large ? "h-10 w-10" : "h-7 w-7"} shrink-0 place-items-center rounded-full ${tone === "green" ? "bg-app-green text-white" : tone === "amber" ? "bg-app-amber text-white" : tone === "violet" ? "bg-app-violet text-white" : "bg-app-blue text-white"}`}>
      <Check className={`${large ? "h-5 w-5" : "h-4 w-4"}`} aria-hidden="true" />
    </span>
  );
}

function tileClass(tone: string) {
  if (tone === "green") return "border-green-200 bg-green-50";
  if (tone === "amber") return "border-amber-200 bg-amber-50";
  if (tone === "violet") return "border-violet-200 bg-violet-50";
  return "border-blue-200 bg-blue-50";
}

function pillClass(tone: string) {
  if (tone === "green") return "bg-green-50 text-app-green";
  if (tone === "amber") return "bg-amber-50 text-app-amber";
  if (tone === "violet") return "bg-violet-50 text-app-violet";
  return "bg-blue-50 text-app-blue";
}

function BarIcon() {
  return (
    <span className="flex h-8 w-9 shrink-0 items-end gap-1.5" aria-hidden="true">
      <span className="h-7 w-2 rounded-full bg-app-blue" />
      <span className="h-5 w-2 rounded-full bg-app-blue" />
      <span className="h-8 w-2 rounded-full bg-app-blue" />
    </span>
  );
}

function WarningIcon() {
  return <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-xl font-bold text-app-blue">!</span>;
}
