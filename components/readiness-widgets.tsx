"use client";

import { AlertTriangle, CheckCircle2, Circle, Clock3, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { formatKrw } from "@/lib/format";
import type { ActionQueueItem, ReadinessChecklistItem, ReadinessSummary, ShareExplanation } from "@/lib/readiness";

function toneClasses(tone: ReadinessSummary["tone"] | ActionQueueItem["tone"]) {
  if (tone === "green") return "border-green-200 bg-green-50 text-app-green";
  if (tone === "red") return "border-red-200 bg-red-50 text-app-red";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-app-amber";
  if (tone === "blue") return "border-blue-200 bg-blue-50 text-app-blue";
  return "border-app-border bg-slate-50 text-app-muted";
}

function checklistIcon(status: ReadinessChecklistItem["status"]) {
  if (status === "done") return CheckCircle2;
  if (status === "attention") return AlertTriangle;
  return Circle;
}

export function SafeToBookSummary({ summary, totalCost, compact = false }: { summary: ReadinessSummary; totalCost: number; compact?: boolean }) {
  return (
    <section data-testid="safe-to-book-summary" className={`rounded-lg border bg-white ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className={`inline-flex min-h-8 items-center gap-2 rounded-md border px-2.5 text-sm font-bold ${toneClasses(summary.tone)}`}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {summary.title}
          </div>
          <p className="mt-2 text-sm leading-6 text-app-text">{summary.message}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-56">
          <SummaryMetric label="Trip total" value={formatKrw(totalCost)} />
          <SummaryMetric label="Replies" value={summary.replyProgress.label} />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm font-semibold text-app-text" data-testid="safe-to-book-next-action">
          Next: {summary.nextAction}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 sm:w-56" aria-label={summary.replyProgress.label}>
          <div
            className="h-full rounded-full bg-app-blue transition-all duration-300"
            style={{ width: `${summary.replyProgress.total > 0 ? Math.round((summary.replyProgress.accepted / summary.replyProgress.total) * 100) : 0}%` }}
          />
        </div>
      </div>
    </section>
  );
}

export function ReadinessChecklist({ items }: { items: ReadinessChecklistItem[] }) {
  return (
    <section data-testid="readiness-checklist" className="rounded-lg border border-app-border bg-white p-3">
      <h3 className="text-sm font-bold text-app-text">SplitFlow checked</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = checklistIcon(item.status);
          return (
            <div key={item.id} className="min-w-0 rounded-md border border-app-border bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 shrink-0 ${item.status === "done" ? "text-app-green" : item.status === "attention" ? "text-app-amber" : "text-app-muted"}`} aria-hidden="true" />
                <span className="truncate text-sm font-bold text-app-text">{item.label}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-app-muted">{item.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ActionQueueList({ items, groupId }: { items: ActionQueueItem[]; groupId: string }) {
  return (
    <section data-testid="action-queue" className="rounded-lg border border-app-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-app-text">Needs attention</h2>
          <p className="mt-1 text-sm text-app-muted">The shortest path to a safe booking decision.</p>
        </div>
        <Clock3 className="h-5 w-5 text-app-muted" aria-hidden="true" />
      </div>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/groups/${groupId}/proposals/${item.proposalId}`}
              className="block rounded-md border border-app-border px-3 py-3 hover:border-blue-200 hover:bg-blue-50/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-app-text">{item.title}</div>
                  <div className="mt-1 text-sm leading-5 text-app-muted">{item.description}</div>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-bold ${toneClasses(item.tone)}`}>{item.actionLabel}</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm font-semibold text-app-green">
            Nothing is blocking this group right now.
          </div>
        )}
      </div>
    </section>
  );
}

export function SharePreviewMessage({ summaryText }: { summaryText: string }) {
  return (
    <section data-testid="share-preview-message" className="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center gap-2 text-sm font-bold text-app-blue">
        <Send className="h-4 w-4" aria-hidden="true" />
        Share preview
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-app-text">{summaryText}</p>
    </section>
  );
}

export function ParticipantShareExplanation({ explanation }: { explanation: ShareExplanation }) {
  return (
    <section data-testid="participant-share-explanation" className="rounded-lg border border-app-border bg-white p-3">
      <h3 className="text-sm font-bold text-app-text">Why this share?</h3>
      <p className="mt-1 text-sm leading-6 text-app-muted">{explanation.summary}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-app-border bg-slate-50 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-app-muted">Included</div>
          <div className="mt-2 space-y-2">
            {explanation.included.map((item) => (
              <div key={item.itemId} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 break-words">{item.label}</span>
                <span className="shrink-0 font-semibold">{formatKrw(item.share)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-app-border bg-slate-50 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-app-muted">Not charged</div>
          <div className="mt-2 space-y-2">
            {explanation.excluded.length > 0 ? (
              explanation.excluded.map((item) => (
                <div key={item.itemId} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words">{item.label}</span>
                  <span className="shrink-0 font-semibold text-app-muted">{formatKrw(0)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-app-muted">No exclusions for this friend.</p>
            )}
          </div>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-sm leading-6 text-app-muted">
        {explanation.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-app-border bg-slate-50 px-3 py-2">
      <div className="truncate text-xs text-app-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-bold text-app-text">{value}</div>
    </div>
  );
}
