"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Check, CreditCard, MessageSquareWarning, XCircle } from "lucide-react";
import { DemoToolbar } from "@/components/demo-toolbar";
import { GroupRouteSync } from "@/components/group-route-sync";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatKrw, humanStatus } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import type { PaymentRecord, Proposal } from "@/lib/types";

const changeReasonChips = ["I did not join this item", "I already paid", "I joined late", "Amount looks wrong"];

export default function GroupInboxPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const { activeGroup, activeProposal, selectedProfile, respondAsParticipant, claimParticipantPayment } = useSplitFlow();
  const [changeOpen, setChangeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const proposal = activeGroup.proposals[0] ?? activeProposal;
  const organizerId = proposal.organizerId ?? "you";
  const selectedProfileId = selectedProfile?.id ?? organizerId;
  const selectedMember = activeGroup.members.find((member) => member.id === selectedProfileId) ?? selectedProfile ?? activeGroup.members[0];
  const selectedParticipant = proposal.participants.find((participant) => participant.id === selectedProfileId);

  if (!proposal || !selectedMember) {
    return (
      <div className="px-4 py-5 md:p-6" data-testid="inbox-route">
        <GroupRouteSync groupId={groupId} />
        <DemoToolbar compact />
        <div className="rounded-lg border border-app-border bg-white p-5">No Your Share reviews are available for this group yet.</div>
      </div>
    );
  }

  if (selectedProfileId === organizerId || !selectedParticipant) {
    return (
      <div className="space-y-4 px-4 py-5 md:p-6" data-testid="inbox-route">
        <GroupRouteSync groupId={groupId} />
        <DemoToolbar compact showLoaders={false} />
        <SimulationNote name={selectedMember.name} />
        <section className="rounded-lg border border-app-border bg-white p-5" data-testid="organizer-share-state">
          <p className="text-sm font-semibold uppercase tracking-wide text-app-muted">Your Share</p>
          <h1 className="mt-2 text-xl font-bold text-app-text">You are viewing as the organizer.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-app-muted">
            Choose a participant from the sidebar profile switcher to preview their share. Organizer pages like Overview and Splits still show the normal coordination workflow.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-28 pt-5 md:p-6" data-testid="inbox-route">
      <GroupRouteSync groupId={groupId} />
      <DemoToolbar compact showLoaders={false} />
      <SimulationNote name={selectedParticipant.name} />
      <YourShareCard proposal={proposal} participantId={selectedParticipant.id} participantName={selectedParticipant.name} />
      <AgreementActions
        proposal={proposal}
        participantId={selectedParticipant.id}
        changeOpen={changeOpen}
        reason={reason}
        paymentReference={paymentReference}
        onChangeOpen={() => setChangeOpen(true)}
        onReasonChange={setReason}
        onPaymentReferenceChange={setPaymentReference}
        onAccept={() => respondAsParticipant(selectedParticipant.id, "accepted", undefined, proposal.id)}
        onOptOut={() => respondAsParticipant(selectedParticipant.id, "opted_out", "I'm out for this proposal.", proposal.id)}
        onSubmitChange={() => {
          respondAsParticipant(selectedParticipant.id, "requested_changes", reason.trim() || "Participant requested a change.", proposal.id);
          setChangeOpen(false);
        }}
        onClaimPayment={() => {
          claimParticipantPayment(selectedParticipant.id, proposal.id, paymentReference);
          setPaymentReference("");
        }}
      />
    </div>
  );
}

function YourShareCard({ proposal, participantId, participantName }: { proposal: Proposal; participantId: string; participantName: string }) {
  const participant = proposal.participants.find((item) => item.id === participantId);
  const calculation = proposal.calculationResult;
  const itemizedBreakdown = calculation?.itemizedBreakdown ?? [];
  const fairShare = calculation?.fairShareByParticipant?.[participantId] ?? participant?.shareAmount ?? 0;
  const netBalance = calculation?.netBalanceByParticipant?.[participantId] ?? 0;
  const included = itemizedBreakdown.filter((item) => item.eligibleParticipantIds.includes(participantId));
  const excluded = itemizedBreakdown.filter((item) => !item.eligibleParticipantIds.includes(participantId));
  const paymentClaims = (proposal.paymentRecords ?? []).filter((record) => record.fromParticipantId === participantId && record.status !== "void");
  const confirmedClaim = paymentClaims.find((record) => record.status === "confirmed");
  const claimedPayment = paymentClaims.find((record) => record.status === "claimed");
  const status = deriveParticipantDecisionStatus(participant?.status, claimedPayment, confirmedClaim);
  const nextAction = deriveNextAction(participant?.status, excluded.length, Boolean(claimedPayment), Boolean(confirmedClaim));

  return (
    <>
      <section className="rounded-lg border border-app-border bg-white p-4" data-testid="participant-inbox-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-app-muted">Your Share</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-app-text">{proposal.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-app-border bg-slate-50 px-2 py-1 text-sm font-semibold text-app-text">{participantName}</span>
              <StatusBadge status={proposal.status} />
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-app-muted">
              {proposal.organizerName} sent this proposal for confirmation before booking or collecting.
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-app-border bg-slate-50 px-4 py-3 lg:min-w-72" data-testid="your-share-decision">
            <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">Decision amount</div>
            <div className="mt-1 break-words text-2xl font-bold text-app-text">{amountLabel(netBalance)}</div>
            <div className="mt-2 rounded-md border border-app-border bg-white px-3 py-2 text-sm font-semibold text-app-text">{status}</div>
            <p className="mt-2 text-sm leading-6 text-app-muted">{nextAction}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]" data-testid="participant-share-explanation">
        <div className="rounded-lg border border-app-border bg-white p-4">
          <h2 className="text-base font-bold text-app-text">Why this amount</h2>
          <p className="mt-1 text-sm leading-6 text-app-muted">
            Your fair share is {formatKrw(fairShare)} before payer netting. Deterministic TypeScript math decides the final amount.
          </p>
          <div className="mt-4 space-y-4">
            <ItemList
              title="Included in your share"
              empty="No included items for this participant."
              items={included.map((item) => ({
                id: item.itemId,
                label: item.label,
                amount: item.amount,
                detail: `${formatKrw(item.shareByParticipant?.[participantId] ?? 0)} of ${formatKrw(item.amount)}`,
                meta: `${item.eligibleParticipantIds.length} included`
              }))}
            />
            <ItemList
              title="Excluded from your share"
              empty="No exclusions for this participant."
              items={excluded.map((item) => ({
                id: item.itemId,
                label: item.label,
                amount: item.amount,
                detail: "You pay ₩0 for this item.",
                meta: exclusionReason(proposal, item.itemId, participantId)
              }))}
            />
          </div>
        </div>

        <div className="space-y-4">
          <CreditsAndClaims records={paymentClaims} />
          <section className="rounded-lg border border-app-border bg-white p-4" data-testid="participant-reply-state">
            <h2 className="text-base font-bold text-app-text">Your reply</h2>
            <p className="mt-1 text-sm font-semibold text-app-text">{replyStatusLabel(participant?.status)}</p>
            {participant?.changeRequestNote ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-app-text">
                Change requested - waiting for organizer review. {participant.changeRequestNote}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </>
  );
}

function AgreementActions({
  proposal,
  participantId,
  changeOpen,
  reason,
  paymentReference,
  onChangeOpen,
  onReasonChange,
  onPaymentReferenceChange,
  onAccept,
  onOptOut,
  onSubmitChange,
  onClaimPayment
}: {
  proposal: Proposal;
  participantId: string;
  changeOpen: boolean;
  reason: string;
  paymentReference: string;
  onChangeOpen: () => void;
  onReasonChange: (value: string) => void;
  onPaymentReferenceChange: (value: string) => void;
  onAccept: () => void;
  onOptOut: () => void;
  onSubmitChange: () => void;
  onClaimPayment: () => void;
}) {
  const paymentClaims = (proposal.paymentRecords ?? []).filter((record) => record.fromParticipantId === participantId && record.status !== "void");
  return (
    <>
      <section className="rounded-lg border border-app-border bg-white p-4">
        <h2 className="text-base font-bold text-app-text">Agreement actions</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ActionButton icon={Check} label="I'm in" onClick={onAccept} testId="participant-accept" />
          <ActionButton icon={MessageSquareWarning} label="Request a change" onClick={onChangeOpen} testId="participant-request-change-open" />
          <ActionButton icon={XCircle} label="Opt out" onClick={onOptOut} testId="participant-opt-out" />
          <ActionButton icon={CreditCard} label={paymentClaims.length > 0 ? "Add payment reference" : "Claim I paid"} onClick={onClaimPayment} testId="participant-claim-paid" />
        </div>
        <label className="mt-4 block text-sm font-semibold text-app-text" htmlFor="payment-reference-input">
          Payment reference
        </label>
        <input
          id="payment-reference-input"
          data-testid="payment-reference-input"
          value={paymentReference}
          onChange={(event) => onPaymentReferenceChange(event.target.value)}
          placeholder="No bank verification in prototype"
          className="mt-2 h-11 w-full rounded-lg border border-app-border bg-white px-3 text-sm outline-none focus:border-app-blue focus:ring-2 focus:ring-blue-100"
        />

        {changeOpen ? (
          <div className="mt-4 rounded-lg border border-app-border bg-slate-50 p-3" data-testid="change-request-form">
            <div className="flex flex-wrap gap-2">
              {changeReasonChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onReasonChange(chip)}
                  className="min-h-10 rounded-md border border-app-border bg-white px-3 text-sm font-semibold text-app-text hover:bg-blue-50"
                >
                  {chip}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm font-semibold text-app-text" htmlFor="change-reason-input">
              Change request
            </label>
            <textarea
              id="change-reason-input"
              data-testid="change-reason-input"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none focus:border-app-blue focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              data-testid="participant-request-changes"
              onClick={onSubmitChange}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-app-blue px-4 text-sm font-bold text-white hover:bg-blue-700 sm:w-auto"
            >
              Submit change request
            </button>
          </div>
        ) : null}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-app-border bg-white/95 px-4 py-3 backdrop-blur md:hidden" data-testid="mobile-share-action-bar">
        <div className="mx-auto flex max-w-xl gap-2">
          <button type="button" onClick={onAccept} className="min-h-11 flex-1 rounded-lg bg-app-blue px-3 text-sm font-bold text-white">
            I'm in
          </button>
          <button type="button" onClick={onChangeOpen} className="min-h-11 flex-1 rounded-lg border border-app-border bg-white px-3 text-sm font-bold text-app-text">
            Request change
          </button>
        </div>
      </div>
    </>
  );
}

function SimulationNote({ name }: { name: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-slate-50 px-3 py-2 text-sm leading-6 text-app-muted" data-testid="participant-simulation-note">
      Reviewer simulation: viewing as {name}. Change profile from the sidebar footer.
    </div>
  );
}

function amountLabel(netBalance: number) {
  if (netBalance < 0) return `You owe ${formatKrw(Math.abs(netBalance))}`;
  if (netBalance > 0) return `You receive ${formatKrw(netBalance)}`;
  return "No payment needed";
}

function deriveParticipantDecisionStatus(status: string | undefined, claimed?: PaymentRecord, confirmed?: PaymentRecord) {
  if (confirmed) return "Confirmed by organizer";
  if (claimed) return "Claimed paid";
  if (status === "accepted") return "Accepted";
  if (status === "requested_changes") return "Change requested";
  if (status === "opted_out") return "Opted out";
  return "Waiting for your confirmation";
}

function deriveNextAction(status: string | undefined, excludedCount: number, hasClaimedPayment: boolean, hasConfirmedPayment: boolean) {
  if (hasConfirmedPayment) return "Your payment claim is confirmed by organizer.";
  if (hasClaimedPayment) return "Your payment claim needs organizer confirmation.";
  if (status === "requested_changes") return "Your change request is waiting for organizer review.";
  if (status === "accepted") return excludedCount > 0 ? "Review your exclusions before accepting." : "No action needed unless something looks wrong.";
  if (status === "opted_out") return "You opted out. The organizer needs to review the split.";
  return excludedCount > 0 ? "Review your exclusions before accepting." : "Confirm before the organizer books.";
}

function exclusionReason(proposal: Proposal, itemId: string, participantId: string) {
  const item = proposal.costItems.find((costItem) => costItem.id === itemId);
  if (item?.excludedParticipantIds?.includes(participantId)) return "Explicitly excluded";
  if (item?.includedParticipantIds && !item.includedParticipantIds.includes(participantId)) return "Not in included participants";
  return "Not eligible for this item";
}

function ItemList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; label: string; amount: number; detail: string; meta: string }> }) {
  return (
    <section>
      <h3 className="text-sm font-bold text-app-text">{title}</h3>
      <div className="mt-2 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-md border border-app-border bg-slate-50 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="break-words text-sm font-semibold text-app-text">{item.label}</div>
                  <div className="mt-1 text-xs leading-5 text-app-muted">{item.meta}</div>
                </div>
                <div className="shrink-0 text-right text-sm font-bold text-app-text">{formatKrw(item.amount)}</div>
              </div>
              <div className="mt-2 text-sm leading-5 text-app-muted">{item.detail}</div>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-app-border bg-slate-50 px-3 py-2 text-sm text-app-muted">{empty}</p>
        )}
      </div>
    </section>
  );
}

