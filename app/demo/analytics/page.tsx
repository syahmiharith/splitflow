"use client";

import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, ChevronRight, CircleDollarSign, Database, Edit3, Lightbulb, Scale, ShieldCheck, WalletCards } from "lucide-react";
import { AppCard } from "@/components/ui/app-card";
import { deriveOperationalAnalytics } from "@/lib/analytics";
import { formatKrw, humanStatus } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";

export default function AnalyticsPage() {
  const { state } = useSplitFlow();
  const analytics = deriveOperationalAnalytics(state.groups);
  const collectionRate = `${analytics.collectionRate}%`;

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="analytics-route">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <MoneyMetric icon={WalletCards} label="Paid Upfront" value={formatKrw(analytics.totalFronted)} tone="blue" />
        <MoneyMetric icon={ShieldCheck} label="Recovered" value={formatKrw(analytics.recovered)} tone="green" />
        <MoneyMetric icon={AlertTriangle} label="Still Owed" value={formatKrw(analytics.stillOwed)} tone="amber" />
      </div>

      <AppCard className="p-5">
        <div className="mb-4 flex items-center gap-3 border-b border-app-border pb-4">
          <Bars />
          <h2 className="text-2xl font-bold">This Month</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
          <div
            className="mx-auto grid h-44 w-44 place-items-center rounded-full p-4"
            style={{ background: `conic-gradient(#15803d 0 ${analytics.collectionRate}%, #dcfce7 ${analytics.collectionRate}% 100%)` }}
          >
            <div className="grid h-full w-full place-items-center rounded-full bg-white text-center">
              <div>
                <div className="text-4xl font-bold">{collectionRate}</div>
                <div className="text-sm text-app-muted">Collection Rate</div>
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <SideMetric icon={Database} label="Total Shared Expenses" value={formatKrw(analytics.totalFronted)} tone="blue" />
            <SideMetric icon={ShieldCheck} label="Recovered" value={formatKrw(analytics.recovered)} tone="green" />
          </div>
        </div>
      </AppCard>

      <AppCard className="p-5">
        <div className="mb-3 flex items-center gap-3 border-b border-app-border pb-4">
          <AlertTriangle className="h-8 w-8 text-app-blue" aria-hidden="true" />
          <h2 className="text-2xl font-bold">Friction Signals</h2>
        </div>
        {analytics.frequentChangeRequesters.length > 0 ? (
          analytics.frequentChangeRequesters.map((item) => (
            <Signal key={item.participantId} icon={Edit3} text={`${item.participantName} requested changes ${item.count} time${item.count === 1 ? "" : "s"}`} tone="amber" />
          ))
        ) : (
          <Signal icon={Edit3} text="No repeat change requester yet" tone="amber" />
        )}
        {analytics.slowResponseGroups.length > 0 ? (
          analytics.slowResponseGroups.map((item) => (
            <Signal key={item.groupId} icon={ClockIcon} text={`${item.groupName} has ${item.pendingResponses} pending response${item.pendingResponses === 1 ? "" : "s"}`} tone="red" />
          ))
        ) : (
          <Signal icon={ClockIcon} text="No slow-response group right now" tone="red" />
        )}
        {analytics.disputeProneMethods.length > 0 ? (
          analytics.disputeProneMethods.map((item) => (
            <Signal key={item.method} icon={Scale} text={`${humanStatus(item.method)} caused ${item.count} dispute signal${item.count === 1 ? "" : "s"}`} tone="violet" />
          ))
        ) : (
          <Signal icon={Scale} text="No dispute-prone split method yet" tone="violet" />
        )}
      </AppCard>

      <AppCard className="p-5">
        <div className="mb-3 flex items-center gap-3 border-b border-app-border pb-4">
          <Lightbulb className="h-8 w-8 text-app-blue" aria-hidden="true" />
          <h2 className="text-2xl font-bold">Insights</h2>
        </div>
        <Insight text={<><strong>{formatKrw(analytics.stillOwed)}</strong> is still owed across active agreements.</>} />
        <Insight text={<><strong>{collectionRate}</strong> of recoverable money is confirmed recovered.</>} />
        <Insight text={<><strong>{analytics.slowResponseGroups[0]?.groupName ?? "No group"}</strong> is the current response follow-up focus.</>} />
      </AppCard>
    </div>
  );
}

type IconComponent = ComponentType<{ className?: string }>;

function MoneyMetric({ icon: Icon, label, value, tone }: { icon: IconComponent; label: string; value: string; tone: "blue" | "green" | "amber" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-app-border bg-white p-3 text-center shadow-[0_1px_2px_rgba(24,33,47,0.04)] sm:p-4">
      <div className={`mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full sm:h-12 sm:w-12 ${tone === "green" ? "bg-green-50 text-app-green" : tone === "amber" ? "bg-amber-50 text-app-amber" : "bg-blue-50 text-app-blue"}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="text-xs leading-tight text-app-muted sm:text-sm">{label}</div>
      <div className="mt-2 whitespace-nowrap text-lg font-bold sm:text-xl">{value}</div>
    </div>
  );
}

function SideMetric({ icon: Icon, label, value, tone }: { icon: IconComponent; label: string; value: string; tone: "blue" | "green" }) {
  return (
    <div className="flex items-center gap-4">
      <div className={`grid h-14 w-14 place-items-center rounded-full ${tone === "green" ? "bg-green-50 text-app-green" : "bg-blue-50 text-app-blue"}`}>
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <div>
        <div className="text-base text-app-muted">{label}</div>
        <div className="text-2xl font-bold sm:text-3xl">{value}</div>
      </div>
    </div>
  );
}

function Signal({ icon: Icon, text, tone }: { icon: IconComponent; text: string; tone: "amber" | "red" | "violet" }) {
  return (
    <button type="button" className="flex min-h-16 w-full items-center gap-4 border-b border-app-border py-3 text-left last:border-b-0">
      <div className={`grid h-12 w-12 place-items-center rounded-full ${tone === "amber" ? "bg-amber-50 text-app-amber" : tone === "red" ? "bg-red-50 text-app-red" : "bg-violet-50 text-app-violet"}`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <span className="min-w-0 flex-1 text-lg font-medium">{text}</span>
      <ChevronRight className="h-5 w-5 text-app-muted" aria-hidden="true" />
    </button>
  );
}

function Insight({ text }: { text: ReactNode }) {
  return (
    <button type="button" className="flex min-h-14 w-full items-center gap-4 border-b border-app-border py-3 text-left last:border-b-0">
      <span className="h-3 w-3 shrink-0 rounded-full bg-app-blue" />
      <span className="min-w-0 flex-1 text-lg">{text}</span>
      <ChevronRight className="h-5 w-5 text-app-muted" aria-hidden="true" />
    </button>
  );
}

function Bars() {
  return (
    <span className="flex h-8 w-9 shrink-0 items-end gap-1.5" aria-hidden="true">
      <span className="h-5 w-2 rounded-full bg-app-blue" />
      <span className="h-7 w-2 rounded-full bg-app-blue" />
      <span className="h-8 w-2 rounded-full bg-app-blue" />
    </span>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return <CircleDollarSign className={className} aria-hidden="true" />;
}
