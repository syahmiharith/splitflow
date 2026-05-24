"use client";

import { formatKrw, humanStatus } from "@/lib/format";
import { deriveParticipantShareExplanation, deriveReadinessSummary, deriveSplitReadiness } from "@/lib/readiness";
import type { PaymentRecord, Proposal } from "@/lib/types";
import { SharePreviewMessage } from "@/components/readiness-widgets";

export function ProposalPanelBody({ proposal }: { proposal: Proposal }) {
  const calculation = proposal.calculationResult;
  const readiness = deriveReadinessSummary(proposal);
  const splitReadiness = deriveSplitReadiness(proposal);
  const sharePreview = createSharePreview(proposal);
  const claimedRecords = proposal.paymentRecords?.filter((record) => record.status === "claimed") ?? [];
  const changeRequests = proposal.participants.filter((participant) => participant.status === "requested_changes" || participant.changeRequestNote);

  return (
    <>
      <section data-testid="panel-decision" className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <h3 className="text-sm font-bold text-app-text">Settlement readiness</h3>
        <p className="mt-1 text-sm font-semibold text-app-amber">{splitReadiness.label}</p>
        {splitReadiness.blockers.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm leading-6 text-app-text">
            {splitReadiness.blockers.map((blocker) => (
              <li key={blocker}>- {blocker}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-app-text">No unresolved change request, pending response, or claimed payment blocker remains.</p>
        )}
        <p className="mt-2 text-sm font-bold text-app-text">Next: {splitReadiness.nextAction}</p>
      </section>

      <section data-testid="proposal-summary" className="rounded-lg border border-app-border bg-white p-3">
        <h3 className="text-sm font-bold text-app-text">Split summary</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Metric label="Total" value={formatKrw(calculation?.totalCost ?? proposal.totalCost)} />
          <Metric label="Status" value={humanStatus(proposal.status)} />
          <Metric label="Group" value={proposal.groupId ?? "Current group"} />
          <Metric label="Organizer" value={proposal.organizerName} />
        </div>
        <p className="mt-3 text-sm leading-6 text-app-muted">Next action: {readiness.nextAction}. Human review is required before settlement.</p>
      </section>

      {readiness.blockers.length > 0 ? (
        <section data-testid="readiness-blockers" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <h3 className="text-sm font-bold text-app-amber">Readiness blockers</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-app-text">
            {readiness.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section data-testid="settlement-ready-state" className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm font-semibold text-app-green">
          Ready to settle: no unresolved change request or claimed payment blocker remains.
        </section>
      )}

      <section data-testid="rules-applied" className="rounded-lg border border-app-border bg-white p-3">
        <h3 className="text-sm font-bold">Rules applied</h3>
        <div className="mt-2 space-y-2">
          {readiness.checklist.map((item) => (
            <div key={item.id} className="rounded-md border border-app-border bg-slate-50 px-3 py-2">
              <div className="text-sm font-semibold text-app-text">{item.label}</div>
              <p className="mt-1 text-xs leading-5 text-app-muted">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {proposal.status !== "draft" ? <SharePreviewMessage summaryText={sharePreview} /> : null}

      <section data-testid="itemized-split" className="rounded-lg border border-app-border bg-white p-3">
        <h3 className="text-sm font-bold">Costs</h3>
        <div className="mt-2 space-y-2">
          {proposal.costItems.map((item) => {
            const breakdown = calculation?.itemizedBreakdown?.find((row) => row.itemId === item.id);
            const included = breakdown?.eligibleParticipantIds.map((id) => participantName(proposal, id)).join(", ") ?? "Pending calculation";
            const excluded = (item.excludedParticipantIds ?? []).map((id) => participantName(proposal, id));
            return (
              <div key={item.id} className="rounded-lg border border-app-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{item.label}</span>
                  <span className="font-bold">{formatKrw(item.amount)}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-app-muted">Included: {included}</p>
                {excluded.length > 0 ? <p className="mt-1 text-xs font-semibold text-app-amber">Excluded: {excluded.join(", ")}</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section data-testid="math-audit" className="rounded-lg border border-app-border bg-white p-3">
        <h3 className="text-sm font-bold">Participant shares</h3>
        <p className="mt-1 text-xs leading-5 text-app-muted">Deterministic math explains each included item, exclusion, fronted amount, and net balance.</p>
        <div className="mt-2 space-y-2">
          {proposal.participants.map((participant) => {
            const explanation = deriveParticipantShareExplanation(proposal, participant.id);
            const paid = calculation?.totalPaidByParticipant?.[participant.id] ?? 0;
            return (
              <div key={participant.id} className="rounded-lg border border-app-border bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{participant.name}</span>
                  <span className="font-bold text-app-text">{formatKrw(explanation.share)}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-app-muted">
                  Included items: {explanation.included.map((item) => item.label).join(", ") || "none"}.
                </p>
                {explanation.excluded.length > 0 ? (
                  <p className="mt-1 text-xs leading-5 text-app-muted">Excluded from: {explanation.excluded.map((item) => item.label).join(", ")}.</p>
                ) : null}
                <p className="mt-1 text-xs leading-5 text-app-muted">
                  Fronted amount: {formatKrw(paid)}. Net balance: {formatKrw(explanation.net)}.
                </p>
                {participant.roleNote ? <p className="mt-1 text-xs font-semibold text-app-blue">{participant.roleNote}</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      {proposal.paymentRecords && proposal.paymentRecords.length > 0 ? (
        <section data-testid="claimed-payment-ledger" className="rounded-lg border border-app-border bg-white p-3">
          <h3 className="text-sm font-bold">Settlement ledger</h3>
          <p className="mt-1 text-xs leading-5 text-app-muted">These are participant claims or organizer notes. No bank verification in prototype.</p>
          <div className="mt-2 space-y-2">
            {proposal.paymentRecords.map((record) => (
              <PaymentRecordRow key={record.id} proposal={proposal} record={record} />
            ))}
          </div>
        </section>
      ) : null}

      <section data-testid="change-request-section" className="rounded-lg border border-app-border bg-white p-3">
        <h3 className="text-sm font-bold">Change requests</h3>
        {changeRequests.length > 0 ? (
          <div className="mt-2 space-y-2">
            {changeRequests.map((participant) => (
              <div key={participant.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div className="font-semibold">{participant.name}</div>
                <p className="mt-1 text-app-muted">{participant.changeRequestNote ?? "Requested organizer review."}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-app-muted">No participant change request is currently unresolved. Item exclusions remain visible in the itemized split.</p>
        )}
      </section>

      {claimedRecords.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-app-text">
          Not ready: payment claim needs confirmation.
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-bold">Settlement instructions</h3>
        <div className="mt-2 space-y-2">
          {(calculation?.settlementInstructions ?? []).map((instruction) => (
            <div key={`${instruction.fromParticipantId}-${instruction.toParticipantId}-${instruction.amount}`} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
              {instruction.text}
            </div>
          ))}
        </div>
      </section>

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

function PaymentRecordRow({ proposal, record }: { proposal: Proposal; record: PaymentRecord }) {
  const statusLabel =
    record.status === "claimed"
      ? "Needs organizer confirmation"
      : record.status === "confirmed"
        ? "Confirmed by organizer"
        : humanStatus(record.status);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
      <div className="font-semibold">
        {participantName(proposal, record.fromParticipantId)} - Claimed payment: {formatKrw(record.amount)}
      </div>
      <div className="mt-1 font-semibold text-app-amber">{statusLabel}</div>
      <div className="mt-1 text-app-muted">{record.proofNote ?? "No participant reference attached."}</div>
      <div className="mt-1 text-xs font-semibold text-app-muted">No bank verification in prototype.</div>
      <div className="mt-2 text-xs font-semibold text-app-muted">Available actions: Confirm, Dispute, Void.</div>
    </div>
  );
}

function participantName(proposal: Proposal, participantId: string): string {
  return proposal.participants.find((participant) => participant.id === participantId)?.name ?? participantId;
}

function createSharePreview(proposal: Proposal): string {
  const calculation = proposal.calculationResult;
  const lines = proposal.participants
    .filter((participant) => participant.id !== proposal.organizerId && participant.id !== "you")
    .slice(0, 5)
    .map((participant) => {
      const share = calculation?.fairShareByParticipant?.[participant.id] ?? participant.shareAmount;
      return `${participant.name}: ${formatKrw(share)} (${humanStatus(participant.status)})`;
    });

  return `${proposal.organizerName} sent ${proposal.title} for participant agreement.\n${lines.join("\n")}\nOpen it to accept, request a change, add a claimed payment, or opt out.`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-slate-50 px-3 py-2">
      <div className="text-xs text-app-muted">{label}</div>
      <div className="mt-1 truncate font-bold">{value}</div>
    </div>
  );
}