function CreditsAndClaims({ records }: { records: PaymentRecord[] }) {
  return (
    <section className="rounded-lg border border-app-border bg-white p-4" data-testid="credits-payment-claims">
      <h2 className="text-base font-bold text-app-text">Credits and payment claims</h2>
      <div className="mt-3 space-y-2">
        {records.length > 0 ? (
          records.map((record) => (
            <div key={record.id} className="rounded-md border border-app-border bg-slate-50 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-app-text">Payment claim</div>
                  <div className="mt-1 leading-5 text-app-muted">{record.proofNote ?? record.reference ?? "No reference added."}</div>
                </div>
                <div className="shrink-0 text-right font-bold text-app-text">{formatKrw(record.amount)}</div>
              </div>
              <div className={record.status === "confirmed" ? "mt-2 text-sm font-semibold text-app-green" : "mt-2 text-sm font-semibold text-app-amber"}>
                {record.status === "confirmed" ? "Confirmed by organizer" : "Needs organizer confirmation"}
              </div>
              <div className="mt-1 text-xs text-app-muted">No bank verification in prototype.</div>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-app-border bg-slate-50 px-3 py-2 text-sm text-app-muted">
            No payment claim yet. Claim I paid only adds a participant claim; organizer confirmation is still required.
          </p>
        )}
      </div>
    </section>
  );
}

function ActionButton({ icon: Icon, label, onClick, testId }: { icon: ComponentType<{ className?: string }>; label: string; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-app-border bg-white px-3 text-sm font-semibold text-app-text hover:bg-slate-50"
    >
      <Icon className="h-4 w-4 text-app-blue" aria-hidden="true" />
      {label}
    </button>
  );
}

function replyStatusLabel(status: string | undefined): string {
  if (status === "accepted") return "I'm In";
  if (status === "requested_changes") return "Change requested";
  if (status === "opted_out") return "Opted out";
  return humanStatus(status ?? "pending");
}
