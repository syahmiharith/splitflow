"use client";

import Link from "next/link";
import { AlertTriangle, Check, FileText, ListChecks, Plus, ShieldCheck, Users, WalletCards } from "lucide-react";
import { deriveGlobalAnalytics } from "@/lib/analytics";
import { formatKrw, humanStatus } from "@/lib/format";
import { deriveActionQueue, deriveReadinessSummary } from "@/lib/readiness";
import { useSplitFlow } from "@/lib/store";
import { AppCard } from "@/components/ui/app-card";

export default function HomePage() {
  const { state, activeGroup } = useSplitFlow();
  const summary = deriveGlobalAnalytics(state.groups);
  const recent = state.groups.flatMap((group) => group.proposals.slice(0, 2).map((proposal) => ({ group, proposal }))).slice(0, 5);
  const activeProposal = activeGroup.proposals[0];
  const readiness = activeProposal ? deriveReadinessSummary(activeProposal) : undefined;
  const nextAction = deriveActionQueue(activeGroup)[0];

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="home-route">
      <AppCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-app-blue">Agreement before payment</p>
            <h2 className="mt-2 text-2xl font-bold text-app-text">SplitFlow helps organizers get agreement before they front group expenses.</h2>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              The Han River BBQ demo turns messy cost context into a proposal artifact, deterministic math audit, participant review loop, and settlement readiness check.
            </p>
          </div>
          <Link href={`/groups/${activeGroup.id}/chat`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-app-blue px-4 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Open {activeGroup.name}
          </Link>
        </div>
      </AppCard>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Metric icon={Users} label="Active groups" value={String(summary.activeGroups)} tone="blue" />
        <Metric icon={FileText} label="Open splits" value={String(summary.openProposals)} tone="blue" />
        <Metric icon={AlertTriangle} label="Urgent changes" value={String(summary.unresolvedChangeRequests)} tone="amber" />
        <Metric icon={WalletCards} label="Still owed" value={formatKrw(summary.stillOwed)} tone="green" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <AppCard className="p-5" data-testid="global-next-action-card">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-app-amber">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-app-text">Global next best action</h2>
              <p className="mt-2 text-sm leading-6 text-app-muted">
                {activeGroup.id === "han-river-bbq"
                  ? "Daniel has a BBQ meat exclusion and Sarah's claimed ₩10,000 payment needs confirmation. Review before settlement."
                  : nextAction
                    ? `${nextAction.title}. ${nextAction.description}`
                    : "Review the active proposal before settlement."}
              </p>
              {readiness ? (
                <p className="mt-3 text-sm font-semibold text-app-text">Settlement readiness: {readiness.title}. Next: {readiness.nextAction}.</p>
              ) : null}
            </div>
          </div>
        </AppCard>

        <AppCard className="p-5" data-testid="demo-guide-card">
          <div className="flex items-center gap-2 text-sm font-bold text-app-text">
            <ListChecks className="h-4 w-4 text-app-blue" aria-hidden="true" />
            Reviewer path
          </div>
          <ol className="mt-3 space-y-2 text-sm leading-5 text-app-muted">
            {[
              "Open Han River BBQ Crew",
              "Generate proposal in Chat",
              "Review artifact and send proposal",
              "Simulate Daniel's change",
              "Confirm or dispute Sarah's claimed payment",
              "Review settlement readiness"
            ].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </AppCard>
      </div>

      <AppCard className="p-5" data-testid="productivity-proof-card">
        <h2 className="text-lg font-bold text-app-text">What SplitFlow replaces</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ProofList
            title="Manual friction"
            items={["Manual cost collection", "Repeated clarification in chat", "Spreadsheet recalculation", "Unclear exclusions", "Payment-status tracking"]}
          />
          <ProofList
            title="Agreement workflow"
            items={["Proposal artifacts", "Deterministic split math", "Participant response tracking", "Change-request resolution", "Settlement readiness"]}
          />
        </div>
      </AppCard>

      <AppCard className="overflow-hidden">
        <div className="border-b border-app-border px-5 py-4 text-lg font-bold">Recent activity</div>
        <div className="divide-y divide-app-border">
          {recent.map(({ group, proposal }) => (
            <Link key={`${group.id}-${proposal.id}`} href={`/groups/${group.id}/proposals`} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-app-blue">
                <Check className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{proposal.title}</div>
                <div className="text-sm text-app-muted">{group.name} · {humanStatus(proposal.status)}</div>
              </div>
              <span className="font-semibold">{formatKrw(proposal.totalCost)}</span>
            </Link>
          ))}
        </div>
      </AppCard>
    </div>
  );
}

function ProofList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-app-border bg-slate-50 p-3">
      <div className="text-sm font-bold text-app-text">{title}</div>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-app-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone: "blue" | "amber" | "green" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-app-border bg-white p-3 shadow-[0_1px_2px_rgba(24,33,47,0.04)] sm:p-4">
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-full ${tone === "amber" ? "bg-amber-50 text-app-amber" : tone === "green" ? "bg-green-50 text-app-green" : "bg-blue-50 text-app-blue"}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="text-xs leading-tight text-app-muted sm:text-sm">{label}</div>
      <div className="mt-1 whitespace-nowrap text-lg font-bold text-app-text sm:text-xl">{value}</div>
    </div>
  );
}
