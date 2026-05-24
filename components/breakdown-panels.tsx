"use client";

import type { ComponentType } from "react";
import { Car, ChevronDown, FileText, Home, Info, Receipt, Sparkles, Users, WalletCards } from "lucide-react";
import { formatKrw } from "@/lib/format";
import type { CostItem, Proposal } from "@/lib/types";
import { AppCard } from "@/components/ui/app-card";
import { Table } from "@/components/ui/table";

const itemIcons = [Home, Home, Receipt, Car, Sparkles];

export function BreakdownPanels({ proposal }: { proposal: Proposal }) {
  return (
    <div className="grid gap-2 xl:grid-cols-[270px_minmax(0,1fr)]" data-testid="breakdown-panels">
      <MobileAccordionRow icon={FileText} title="Split Details" />
      <MobileAccordionRow icon={Users} title="Everyone's Share" />
      <div className="hidden xl:contents">
        <CostItemsPanel items={proposal.costItems} total={proposal.totalCost} />
        <ParticipantBreakdown proposal={proposal} />
      </div>
      {proposal.calculationResult ? (
        <div className="xl:col-span-2">
          <AppCard className="overflow-hidden" data-testid="calculation-audit">
            <div className="flex items-center gap-2 border-b border-app-border px-5 py-3 text-base font-bold">
              <WalletCards className="h-5 w-5 text-app-blue" aria-hidden="true" />
              Split math
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              <div className="space-y-2">
                {(proposal.calculationResult.auditExplanation ?? []).map((line) => (
                  <div key={line} className="rounded-lg border border-app-border bg-slate-50 px-3 py-2 text-sm text-app-text">
                    {line}
                  </div>
                ))}
                {(proposal.calculationResult.roundingAdjustments ?? []).length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-app-text">
                    Rounding adjustment: {(proposal.calculationResult.roundingAdjustments ?? []).length} minor-unit assignment
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                {(proposal.calculationResult.settlementInstructions ?? []).map((instruction) => (
                  <div key={`${instruction.fromParticipantId}-${instruction.toParticipantId}-${instruction.amount}`} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-app-text">
                    {instruction.text}
                  </div>
                ))}
              </div>
            </div>
          </AppCard>
        </div>
      ) : null}
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
      <div className="border-b border-app-border px-5 py-3 text-base font-bold">Split details</div>
      <div>
        <Table className="rounded-none border-0" minWidth="560px">
          <Table.Header>
            <Table.Row>
              <Table.Head>Item</Table.Head>
              <Table.Head>Paid by</Table.Head>
              <Table.Head>Excluded</Table.Head>
              <Table.Head numeric>Amount (KRW)</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item, index) => {
              const Icon = itemIcons[index] ?? Sparkles;
              return (
                <Table.Row key={item.id}>
                  <Table.Cell nowrap>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-app-muted" aria-hidden="true" />
                      {item.label}
                    </span>
                  </Table.Cell>
                  <Table.Cell muted nowrap>{item.paidBy ?? item.paidByParticipantId ?? "-"}</Table.Cell>
                  <Table.Cell muted nowrap>{item.excludedParticipantIds?.join(", ") || "-"}</Table.Cell>
                  <Table.Cell numeric nowrap className="font-medium">{formatKrw(item.amount)}</Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
          <Table.Footer>
            <Table.Row>
              <Table.Cell colSpan={3}>Total</Table.Cell>
              <Table.Cell numeric>{formatKrw(total)}</Table.Cell>
            </Table.Row>
          </Table.Footer>
        </Table>
      </div>
    </AppCard>
  );
}

function ParticipantBreakdown({ proposal }: { proposal: Proposal }) {
  const participants = proposal.participants;
  const calculation = proposal.calculationResult;
  const fairShareTotal = calculation?.fairShareByParticipant
    ? Object.values(calculation.fairShareByParticipant).reduce((sum, amount) => sum + amount, 0)
    : participants.reduce((sum, participant) => sum + participant.shareAmount, 0);
  const paidTotal = calculation?.totalPaidByParticipant ? Object.values(calculation.totalPaidByParticipant).reduce((sum, amount) => sum + amount, 0) : 0;
  const netTotal = calculation?.netBalanceByParticipant ? Object.values(calculation.netBalanceByParticipant).reduce((sum, amount) => sum + amount, 0) : -fairShareTotal;

  return (
    <AppCard className="overflow-hidden" data-testid="participant-breakdown-panel">
      <div className="border-b border-app-border px-5 py-3 text-base font-bold">Everyone's share</div>
      <div>
        <Table className="rounded-none border-0" minWidth="640px">
          <Table.Header>
            <Table.Row>
              <Table.Head>Friend</Table.Head>
              <Table.Head>Role</Table.Head>
              <Table.Head numeric>Fair share (KRW)</Table.Head>
              <Table.Head numeric>Paid upfront (KRW)</Table.Head>
              <Table.Head numeric>Net (KRW)</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {participants.map((participant) => (
              <Table.Row key={participant.id} data-testid={`participant-breakdown-${participant.id}`}>
                <Table.Cell className="font-medium">{participant.name}</Table.Cell>
                <Table.Cell>
                  <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-app-blue">
                    {participant.roleNote ?? "Participant"}
                  </span>
                </Table.Cell>
                <Table.Cell numeric className="font-medium">{formatKrw(calculation?.fairShareByParticipant?.[participant.id] ?? participant.shareAmount)}</Table.Cell>
                <Table.Cell numeric muted>{formatKrw(calculation?.totalPaidByParticipant?.[participant.id] ?? 0)}</Table.Cell>
                <Table.Cell numeric className={`font-bold ${(calculation?.netBalanceByParticipant?.[participant.id] ?? -participant.shareAmount) >= 0 ? "text-app-green" : "text-app-red"}`}>
                  {formatKrw(calculation?.netBalanceByParticipant?.[participant.id] ?? -participant.shareAmount)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
          <Table.Footer>
            <Table.Row>
              <Table.Cell>Total</Table.Cell>
              <Table.Cell />
              <Table.Cell numeric>{formatKrw(fairShareTotal)}</Table.Cell>
              <Table.Cell numeric>{formatKrw(paidTotal)}</Table.Cell>
              <Table.Cell numeric className={netTotal === 0 ? "text-app-text" : netTotal > 0 ? "text-app-green" : "text-app-red"}>
                {formatKrw(netTotal)}
              </Table.Cell>
            </Table.Row>
          </Table.Footer>
        </Table>
      </div>
    </AppCard>
  );
}
