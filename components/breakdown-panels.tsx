"use client";

import type { ComponentType } from "react";
import { Beef, ChevronDown, CupSoda, FileText, Flame, Info, Salad, Users } from "lucide-react";
import { formatKrw } from "@/lib/format";
import type { CostItem, Participant, Proposal } from "@/lib/types";
import { AppCard } from "@/components/ui/app-card";

const itemIcons = [Beef, CupSoda, Flame, Salad];

export function BreakdownPanels({ proposal }: { proposal: Proposal }) {
  return (
    <div className="grid gap-2 xl:grid-cols-[270px_minmax(0,1fr)]" data-testid="breakdown-panels">
      <MobileAccordionRow icon={FileText} title="Cost Items" />
      <MobileAccordionRow icon={Users} title="Participant Breakdown" />
      <div className="hidden xl:contents">
        <CostItemsPanel items={proposal.costItems} total={proposal.totalCost} />
        <ParticipantBreakdown participants={proposal.participants.slice(0, 4)} />
      </div>
      <div className="xl:col-span-2">
        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-app-text md:rounded-lg">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-app-blue" aria-hidden="true" />
          <p>{proposal.fairnessNote}</p>
        </div>
      </div>
    </div>
  );
}

function MobileAccordionRow({ icon: Icon, title }: { icon: ComponentType<{ className?: string }>; title: string }) {
  return (
    <button
      type="button"
      className="flex min-h-16 items-center gap-3 rounded-2xl border border-app-border bg-white px-5 text-left text-lg font-bold text-app-text shadow-[0_1px_2px_rgba(24,33,47,0.04)] xl:hidden"
      aria-expanded="false"
    >
      <Icon className="h-6 w-6 text-app-blue" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <ChevronDown className="h-5 w-5 text-app-muted" aria-hidden="true" />
    </button>
  );
}

function CostItemsPanel({ items, total }: { items: CostItem[]; total: number }) {
  return (
    <AppCard className="overflow-hidden" data-testid="cost-items-panel">
      <div className="border-b border-app-border px-5 py-3 text-base font-bold">Cost Items</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs text-app-muted">
            <tr>
              <th className="px-5 py-2 text-left font-semibold">Item</th>
              <th className="px-5 py-2 text-right font-semibold">Amount (KRW)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {items.map((item, index) => {
              const Icon = itemIcons[index] ?? Salad;
              return (
                <tr key={item.id}>
                  <td className="whitespace-nowrap px-5 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-app-muted" aria-hidden="true" />
                      {item.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium">{formatKrw(item.amount)}</td>
                </tr>
              );
            })}
            <tr className="font-bold">
              <td className="px-5 py-2.5">Total</td>
              <td className="px-5 py-2.5 text-right">{formatKrw(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}

function ParticipantBreakdown({ participants }: { participants: Participant[] }) {
  return (
    <AppCard className="overflow-hidden" data-testid="participant-breakdown-panel">
      <div className="border-b border-app-border px-5 py-3 text-base font-bold">Participant Breakdown</div>
      <div className="overflow-x-auto">
        <table className="min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-xs text-app-muted">
            <tr>
              <th className="px-5 py-2 text-left font-semibold">Participant</th>
              <th className="px-5 py-2 text-left font-semibold">Role</th>
              <th className="px-5 py-2 text-right font-semibold">Owes (KRW)</th>
              <th className="px-5 py-2 text-right font-semibold">Receives (KRW)</th>
              <th className="px-5 py-2 text-right font-semibold">Net (KRW)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {participants.map((participant) => (
              <tr key={participant.id} data-testid={`participant-breakdown-${participant.id}`}>
                <td className="px-5 py-2.5 font-medium">{participant.name}</td>
                <td className="px-5 py-2.5">
                  <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-app-blue">
                    {participant.roleNote ?? "Participant"}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right font-medium">{formatKrw(participant.shareAmount)}</td>
                <td className="px-5 py-2.5 text-right text-app-muted">-</td>
                <td className="px-5 py-2.5 text-right font-bold text-app-red">-{formatKrw(participant.shareAmount)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="px-5 py-2.5">Total</td>
              <td />
              <td className="px-5 py-2.5 text-right">{formatKrw(participants.reduce((sum, participant) => sum + participant.shareAmount, 0))}</td>
              <td className="px-5 py-2.5 text-right">{formatKrw(0)}</td>
              <td className="px-5 py-2.5 text-right text-app-red">
                -{formatKrw(participants.reduce((sum, participant) => sum + participant.shareAmount, 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}
