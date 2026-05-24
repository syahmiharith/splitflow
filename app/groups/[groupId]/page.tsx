"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, MessageCircle, ShieldCheck, Users, WalletCards } from "lucide-react";
import { useParams } from "next/navigation";
import { deriveGroupAnalytics } from "@/lib/analytics";
import { formatKrw } from "@/lib/format";
import { deriveActionQueue, deriveReadinessSummary } from "@/lib/readiness";
import { useSplitFlow } from "@/lib/store";
import { GroupRouteSync } from "@/components/group-route-sync";
import { ActionQueueList } from "@/components/readiness-widgets";
import { AppCard } from "@/components/ui/app-card";

export default function GroupOverviewPage() {
  const params = useParams<{ groupId: string }>();
  const { activeGroup } = useSplitFlow();
  const summary = deriveGroupAnalytics(activeGroup);
  const queue = deriveActionQueue(activeGroup);
  const proposal = activeGroup.proposals[0];
  const readiness = proposal ? deriveReadinessSummary(proposal) : undefined;
  const claimedCount = proposal?.paymentRecords?.filter((record) => record.status === "claimed").length ?? 0;
  const hasDanielExclusion = Boolean(proposal?.costItems.some((item) => item.id === "meat" && item.excludedParticipantIds?.includes("daniel")));

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="group-overview-route">
      <GroupRouteSync groupId={params.groupId} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Metric icon={Users} label="Members" value={String(activeGroup.members.length)} tone="blue" />
        <Metric icon={FileText} label="Open splits" value={String(summary.activeProposals)} tone="blue" />
        <Metric icon={AlertTriangle} label="Change requests" value={String(summary.openChangeRequests)} tone="amber" />
        <Metric icon={WalletCards} label="Still owed" value={formatKrw(summary.stillOwed)} tone="green" />
      </div>

      <ActionQueueList items={queue} groupId={activeGroup.id} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <AppCard className="p-5" data-testid="agreement-health">
          <h2 className="text-lg font-bold text-app-text">Agreement Health</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-7">
            {["Draft", "Sent", "Responses", "Change requested", "Reconfirmation", "Ready to settle", "Settled"].map((step, index) => (
              <div key={step} className={`rounded-lg border px-3 py-2 text-sm ${index === 0 ? "border-blue-200 bg-blue-50 text-app-blue" : "border-app-border bg-slate-50 text-app-muted"}`}>
                <div className="font-bold">{step}</div>
              </div>
            ))}
          </div>
        </AppCard>

        <AppCard className="p-5" data-testid="settlement-readiness-card">
          <div className="flex items-center gap-2 text-sm font-bold text-app-text">
            <ShieldCheck className="h-4 w-4 text-app-blue" aria-hidden="true" />
            Settlement Readiness
          </div>
          <p className="mt-3 text-sm leading-6 text-app-muted">
            {readiness
              ? `${readiness.title}: ${readiness.blockers.length > 0 ? readiness.blockers.join(" ") : readiness.message}`
              : "No active proposal yet."}
          </p>
          {claimedCount > 0 ? <p className="mt-2 text-sm font-semibold text-app-amber">{claimedCount} claimed payment needs confirmation.</p> : null}
        </AppCard>
      </div>

      <AppCard className="p-5" data-testid="blocking-progress-card">
        <h2 className="text-lg font-bold text-app-text">Who is blocking progress</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Blocker name="Daniel" status={hasDanielExclusion ? "Meat exclusion under review" : "Needs meat exclusion review"} detail="He does not eat beef, so he should not be charged for meat." />
          <Blocker name="Sarah" status="Claimed ₩10,000 needs confirmation" detail="This is a note from the participant, not verified money." />
          <Blocker name="Ali" status="Risk threshold" detail="May request a change if his share exceeds ₩20,000." />
        </div>
      </AppCard>

      <AppCard className="p-5">
        <h2 className="text-xl font-bold">{activeGroup.name}</h2>
        <p className="mt-2 text-sm text-app-muted">{activeGroup.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/groups/${activeGroup.id}/chat`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-app-blue px-3 text-sm font-semibold text-white">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Open chat artifact
          </Link>
          <Link href={`/groups/${activeGroup.id}/proposals`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-text">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Review BBQ proposal
          </Link>
          <Link href={`/groups/${activeGroup.id}/inbox`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-text">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Resolve participant changes
          </Link>
        </div>
      </AppCard>
    </div>
  );
}

function Blocker({ name, status, detail }: { name: string; status: string; detail: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-slate-50 p-3">
      <div className="font-bold text-app-text">{name}</div>
      <div className="mt-1 text-sm font-semibold text-app-blue">{status}</div>
      <p className="mt-2 text-sm leading-5 text-app-muted">{detail}</p>
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
