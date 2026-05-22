"use client";

import { Bot, Check, CheckCircle2, ChevronDown, ClipboardList, Edit3, Info, ListChecks, X } from "lucide-react";
import { useState } from "react";
import { formatKrw, humanStatus } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import type { UserMode } from "@/lib/types";
import { AppCard } from "@/components/ui/app-card";

const participantModes: UserMode[] = ["ali", "sarah", "daniel", "aiman"];

const includedItems = [
  { label: "Meat", icon: FoodIcon },
  { label: "Drinks", icon: DrinkIcon },
  { label: "Charcoal", icon: FireIcon },
  { label: "Sides", icon: BowlIcon }
];

export default function InboxPage() {
  const { activeProposal, state, setCurrentUser, respondAsParticipant } = useSplitFlow();
  const [specialOpen, setSpecialOpen] = useState(true);
  const selected = state.currentUser === "organizer" ? "aiman" : state.currentUser;
  const participant = activeProposal.participants.find((item) => item.id === selected) ?? activeProposal.participants[1];
  const due = participant.id === "aiman" ? 14500 : participant.shareAmount;

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="inbox-route">
      <div className="hidden gap-2 overflow-x-auto pb-1 md:flex">
        {participantModes.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setCurrentUser(mode)}
            className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold ${
              selected === mode ? "border-blue-200 bg-blue-50 text-app-blue" : "border-app-border bg-white text-app-muted"
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      <AppCard className="p-5" data-testid="participant-inbox-card">
        <div className="mb-4 flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-app-blue">
            <Bot className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold">Syahmi sent you a split proposal</h2>
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
            <div className="text-center text-base text-app-muted">Your amount due</div>
            <div className="mt-4 text-center text-5xl font-bold leading-none text-app-blue sm:text-6xl">{formatKrw(due)}</div>
          </div>
        </div>
      </AppCard>

      <AppCard className="flex gap-4 p-5">
        <Info className="mt-1 h-8 w-8 shrink-0 text-app-blue" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold">Why am I paying this?</h2>
          <p className="mt-3 text-lg leading-8 text-app-text">Your share covers items you participated in: included in drinks, charcoal, sides, and meat.</p>
        </div>
      </AppCard>

      <AppCard className="p-5">
        <div className="mb-3 flex items-center gap-3">
          <ListChecks className="h-8 w-8 text-app-blue" aria-hidden="true" />
          <h2 className="text-xl font-bold">Included items in your share</h2>
        </div>
        <div className="divide-y divide-app-border">
          {includedItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex min-h-16 items-center gap-4 py-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-app-blue">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <span className="flex-1 text-lg">{item.label}</span>
                <CheckCircle2 className="h-8 w-8 fill-app-green text-white" aria-label={`${item.label} included`} />
              </div>
            );
          })}
        </div>
      </AppCard>

      <AppCard className="p-4">
        <button type="button" onClick={() => setSpecialOpen((open) => !open)} className="flex w-full items-center gap-4 text-left" aria-expanded={specialOpen}>
          <ClipboardList className="h-8 w-8 text-app-blue" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold">Special note</div>
            {specialOpen ? <div className="mt-1 text-base text-app-muted">“Daniel excluded from beef” is not applicable to you.</div> : null}
          </div>
          <ChevronDown className={`h-6 w-6 text-app-text transition ${specialOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </AppCard>

      <div className="space-y-3">
        <ResponseButton
          testId="participant-accept"
          icon={Check}
          title="Accept"
          subtitle="Confirm and proceed"
          tone="primary"
          onClick={() => respondAsParticipant(participant.id, "accepted")}
        />
        <ResponseButton
          testId="participant-request-changes"
          icon={Edit3}
          title="Request change"
          subtitle="Suggest adjustments to this proposal"
          tone="blue"
          onClick={() => respondAsParticipant(participant.id, "requested_changes", "Please adjust my included items.")}
        />
        <ResponseButton
          testId="participant-opt-out"
          icon={X}
          title="Opt out"
          subtitle="I don’t want to participate in this split"
          tone="red"
          onClick={() => respondAsParticipant(participant.id, "opted_out")}
        />
        <button type="button" className="mx-auto flex min-h-12 items-center justify-center gap-3 rounded-xl px-4 text-lg font-semibold text-app-blue">
          <Bot className="h-7 w-7" aria-hidden="true" />
          Ask AI why
        </button>
      </div>
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

function FoodIcon({ className }: { className?: string }) {
  return <span className={className}>M</span>;
}

function DrinkIcon({ className }: { className?: string }) {
  return <span className={className}>D</span>;
}

function FireIcon({ className }: { className?: string }) {
  return <span className={className}>C</span>;
}

function BowlIcon({ className }: { className?: string }) {
  return <span className={className}>S</span>;
}
