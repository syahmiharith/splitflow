"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Plus,
  ShieldCheck,
  WalletCards
} from "lucide-react";
import {
  deriveActiveWorkflows,
  deriveGlobalAnalytics,
  deriveGlobalNextAction,
  type ActiveWorkflow,
  type GlobalNextAction
} from "@/lib/analytics";
import { compactTime, formatKrw, humanStatus } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import type { TimelineEvent } from "@/lib/types";
import { AppCard } from "@/components/ui/app-card";

export default function HomePage() {
  const { state, activeGroup, resetDemo } = useSplitFlow();
  const summary = deriveGlobalAnalytics(state.groups);
  const nextAction = deriveGlobalNextAction(state.groups);
  const workflows = deriveActiveWorkflows(state.groups);
  const hasGroups = state.groups.length > 0;
  const hasSplits = state.groups.some((group) => group.proposals.length > 0);
  const primaryHref = nextAction?.href ?? (hasGroups ? `/groups/${activeGroup.id}` : "/groups");
  const primaryLabel = nextAction?.proposalId ? "Review next action" : hasGroups ? "Open active group" : "Create group";
  const chatHref = hasGroups ? `/groups/${nextAction?.groupId || activeGroup.id}/chat` : "/groups";

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="home-route">
      <section className="rounded-lg border border-app-border bg-white p-4 shadow-[0_1px_2px_rgba(24,33,47,0.04)] md:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.4fr)] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-blue">Global agreement command center</p>
            <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-app-text md:text-3xl">
              Get agreement before you front group expenses.
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Track which group splits are blocked, waiting for confirmation, or ready to settle.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              href={primaryHref}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-app-blue px-4 text-sm font-semibold text-white hover:bg-blue-700"
              data-testid="home-primary-cta"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={chatHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-blue hover:bg-slate-50"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Start from chat
              </Link>
              <Link
                href="/groups"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-text hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create group
              </Link>
            </div>
          </div>
        </div>
      </section>

      {!hasGroups ? (
        <AppCard className="p-5" data-testid="home-empty-state">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <h2 className="text-lg font-bold text-app-text">Create a group to start an agreement workflow.</h2>
              <p className="mt-2 text-sm leading-6 text-app-muted">
                Groups give each split a member list, review loop, payment-claim ledger, and settlement state.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/groups" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-app-blue px-4 text-sm font-semibold text-white">
                Create group
              </Link>
              <button
                type="button"
                onClick={resetDemo}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-app-border px-4 text-sm font-semibold text-app-blue"
              >
                Try demo group
              </button>
            </div>
          </div>
        </AppCard>
      ) : null}

      {hasGroups && !hasSplits ? (
        <AppCard className="p-5" data-testid="home-no-splits-state">
          <h2 className="text-lg font-bold text-app-text">Start in Chat.</h2>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            SplitFlow will turn your group-expense prompt into a reviewable split with deterministic math, participant review, and settlement readiness.
          </p>
          <Link href={chatHref} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-app-blue px-4 text-sm font-semibold text-white">
            Start from chat
          </Link>
        </AppCard>
      ) : null}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-5" data-testid="global-status-cards">
        <StatusMetric
          icon={AlertTriangle}
          label="Needs action"
          value={String(summary.unresolvedChangeRequests + (summary.claimedUnconfirmedCredits > 0 ? 1 : 0))}
          detail="Changes or payment claims"
          tone={summary.unresolvedChangeRequests + summary.claimedUnconfirmedCredits > 0 ? "amber" : "green"}
        />
        <StatusMetric icon={Clock3} label="Waiting confirmations" value={String(summary.pendingResponses)} detail="People still reviewing" tone="blue" />
        <StatusMetric icon={WalletCards} label="Unconfirmed claims" value={formatKrw(summary.claimedUnconfirmedCredits)} detail="Claimed, not verified" tone="amber" />
        <StatusMetric icon={ShieldCheck} label="Ready to settle" value={String(summary.pendingSettlements)} detail="Pay, book, or collect" tone="green" />
        <StatusMetric icon={CheckCircle2} label="Still owed" value={formatKrw(summary.stillOwed)} detail={`${formatKrw(summary.confirmedPayments)} confirmed`} tone="blue" />
      </section>

      <NextBestActionCard action={nextAction} />

      <section className="space-y-3" data-testid="active-workflows-section">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-app-text">Active workflows</h2>
            <p className="mt-1 text-sm text-app-muted">What is currently moving or blocked across groups.</p>
          </div>
          <Link href={`/groups/${activeGroup.id}/proposals`} className="hidden text-sm font-semibold text-app-blue hover:underline sm:inline">
            View splits
          </Link>
        </div>
        {workflows.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {workflows.map((workflow) => (
              <WorkflowCard key={`${workflow.groupId}-${workflow.proposalId}`} workflow={workflow} />
            ))}
          </div>
        ) : (
          <AppCard className="p-5 text-sm leading-6 text-app-muted" data-testid="active-workflows-empty">
            No urgent blockers. Waiting for confirmations or ready to settle workflows will appear here.
          </AppCard>
        )}
      </section>

      <AppCard className="p-5" data-testid="productivity-proof-card">
        <div className="grid gap-5 lg:grid-cols-[0.75fr_1fr] lg:items-start">
          <div>
            <h2 className="text-lg font-bold text-app-text">What SplitFlow replaces</h2>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              The Home page keeps the organizer out of repeated chat checks and spreadsheet edits by showing the agreement state first.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <ProofList
              title="Manual coordination"
              items={["Repeated group-chat clarification", "Spreadsheet recalculation", "Unclear exclusions", "Payment-status chasing"]}
            />
            <ProofList
              title="SplitFlow"
              items={["Proposal artifacts", "Deterministic split math", "Participant review", "Change-request resolution", "Settlement readiness"]}
            />
          </div>
        </div>
      </AppCard>

      <section className="space-y-3" data-testid="recent-activity-section">
        <div>
          <h2 className="text-lg font-bold text-app-text">Recent activity</h2>
          <p className="mt-1 text-sm text-app-muted">Timeline after action status is visible.</p>
        </div>
        <AppCard className="overflow-hidden">
          {summary.recentActivity.length > 0 ? (
            <div className="divide-y divide-app-border">
              {summary.recentActivity.map((item) => (
                <ActivityRow key={`${item.proposalId}-${item.event.id}`} item={item} />
              ))}
            </div>
          ) : (
            <div className="p-5 text-sm leading-6 text-app-muted" data-testid="recent-activity-empty">
              Activity appears here after splits are sent, changed, confirmed, or settled.
            </div>
          )}
        </AppCard>
      </section>
    </div>
  );
}

