"use client";

import { formatKrw, humanStatus } from "@/lib/format";
import type { Proposal } from "@/lib/types";

export function ProposalPanelBody({ proposal }: { proposal: Proposal }) {
  const calculation = proposal.calculationResult;

  return (
    <>
      <section className="grid grid-cols-2 gap-2">
        <Metric label="Total" value={formatKrw(calculation?.totalCost ?? proposal.totalCost)} />
        <Metric label="Participants" value={String(proposal.participants.length)} />
      </section>

      <section>
        <h3 className="text-sm font-bold">Itemized costs</h3>
        <div className="mt-2 space-y-2">
          {proposal.costItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2 text-sm">
              <span>{item.label}</span>
              <span className="font-semibold">{formatKrw(item.amount)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold">Participant balances</h3>
        <div className="mt-2 space-y-2">
          {proposal.participants.map((participant) => {
            const net = calculation?.netBalanceByParticipant[participant.id] ?? -participant.shareAmount;
            return (
              <div key={participant.id} className="rounded-lg border border-app-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{participant.name}</span>
                  <span className={net >= 0 ? "font-bold text-app-green" : "font-bold text-app-red"}>{formatKrw(net)}</span>
                </div>
                <div className="mt-1 text-xs text-app-muted">{humanStatus(participant.status)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold">Settlement plan</h3>
        <div className="mt-2 space-y-2">
          {calculation?.settlementInstructions.map((instruction) => (
            <div key={`${instruction.fromParticipantId}-${instruction.toParticipantId}-${instruction.amount}`} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
              {instruction.text}
            </div>
          ))}
        </div>
      </section>

      {proposal.paymentRecords && proposal.paymentRecords.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold">Settlement ledger</h3>
          <div className="mt-2 space-y-2">
            {proposal.paymentRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div className="font-semibold">{humanStatus(record.status)} paid: {formatKrw(record.amount)}</div>
                <div className="mt-1 text-app-muted">{record.proofNote ?? "No proof note attached."}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-bold">Timeline</h3>
        <div className="mt-2 space-y-2">
          {(proposal.timeline ?? []).map((event) => (
            <div key={event.id} className="rounded-lg border border-app-border px-3 py-2 text-sm">
              <div className="font-medium">{event.actor}</div>
              <div className="text-app-muted">{event.text}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-slate-50 px-3 py-2">
      <div className="text-xs text-app-muted">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}
