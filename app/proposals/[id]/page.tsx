"use client";

import Link from "next/link";
import { Archive, Calculator, Check, CreditCard, RefreshCcw, Send, ShieldAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { formatKrw, humanStatus } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import { AppCard } from "@/components/ui/app-card";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const {
    state,
    sendProposal,
    acceptRequestedChange,
    requestReconfirmation,
    markPaid,
    markSettled,
    archiveProposal
  } = useSplitFlow();
  const proposal = state.proposals.find((item) => item.id === params.id) ?? state.proposals[0];
  const calculation = proposal.calculationResult;

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="proposal-detail-route">
      <div className="flex flex-col gap-3 rounded-2xl border border-app-border bg-white p-5 md:rounded-lg">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <Link href="/proposals" className="text-sm font-semibold text-app-blue">Proposals</Link>
            <h1 className="mt-2 text-2xl font-bold text-app-text">{proposal.title}</h1>
            <p className="mt-2 text-sm text-app-muted">{proposal.description}</p>
          </div>
          <StatusBadge status={proposal.status} label={humanStatus(proposal.status)} />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Summary label="Organizer" value={proposal.organizerName} />
          <Summary label="Total" value={formatKrw(proposal.totalCost)} />
          <Summary label="Participants" value={String(proposal.participants.length)} />
          <Summary label="Split rule" value={humanStatus(proposal.splitMethod)} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="space-y-4">
          <AppCard className="overflow-hidden">
            <SectionTitle icon={Calculator} title="Itemized math" />
            <div className="overflow-x-auto">
              <table className="min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-xs text-app-muted">
                  <tr>
                    <th className="px-5 py-2 text-left">Item</th>
                    <th className="px-5 py-2 text-left">Paid by</th>
                    <th className="px-5 py-2 text-left">Included</th>
                    <th className="px-5 py-2 text-left">Excluded</th>
                    <th className="px-5 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {proposal.costItems.map((item) => {
                    const row = calculation?.itemizedBreakdown.find((breakdown) => breakdown.itemId === item.id);
                    return (
                      <tr key={item.id}>
                        <td className="px-5 py-3 font-medium">{item.label}</td>
                        <td className="px-5 py-3">{nameFor(proposal, item.paidByParticipantId ?? item.paidBy ?? "")}</td>
                        <td className="px-5 py-3 text-app-muted">{row?.eligibleParticipantIds.map((id) => nameFor(proposal, id)).join(", ")}</td>
                        <td className="px-5 py-3 text-app-muted">{item.excludedParticipantIds?.map((id) => nameFor(proposal, id)).join(", ") || "-"}</td>
                        <td className="px-5 py-3 text-right font-semibold">{formatKrw(item.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AppCard>

          <AppCard className="overflow-hidden">
            <SectionTitle icon={CreditCard} title="Participant balances" />
            <div className="overflow-x-auto">
              <table className="min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-xs text-app-muted">
                  <tr>
                    <th className="px-5 py-2 text-left">Participant</th>
                    <th className="px-5 py-2 text-left">Response</th>
                    <th className="px-5 py-2 text-right">Paid</th>
                    <th className="px-5 py-2 text-right">Fair share</th>
                    <th className="px-5 py-2 text-right">Net balance</th>
                    <th className="px-5 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {proposal.participants.map((participant) => {
                    const net = calculation?.netBalanceByParticipant[participant.id] ?? -participant.shareAmount;
                    return (
                      <tr key={participant.id}>
                        <td className="px-5 py-3 font-medium">{participant.name}</td>
                        <td className="px-5 py-3">{humanStatus(participant.status)}</td>
                        <td className="px-5 py-3 text-right">{formatKrw(calculation?.totalPaidByParticipant[participant.id] ?? 0)}</td>
                        <td className="px-5 py-3 text-right">{formatKrw(calculation?.fairShareByParticipant[participant.id] ?? participant.shareAmount)}</td>
                        <td className={`px-5 py-3 text-right font-bold ${net >= 0 ? "text-app-green" : "text-app-red"}`}>{formatKrw(net)}</td>
                        <td className="px-5 py-3 text-right">
                          <button type="button" onClick={() => markPaid(participant.id, proposal.id)} className="rounded-md border border-app-border px-2 py-1 text-xs font-semibold text-app-blue">
                            Mark paid
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AppCard>

          <AppCard className="p-5">
            <h2 className="text-lg font-bold">Your calculation</h2>
            <div className="mt-3 grid gap-2">
              {calculation?.auditExplanation.map((line) => (
                <div key={line} className="rounded-lg border border-app-border bg-slate-50 px-3 py-2 text-sm">{line}</div>
              ))}
              {(calculation?.roundingAdjustments.length ?? 0) > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  Rounding adjustment: {calculation?.roundingAdjustments.length} deterministic minor-unit assignment.
                </div>
              ) : null}
            </div>
          </AppCard>
        </div>

        <div className="space-y-4">
          <AppCard className="p-5">
            <h2 className="text-lg font-bold">Available actions</h2>
            <div className="mt-3 grid gap-2">
              <ActionButton testId="detail-send-proposal" icon={Send} label="Send proposal" onClick={() => sendProposal(proposal.id)} />
              <ActionButton testId="detail-accept-change" icon={Check} label="Accept requested change" onClick={() => acceptRequestedChange(proposal.id)} />
              <ActionButton testId="detail-recalculate" icon={RefreshCcw} label="Recalculate" onClick={() => requestReconfirmation(proposal.id)} />
              <ActionButton testId="detail-mark-settled" icon={CreditCard} label="Mark proposal settled" onClick={() => markSettled(proposal.id)} />
              <ActionButton testId="detail-archive" icon={Archive} label="Archive proposal" onClick={() => archiveProposal(proposal.id)} />
            </div>
          </AppCard>

          <AppCard className="p-5">
            <SectionTitle icon={ShieldAlert} title="AI recommendation" compact />
            <p className="mt-3 text-sm leading-6 text-app-text">{proposal.recommendation}</p>
            {proposal.aiExplanation ? <p className="mt-3 text-xs leading-5 text-app-muted">{proposal.aiExplanation}</p> : null}
          </AppCard>

          <AppCard className="p-5" data-testid="settlement-plan">
            <h2 className="text-lg font-bold">Settlement plan</h2>
            <div className="mt-3 space-y-2">
              {calculation?.settlementInstructions.map((instruction) => (
                <div key={`${instruction.fromParticipantId}-${instruction.toParticipantId}-${instruction.amount}`} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium">
                  {instruction.text}
                </div>
              ))}
            </div>
          </AppCard>

          <AppCard className="p-5" data-testid="change-requests">
            <h2 className="text-lg font-bold">Change requests</h2>
            <div className="mt-3 space-y-2">
              {proposal.participants.filter((participant) => participant.changeRequestNote).map((participant) => (
                <div key={participant.id} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm">
                  <strong>{participant.name}:</strong> {participant.changeRequestNote}
                </div>
              ))}
            </div>
          </AppCard>

          <AppCard className="p-5">
            <h2 className="text-lg font-bold">Timeline</h2>
            <div className="mt-3 space-y-2">
              {(proposal.timeline ?? []).map((event) => (
                <div key={event.id} className="rounded-lg border border-app-border px-3 py-2 text-sm">
                  <div className="font-semibold">{event.actor}</div>
                  <div className="text-app-muted">{event.text}</div>
                </div>
              ))}
            </div>
          </AppCard>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-slate-50 px-3 py-2">
      <div className="text-xs text-app-muted">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, compact = false }: { icon: typeof Calculator; title: string; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "border-b border-app-border px-5 py-3"} text-base font-bold`}>
      <Icon className="h-5 w-5 text-app-blue" aria-hidden="true" />
      {title}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, testId }: { icon: typeof Send; label: string; onClick: () => void; testId: string }) {
  return (
    <button data-testid={testId} type="button" onClick={onClick} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-text hover:bg-slate-50">
      <Icon className="h-4 w-4 text-app-blue" aria-hidden="true" />
      {label}
    </button>
  );
}

function nameFor(proposal: { participants: Array<{ id: string; name: string }> }, participantId: string): string {
  return proposal.participants.find((participant) => participant.id === participantId)?.name ?? participantId;
}
