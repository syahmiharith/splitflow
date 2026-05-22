"use client";

import Link from "next/link";
import { AlertTriangle, FileText, MessageCircle, Users, WalletCards } from "lucide-react";
import { useParams } from "next/navigation";
import { formatKrw } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import { GroupRouteSync } from "@/components/group-route-sync";
import { AppCard } from "@/components/ui/app-card";

export default function GroupOverviewPage() {
  const params = useParams<{ groupId: string }>();
  const { activeGroup } = useSplitFlow();
  const summary = activeGroup.analyticsSummary;

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="group-overview-route">
      <GroupRouteSync groupId={params.groupId} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Metric icon={Users} label="Members" value={String(activeGroup.members.length)} tone="blue" />
        <Metric icon={FileText} label="Open proposals" value={String(summary.activeProposals)} tone="blue" />
        <Metric icon={AlertTriangle} label="Change requests" value={String(summary.openChangeRequests)} tone="amber" />
        <Metric icon={WalletCards} label="Still owed" value={formatKrw(summary.stillOwed)} tone="green" />
      </div>

      <AppCard className="p-5">
        <h2 className="text-xl font-bold">{activeGroup.name}</h2>
        <p className="mt-2 text-sm text-app-muted">{activeGroup.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/groups/${activeGroup.id}/chat`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-app-blue px-3 text-sm font-semibold text-white">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Open group chat
          </Link>
          <Link href={`/groups/${activeGroup.id}/proposals`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-text">
            <FileText className="h-4 w-4" aria-hidden="true" />
            View proposals
          </Link>
        </div>
      </AppCard>
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
