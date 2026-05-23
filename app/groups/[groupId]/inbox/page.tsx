"use client";

import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, CreditCard, MessageSquareWarning, UserRoundCheck } from "lucide-react";
import { GroupRouteSync } from "@/components/group-route-sync";
import { DemoToolbar } from "@/components/demo-toolbar";
import { StatusBadge } from "@/components/ui/status-badge";
import { ParticipantShareExplanation } from "@/components/readiness-widgets";
import { formatKrw, humanStatus } from "@/lib/format";
import { deriveParticipantShareExplanation } from "@/lib/readiness";
import { useSplitFlow } from "@/lib/store";

export default function GroupInboxPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const { activeGroup, activeProposal, state, setCurrentUser, respondAsParticipant, markPaid } = useSplitFlow();
  const [reason, setReason] = useState("I can only join Saturday night.");
  const proposal = activeGroup.proposals[0] ?? activeProposal;
  const selectedParticipant =
    proposal.participants.find((participant) => participant.id === state.currentUser) ??
    proposal.participants.find((participant) => participant.id !== proposal.organizerId && participant.id !== "you") ??
    proposal.participants[0];

  const participantMath = useMemo(() => {
    const calculation = proposal.calculationResult;
    if (!selectedParticipant || !calculation) return { included: [], excluded: [], share: selectedParticipant?.shareAmount ?? 0, net: 0 };
    const included = calculation.itemizedBreakdown.filter((item) => item.eligibleParticipantIds.includes(selectedParticipant.id));
    const excluded = calculation.itemizedBreakdown.filter((item) => !item.eligibleParticipantIds.includes(selectedParticipant.id));
    return {
      included,
      excluded,
      share: calculation.fairShareByParticipant[selectedParticipant.id] ?? selectedParticipant.shareAmount,
      net: calculation.netBalanceByParticipant[selectedParticipant.id] ?? 0
    };
  }, [proposal, selectedParticipant]);
  const shareExplanation = useMemo(
    () => deriveParticipantShareExplanation(proposal, selectedParticipant?.id ?? proposal.participants[0]?.id ?? ""),
    [proposal, selectedParticipant]
  );

  if (!selectedParticipant) {
    return (
      <div className="px-4 py-5 md:p-6" data-testid="inbox-route">
        <GroupRouteSync groupId={groupId} />
        <DemoToolbar compact />
        <div className="rounded-lg border border-app-border bg-white p-5">No notifications are available for this group yet.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="inbox-route">
      <GroupRouteSync groupId={groupId} />
      <DemoToolbar compact showLoaders={false} />

      <section className="rounded-lg border border-app-border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-app-muted">Reviewer mode</p>
            <h1 className="mt-1 text-xl font-bold text-app-text">{selectedParticipant.name}</h1>
            <p className="mt-1 text-sm text-app-muted">Switch friends to test the review flow. This is simulated, not production login.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {proposal.participants.map((participant) => (
              <button
                key={participant.id}
                type="button"
                data-testid={`participant-switch-${participant.id}`}
                onClick={() => setCurrentUser(participant.id)}
                className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${
                  selectedParticipant.id === participant.id ? "border-app-blue bg-blue-50 text-app-blue" : "border-app-border bg-white text-app-text hover:bg-slate-50"
                }`}
              >
                {participant.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-app-border bg-white p-4" data-testid="participant-inbox-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-app-text">{proposal.title}</h2>
              <StatusBadge status={proposal.status} />
            </div>
            <p className="mt-1 text-sm font-semibold text-app-text">{proposal.organizerName} sent you Your Share.</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-app-muted">
              Review what you are included in, then tap I'm In, ask for a change, or opt out before anyone books.
            </p>
          </div>
          <div className="rounded-lg border border-app-border bg-slate-50 px-4 py-3 text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">Your share</div>
            <div className="mt-1 text-2xl font-bold text-app-text">{formatKrw(participantMath.share)}</div>
            <div className={participantMath.net < 0 ? "mt-1 text-sm font-semibold text-app-red" : "mt-1 text-sm font-semibold text-app-green"}>
              {participantMath.net < 0 ? "Pays" : "Receives"} {formatKrw(Math.abs(participantMath.net))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ParticipantShareExplanation explanation={shareExplanation} />
        </div>

        <div className="mt-4 rounded-lg border border-app-border bg-slate-50 p-3">
          <div className="text-sm font-bold">Your reply</div>
          <div className="mt-1 text-sm text-app-muted">{humanStatus(selectedParticipant.status)}</div>
          {selectedParticipant.changeRequestNote ? <div className="mt-2 text-sm text-app-red">{selectedParticipant.changeRequestNote}</div> : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <ActionButton icon={Check} label="I'm In" onClick={() => respondAsParticipant(selectedParticipant.id, "accepted", undefined, proposal.id)} testId="participant-accept" />
          <ActionButton icon={MessageSquareWarning} label="Ask for a Change" onClick={() => respondAsParticipant(selectedParticipant.id, "requested_changes", reason, proposal.id)} testId="participant-request-changes" />
          <ActionButton icon={UserRoundCheck} label="I'm Out" onClick={() => respondAsParticipant(selectedParticipant.id, "opted_out", "I'm out for this trip split.", proposal.id)} testId="participant-opt-out" />
          <ActionButton icon={CreditCard} label="Mark Paid" onClick={() => markPaid(selectedParticipant.id, proposal.id)} testId="participant-mark-paid" />
        </div>
        <label className="mt-3 block text-sm font-semibold text-app-text" htmlFor="change-reason-input">
          Change note
        </label>
        <textarea
          id="change-reason-input"
          data-testid="change-reason-input"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 min-h-24 w-full rounded-lg border border-app-border bg-white px-3 py-2 text-sm outline-none focus:border-app-blue focus:ring-2 focus:ring-blue-100"
        />
      </section>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  testId
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  testId: string;
}) {
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
