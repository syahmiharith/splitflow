"use client";

import { Bot, Check, CheckCircle2, ChevronDown, ClipboardList, Edit3, Info, ListChecks, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatKrw, humanStatus } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import type { UserMode } from "@/lib/types";
import { DemoToolbar } from "@/components/demo-toolbar";
import { AppCard } from "@/components/ui/app-card";

export default function InboxPage() {
  const { activeProposal, state, setCurrentUser, respondAsParticipant, markPaid } = useSplitFlow();
  const [specialOpen, setSpecialOpen] = useState(true);
  const [changeReason, setChangeReason] = useState("I did not eat beef");
  const participantModes = activeProposal.participants.map((participant) => participant.id as UserMode);
  const selected = state.currentUser === "organizer" ? activeProposal.participants.find((participant) => participant.id !== activeProposal.organizerId)?.id : state.currentUser;
  const participant = activeProposal.participants.find((item) => item.id === selected) ?? activeProposal.participants[0];
  const calculation = activeProposal.calculationResult;
  const included = useMemo(
    () => activeProposal.costItems.filter((item) => calculation?.itemizedBreakdown.find((row) => row.itemId === item.id)?.eligibleParticipantIds.includes(participant.id)),
    [activeProposal.costItems, calculation?.itemizedBreakdown, participant.id]
  );
  const excluded = activeProposal.costItems.filter((item) => !included.some((includedItem) => includedItem.id === item.id));
  const net = calculation?.netBalanceByParticipant[participant.id] ?? -participant.shareAmount;

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="inbox-route">
      <DemoToolbar compact showLoaders={false} />
      <div className="rounded-2xl border border-app-border bg-white p-3 md:rounded-lg">
        <div className="mb-2 text-sm font-semibold text-app-muted">Viewing as</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {participantModes.map((mode) => {
            const person = activeProposal.participants.find((item) => item.id === mode);
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setCurrentUser(mode)}
                data-testid={`participant-switch-${mode}`}
                className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold ${
                  participant.id === mode ? "border-blue-200 bg-blue-50 text-app-blue" : "border-app-border bg-white text-app-muted"
                }`}
              >
                {person?.name ?? mode}
              </button>
            );
          })}
        </div>
      </div>

      <AppCard className="p-5" data-testid="participant-inbox-card">
        <div className="mb-4 flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-app-blue">
            <Bot className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold">{activeProposal.organizerName} sent you a split proposal</h2>
        </div>
        <div className="grid gap-4 rounded-2xl border border-app-border p-4 sm:grid-cols-2">
          <div>
            <div className="text-base text-app-muted">Event</div>
            <div className="mt-1 text-3xl font-bold">{activeProposal.title}</div>
            <div className="mt-4 text-base text-app-muted">Status</div>
            <span className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-app-text">
              <ClockBadge />
              {participant.status === "pending" ? "Waiting for your response" : humanStatus(participant.status)}
            </span>
          </div>
          <div className="border-t border-app-border pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            <div className="text-center text-base text-app-muted">{net > 0 ? "You should receive" : "Your fair share"}</div>
            <div className={`mt-4 text-center text-5xl font-bold leading-none sm:text-6xl ${net > 0 ? "text-app-green" : "text-app-blue"}`}>
              {formatKrw(net > 0 ? net : participant.shareAmount)}
            </div>
          </div>
        </div>
      </AppCard>

      <AppCard className="flex gap-4 p-5">
        <Info className="mt-1 h-8 w-8 shrink-0 text-app-blue" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold">Why am I paying this?</h2>
          <p className="mt-3 text-lg leading-8 text-app-text">
            Your share is the sum of eligible item shares. Net balance compares what you paid with your fair share: positive means you receive money; negative means you pay.
          </p>
        </div>
      </AppCard>

      <AppCard className="p-5">
        <div className="mb-3 flex items-center gap-3">
          <ListChecks className="h-8 w-8 text-app-blue" aria-hidden="true" />
          <h2 className="text-xl font-bold">Included items in your share</h2>
        </div>
        <ItemList items={included} participantId={participant.id} proposalId={activeProposal.id} included />
      </AppCard>

      <AppCard className="p-5">
        <div className="mb-3 flex items-center gap-3">
          <X className="h-8 w-8 text-app-red" aria-hidden="true" />
          <h2 className="text-xl font-bold">Excluded items</h2>
        </div>
        <ItemList items={excluded} participantId={participant.id} proposalId={activeProposal.id} included={false} />
      </AppCard>

      <AppCard className="p-4">
        <button type="button" onClick={() => setSpecialOpen((open) => !open)} className="flex w-full items-center gap-4 text-left" aria-expanded={specialOpen}>
          <ClipboardList className="h-8 w-8 text-app-blue" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold">Agreement note</div>
            {specialOpen ? <div className="mt-1 text-base text-app-muted">{activeProposal.fairnessNote}</div> : null}
          </div>
          <ChevronDown className={`h-6 w-6 text-app-text transition ${specialOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </AppCard>

      <label className="block rounded-2xl border border-app-border bg-white p-4">
        <span className="text-sm font-semibold text-app-muted">Request-change reason</span>
        <textarea
          data-testid="change-reason-input"
          value={changeReason}
          onChange={(event) => setChangeReason(event.target.value)}
          className="mt-2 min-h-20 w-full resize-none rounded-xl border border-app-border px-3 py-2 text-sm outline-none focus:border-app-blue"
        />
      </label>

      <div className="space-y-3">
        <ResponseButton testId="participant-accept" icon={Check} title="Accept" subtitle="Confirm and proceed" tone="primary" onClick={() => respondAsParticipant(participant.id, "accepted")} />
        <ResponseButton
          testId="participant-request-changes"
          icon={Edit3}
          title="Request change"
          subtitle="Send this note to the organizer"
          tone="blue"
          onClick={() => respondAsParticipant(participant.id, "requested_changes", changeReason)}
        />
        <ResponseButton testId="participant-opt-out" icon={X} title="Opt out" subtitle="Remove me from this split" tone="red" onClick={() => respondAsParticipant(participant.id, "opted_out")} />
        <ResponseButton testId="participant-mark-paid" icon={CheckCircle2} title="Mark paid" subtitle="Simulate payment confirmation" tone="blue" onClick={() => markPaid(participant.id)} />
      </div>
    </div>
  );
}

function ItemList({ items, included }: { items: Array<{ id: string; label: string; amount: number }>; participantId: string; proposalId: string; included: boolean }) {
  if (items.length === 0) return <div className="rounded-lg border border-app-border bg-slate-50 px-3 py-3 text-sm text-app-muted">No items.</div>;
  return (
    <div className="divide-y divide-app-border">
      {items.map((item) => (
        <div key={item.id} className="flex min-h-16 items-center gap-4 py-3">
          <div className={`grid h-12 w-12 place-items-center rounded-xl ${included ? "bg-blue-50 text-app-blue" : "bg-red-50 text-app-red"}`}>
            {included ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <X className="h-6 w-6" aria-hidden="true" />}
          </div>
          <span className="min-w-0 flex-1 text-lg">{item.label}</span>
          <span className="font-semibold">{formatKrw(item.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function ResponseButton({ testId, icon: Icon, title, subtitle, tone, onClick }: { testId: string; icon: typeof Check; title: string; subtitle: string; tone: "primary" | "blue" | "red"; onClick: () => void }) {
  const primary = tone === "primary";
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`flex min-h-20 w-full items-center justify-center gap-4 rounded-2xl border px-5 text-left ${
        primary
          ? "border-app-blue bg-app-blue text-white"
          : tone === "red"
            ? "border-app-red bg-white text-app-text"
            : "border-app-blue bg-white text-app-text"
      }`}
    >
      <span className={`grid h-11 w-11 place-items-center rounded-full border-2 ${primary ? "border-white text-white" : tone === "red" ? "border-app-red text-app-red" : "border-app-blue text-app-blue"}`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={`block text-xl font-bold ${primary ? "text-white" : tone === "red" ? "text-app-text" : "text-app-blue"}`}>{title}</span>
        <span className={`mt-1 block text-base ${primary ? "text-blue-50" : "text-app-muted"}`}>{subtitle}</span>
      </span>
    </button>
  );
}

function ClockBadge() {
  return <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-app-amber text-app-amber">!</span>;
}
