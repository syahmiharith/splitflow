"use client";

import { formatKrw, humanStatus } from "@/lib/format";
import { deriveReadinessSummary } from "@/lib/readiness";
import type { Proposal } from "@/lib/types";
import { ReadinessChecklist, SafeToBookSummary, SharePreviewMessage } from "@/components/readiness-widgets";

export function ProposalPanelBody({ proposal }: { proposal: Proposal }) {
  const calculation = proposal.calculationResult;
  const readiness = deriveReadinessSummary(proposal);
  const sharePreview = createSharePreview(proposal);

  return (
    <>
      <SafeToBookSummary summary={readiness} totalCost={calculation?.totalCost ?? proposal.totalCost} compact />

      {readiness.blockers.length > 0 ? (
        <section data-testid="readiness-blockers" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <h3 className="text-sm font-bold text-app-amber">Needs attention</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-app-text">
            {readiness.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <ReadinessChecklist items={readiness.checklist} />

      {proposal.status !== "draft" ? <SharePreviewMessage summaryText={sharePreview} /> : null}

      <section className="grid grid-cols-3 gap-2">
        <Metric label="Total" value={formatKrw(calculation?.totalCost ?? proposal.totalCost)} />
        <Metric label="Friends" value={String(proposal.participants.length)} />
        <Metric label="Version" value={`v${proposal.version ?? 1}`} />
      </section>

      {proposal.revisionHistory && proposal.revisionHistory.length > 0 ? (
        <section>
          <h3 className="text-sm font-bold">Change history</h3>
          <div className="mt-2 space-y-2">
            {proposal.revisionHistory.map((revision) => (
              <div key={revision.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div className="font-semibold">v{revision.previousVersion} to v{revision.version}</div>
                <div className="mt-1 text-app-muted">{revision.reason}</div>
                {revision.amountChanges.length > 0 ? (
                  <div className="mt-2 text-xs text-app-text">
                    {revision.amountChanges.length} friend {revision.amountChanges.length === 1 ? "amount" : "amounts"} changed.
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-bold">Split details</h3>
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
        <h3 className="text-sm font-bold">Everyone's share</h3>
        <div className="mt-2 space-y-2">
          {proposal.participants.map((participant) => {
            const share = calculation?.fairShareByParticipant[participant.id] ?? participant.shareAmount;
            return (
              <div key={participant.id} className="rounded-lg border border-app-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{participant.name}</span>
                  <span className="font-bold text-app-text">{formatKrw(share)}</span>
                </div>
                <div className="mt-1 text-xs text-app-muted">{humanStatus(participant.status)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold">Payback</h3>
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
          <h3 className="text-sm font-bold">Payment notes</h3>
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
        <h3 className="text-sm font-bold">Activity</h3>
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

function createSharePreview(proposal: Proposal): string {
  const calculation = proposal.calculationResult;
  const lines = proposal.participants
    .filter((participant) => participant.id !== proposal.organizerId && participant.id !== "you")
    .slice(0, 5)
    .map((participant) => {
      const share = calculation?.fairShareByParticipant[participant.id] ?? participant.shareAmount;
      return `${participant.name}: ${formatKrw(share)} (${humanStatus(participant.status)})`;
    });

  return `${proposal.organizerName} sent Your Share for ${proposal.title}.\n${lines.join("\n")}\nOpen it to tap I'm In, ask for a change, or opt out.`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-slate-50 px-3 py-2">
      <div className="text-xs text-app-muted">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}