function NextBestActionCard({ action }: { action?: GlobalNextAction }) {
  if (!action) return null;
  const toneClass =
    action.priority === "high"
      ? "border-amber-200 bg-amber-50 text-app-amber"
      : action.priority === "medium"
        ? "border-blue-100 bg-blue-50 text-app-blue"
        : "border-green-100 bg-green-50 text-app-green";

  return (
    <AppCard className="p-5" data-testid="global-next-action-card">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-wide ${toneClass}`}>Next best action</span>
            {action.reasonTags.map((tag) => (
              <span key={tag} className="rounded-md border border-app-border bg-slate-50 px-2 py-1 text-xs font-semibold text-app-muted">
                {tag}
              </span>
            ))}
          </div>
          <h2 className="mt-3 text-lg font-bold text-app-text">{action.title}</h2>
          <p className="mt-2 text-sm leading-6 text-app-muted">{action.description}</p>
        </div>
        <Link
          href={action.href}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-app-blue px-4 text-sm font-semibold text-white hover:bg-blue-700 lg:w-auto"
          data-testid="global-next-action-cta"
        >
          {action.ctaLabel}
        </Link>
      </div>
    </AppCard>
  );
}

function WorkflowCard({ workflow }: { workflow: ActiveWorkflow }) {
  return (
    <Link
      href={workflow.href}
      className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-app-blue focus:ring-offset-2"
      data-testid={`active-workflow-${workflow.proposalId}`}
    >
      <AppCard className="h-full p-4 transition hover:border-blue-200 hover:bg-blue-50/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-muted">{workflow.groupName}</p>
            <h3 className="mt-1 break-words text-base font-bold text-app-text">{workflow.proposalTitle}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip label={humanStatus(workflow.status)} tone="slate" />
              <Chip label={workflow.readinessLabel} tone={workflow.blockers.length > 0 ? "amber" : "green"} />
            </div>
          </div>
          <div className="shrink-0 text-left md:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-muted">Total</p>
            <p className="mt-1 text-lg font-bold text-app-text">{formatKrw(workflow.totalAmount)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Meta label="Responses" value={workflow.responseProgress.label} />
          <Meta label="Claims" value={workflow.claimedPayments > 0 ? `${workflow.claimedPayments} to confirm` : "None pending"} />
          <Meta label="Next" value={workflow.nextAction} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {workflow.blockers.length > 0 ? (
            workflow.blockers.map((blocker) => <Chip key={blocker} label={blocker} tone="amber" />)
          ) : (
            <Chip label="No blockers" tone="green" />
          )}
        </div>
      </AppCard>
    </Link>
  );
}

function ActivityRow({
  item
}: {
  item: {
    groupId: string;
    groupName: string;
    proposalId: string;
    proposalTitle: string;
    event: TimelineEvent;
  };
}) {
  return (
    <Link href={`/groups/${item.groupId}/proposals/${item.proposalId}`} className="grid gap-2 px-4 py-3 hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-app-text">{item.event.text}</p>
        <p className="mt-1 text-xs text-app-muted">
          {item.groupName} · {item.proposalTitle}
        </p>
      </div>
      <p className="text-xs font-semibold text-app-muted" suppressHydrationWarning>
        {compactTime(item.event.at)}
      </p>
    </Link>
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

function StatusMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "amber" | "green";
}) {
  const colorClass = tone === "amber" ? "bg-amber-50 text-app-amber" : tone === "green" ? "bg-green-50 text-app-green" : "bg-blue-50 text-app-blue";
  return (
    <div className="min-w-0 rounded-lg border border-app-border bg-white p-3 shadow-[0_1px_2px_rgba(24,33,47,0.04)]">
      <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${colorClass}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-h-8 text-xs font-semibold leading-4 text-app-muted">{label}</div>
      <div className="mt-1 break-words text-lg font-bold text-app-text">{value}</div>
      <div className="mt-1 text-xs leading-4 text-app-muted">{detail}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-app-border bg-slate-50 px-3 py-2">
      <p className="truncate text-xs font-semibold text-app-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-app-text">{value}</p>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: "amber" | "green" | "slate" }) {
  const className =
    tone === "amber"
      ? "border-amber-100 bg-amber-50 text-app-amber"
      : tone === "green"
        ? "border-green-100 bg-green-50 text-app-green"
        : "border-slate-200 bg-slate-50 text-app-muted";
  return <span className={`max-w-full break-words rounded-md border px-2 py-1 text-xs font-semibold leading-5 ${className}`}>{label}</span>;
}
